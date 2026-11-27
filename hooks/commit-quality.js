#!/usr/bin/env node
/**
 * 提交检查 Hook；不替代目标项目的验证和安全检查
 *
 * 在 git commit 前执行质量检查:
 * - 检查 staged 文件中的 console.log / debugger
 * - 校验 commit message 格式
 * - 检测硬编码密钥模式
 *
 * 退出码: 2 = 疑似密钥阻止提交, 0 = 继续（格式和调试代码仅警告）
 */

'use strict'

const path = require('path')

const SECRET_PATTERNS = [
    /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9]{16,}/i,
    /(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}/i,
    /(?:token)\s*[:=]\s*['"][a-zA-Z0-9_\-.]{20,}/i,
    /(?:AKIA|AGPA|AIDA|AROA|AIPA)[A-Z0-9]{12,}/
]
const DEBUG_PATTERNS = [
    /\bconsole\.log\b/,
    /\bdebugger\b/
]
const COMMIT_MSG_REGEX = /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?:\s.+/
const GIT_OPTIONS_WITH_ARG = new Set([
    '-C',
    '-c',
    '--git-dir',
    '--work-tree',
    '--namespace',
    '--super-prefix',
    '--exec-path',
    '--config-env'
])
const FORWARDED_GIT_VALUE_FLAGS = new Set(['-C', '--git-dir', '--work-tree'])

function splitCommandSegments(command) {
    const root = []
    const groups = []
    let segments = root
    const functionHead = /(?:function[ \t]+([\w-]+)(?:\s*\(\s*\))?|([a-zA-Z_][\w-]*)[ \t]*\(\s*\))(?:\s|#[^\n]*\n)*(\{(?=[\s;&|()<>]|$)|\()/y
    const continuations = new Set(['&&', '||', '|'])
    let current = ''
    let quote = null
    let escaped = false
    const hereDocs = []
    let arithmeticDepth = 0

    const push = () => {
        if (current.trim()) segments.push({ text: current.trim() })
        current = ''
    }

    for (let i = 0; i < command.length; i++) {
        const ch = command[i]
        if (escaped) {
            current += ch
            escaped = false
            continue
        }
        if (ch === '\\' && quote !== "'") {
            if (command[i + 1] === '\n') {
                i += 1
                continue
            }
            current += ch
            escaped = true
            continue
        }
        if (quote) {
            if (ch === quote) quote = null
            current += ch
            continue
        }
        if (ch === "'" || ch === '"') {
            quote = ch
            current += ch
            continue
        }
        // Inside arithmetic expressions, << is a bit shift, not a redirection.
        if (arithmeticDepth) {
            if (ch === '(') arithmeticDepth += 1
            if (ch === ')') arithmeticDepth -= 1
            current += ch
            continue
        }
        if (command.startsWith('((', i)) {
            arithmeticDepth = 2
            current += '(('
            i += 1
            continue
        }
        if (ch === '#' && (!current || /\s$/.test(current))) {
            const newline = command.indexOf('\n', i)
            i = newline === -1 ? command.length : newline - 1
            continue
        }
        if (command.startsWith('<<<', i)) {
            current += '<<<'
            i += 2
            continue
        }
        if (command.startsWith('<<', i)) {
            const match = /^<<(-?)[ \t]*((?:'[^'\n]*'|"(?:\\.|[^"\\\n])*"|\\[^\n]|[^\s;&|<>()\\'"])+)/.exec(command.slice(i))
            if (match) {
                hereDocs.push({ delimiter: tokenizeSegment(match[2])[0], stripTabs: Boolean(match[1]) })
                current += ' '
                i += match[0].length - 1
                continue
            }
        }
        let opener = ch
        let functionName
        if (/[a-zA-Z_]/.test(ch) && (!i || /[\s;&|({]/.test(command[i - 1])) && !current.trim()) {
            functionHead.lastIndex = i
            const header = functionHead.exec(command)
            if (header) {
                functionName = header[1] || header[2]
                opener = header[3]
                i = functionHead.lastIndex - 1
            }
        }
        // Braces are shell reserved words only at a command boundary.
        const braceWord = (ch === '{' || ch === '}') && !current.trim() &&
            (i + 1 === command.length || /[\s;&|()<>]/.test(command[i + 1]))
        if (functionName || ch === '(' || (braceWord && ch === '{')) {
            push()
            const group = { body: [], shared: opener === '{', functionName }
            segments.push(group)
            groups.push({ parent: segments, close: group.shared ? '}' : ')' })
            segments = group.body
            continue
        }
        if ((ch === ')' || (braceWord && ch === '}')) && groups.at(-1)?.close === ch) {
            push()
            segments = groups.pop().parent
            continue
        }
        if (ch === '\n' || ch === ';') {
            push()
            if (ch === ';' || !continuations.has(segments.at(-1)?.operator)) {
                segments.push({ operator: ';' })
            }
            if (ch === '\n' && hereDocs.length) {
                i = skipHereDocBodies(command, i + 1, hereDocs) - 1
                hereDocs.length = 0
            }
            continue
        }
        const pair = command.slice(i, i + 2)
        if (pair === '>&' || pair === '<&' || pair === '&>' || pair === '>|') {
            current += pair
            i += 1
            continue
        }
        if (ch === '&' || ch === '|') {
            push()
            const paired = pair === '&&' || pair === '||' || pair === '|&'
            segments.push({ operator: paired && pair !== '|&' ? pair : ch })
            if (paired) i += 1
            continue
        }
        current += ch
    }
    push()
    return root
}

function skipHereDocBodies(command, start, documents) {
    let cursor = start
    for (const { delimiter, stripTabs } of documents) {
        while (cursor < command.length) {
            const newline = command.indexOf('\n', cursor)
            const end = newline === -1 ? command.length : newline
            const line = command.slice(cursor, end).replace(/\r$/, '')
            cursor = newline === -1 ? end : end + 1
            if ((stripTabs ? line.replace(/^\t+/, '') : line) === delimiter) break
        }
    }
    return cursor
}

function tokenizeSegment(segment) {
    const tokens = []
    let current = ''
    let quote = null
    let escaped = false
    let hasToken = false

    for (let i = 0; i < segment.length; i++) {
        const ch = segment[i]
        if (escaped) {
            current += ch
            escaped = false
            hasToken = true
            continue
        }
        if (ch === '\\' && quote !== "'" && (quote !== '"' || /["$\\\x60\n]/.test(segment[i + 1] || ''))) {
            escaped = true
            hasToken = true
            continue
        }
        if (quote) {
            if (ch === quote) quote = null
            else current += ch
            hasToken = true
            continue
        }
        if (ch === "'" || ch === '"') {
            quote = ch
            hasToken = true
            continue
        }
        if (/\s/.test(ch)) {
            if (hasToken) {
                tokens.push(current)
                current = ''
                hasToken = false
            }
            continue
        }
        current += ch
        hasToken = true
    }
    if (hasToken) tokens.push(current)
    return tokens
}

function extractCommitMessage(commitArgs) {
    for (let i = 0; i < commitArgs.length; i++) {
        const arg = commitArgs[i]
        if (arg === '--') break
        if ((arg === '-m' || arg === '--message') && i + 1 < commitArgs.length) return commitArgs[i + 1]
        if (arg.startsWith('--message=')) return arg.slice('--message='.length)
        if (/^-m.+/.test(arg)) return arg.slice(2)
    }
    return null
}

function applyCdTarget(target, baseDir) {
    if (!target || target === '-' || target.startsWith('~') || /[$\x60]/.test(target)) {
        return { dir: baseDir, unresolved: true }
    }
    return { dir: baseDir ? path.resolve(baseDir, target) : target, unresolved: false }
}

const GIT_PATH_ENV = new Set([
    'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR',
    'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES'
])

function shellScope(directory) {
    return { directory, pipelineStart: directory, listStart: directory, inPipeline: false }
}

function advanceShellScope(scope, operator) {
    // Each stage starts in the pipeline's original directory. A trailing & runs
    // the whole AND/OR list in a child, including directory changes before &&.
    if (operator === '|') {
        scope.directory = scope.pipelineStart
        scope.inPipeline = true
        return
    }
    if (scope.inPipeline) scope.directory = scope.pipelineStart
    if (operator === '&') scope.directory = scope.listStart
    if (operator === '&' || operator === ';') scope.listStart = scope.directory
    scope.pipelineStart = scope.directory
    scope.inPipeline = false
}

const SHELL_ASSIGNMENT = /^([a-zA-Z_][a-zA-Z0-9_]*)=([\s\S]*)$/

function updateGitVariables(previous, words, operation) {
    const variables = { ...previous }
    const removeExport = operation === 'export' && words.includes('-n')
    if (words.includes('-f') || words.includes('-p')) return variables
    for (const word of words) {
        const assignment = SHELL_ASSIGNMENT.exec(word)
        const name = assignment ? assignment[1] : word
        if (!GIT_PATH_ENV.has(name)) continue
        const old = variables[name]
        if (operation === 'unset') {
            variables[name] = { value: null, exported: false }
        } else {
            variables[name] = {
                value: assignment ? assignment[2] : old?.value ?? null,
                exported: operation === 'export' ? !removeExport : Boolean(old?.exported)
            }
        }
    }
    return variables
}

function isDynamicGitPath(value) {
    return typeof value === 'string' && (/[$\x60]/.test(value) || value.startsWith('~'))
}

function* gitCommitInvocations(command, initialCwd) {
    const variables = {}
    for (const name of GIT_PATH_ENV) {
        if (Object.hasOwn(process.env, name)) variables[name] = { value: process.env[name], exported: true }
    }
    const scope = shellScope({ dir: initialCwd, unresolved: false, functions: new Map(), variables })
    const analysis = { initialCwd, active: new Set(), calls: 0 }
    yield* walkShellCommands(splitCommandSegments(command), scope, analysis, 0)
}

function* walkShellCommands(segments, scope, analysis, depth) {
    // Limit expansion of recursive or repeatedly invoked shell functions.
    if (depth > 64) {
        yield { analysisWarning: 'Shell 嵌套过深' }
        return
    }
    for (const segment of segments) {
        const directory = scope.directory
        if (segment.functionName) {
            const functions = new Map(directory.functions)
            functions.set(segment.functionName, segment)
            scope.directory = { ...directory, functions }
            continue
        }
        if (segment.body) {
            const child = shellScope(directory)
            yield* walkShellCommands(segment.body, child, analysis, depth + 1)
            if (segment.shared) scope.directory = child.directory
            continue
        }
        if (segment.operator) {
            advanceShellScope(scope, segment.operator)
            continue
        }
        const tokens = tokenizeSegment(segment.text)
        const assignments = []
        let idx = 0
        while (idx < tokens.length) {
            const assignment = SHELL_ASSIGNMENT.exec(tokens[idx])
            if (!assignment && tokens[idx] !== 'env') break
            if (assignment && GIT_PATH_ENV.has(assignment[1])) assignments.push(tokens[idx])
            idx += 1
        }
        const executable = tokens[idx]
        if (!executable) {
            if (assignments.length && !tokens.includes('env')) {
                scope.directory = { ...directory, variables: updateGitVariables(directory.variables, assignments, 'assign') }
            }
            continue
        }
        if (executable === 'export' || executable === 'unset') {
            const variables = updateGitVariables(directory.variables, tokens.slice(idx + 1), executable)
            scope.directory = { ...directory, variables }
            continue
        }
        const variables = assignments.length ? updateGitVariables(directory.variables, assignments, 'export') : directory.variables
        const definition = directory.functions.get(executable)
        if (definition) {
            if (analysis.active.has(definition) || ++analysis.calls > 128) {
                yield { analysisWarning: 'Shell 函数调用超出静态分析范围' }
                continue
            }
            analysis.active.add(definition)
            const child = shellScope({ ...directory, variables })
            yield* walkShellCommands(definition.body, child, analysis, depth + 1)
            analysis.active.delete(definition)
            if (definition.shared) {
                // Prefix assignments on a function call expire when it returns.
                const restored = { ...child.directory.variables }
                for (const assignment of assignments) {
                    const name = SHELL_ASSIGNMENT.exec(assignment)[1]
                    if (Object.hasOwn(directory.variables, name)) restored[name] = directory.variables[name]
                    else delete restored[name]
                }
                scope.directory = { ...child.directory, variables: restored }
            }
            continue
        }

        if (executable === 'cd') {
            const target = tokens[idx + 1] === '--' ? tokens[idx + 2] : tokens[idx + 1]
            const next = applyCdTarget(target, directory.dir)
            scope.directory = {
                ...directory,
                dir: next.dir,
                unresolved: next.unresolved || (directory.unresolved && !path.isAbsolute(target || ''))
            }
            continue
        }

        if (!(executable === 'git' || executable.endsWith('/git') || executable.endsWith('\\git'))) {
            continue
        }

        const gitDirArgs = []
        let subIdx = idx + 1
        while (subIdx < tokens.length) {
            const token = tokens[subIdx]
            if (token === '--') {
                subIdx += 1
                break
            }
            if (FORWARDED_GIT_VALUE_FLAGS.has(token)) {
                if (subIdx + 1 < tokens.length) {
                    gitDirArgs.push(token, tokens[subIdx + 1])
                    subIdx += 2
                    continue
                }
                break
            }
            if (token.startsWith('-C') && token.length > 2) {
                gitDirArgs.push('-C', token.slice(2))
                subIdx += 1
                continue
            }
            if (token.startsWith('--git-dir=') || token.startsWith('--work-tree=')) {
                gitDirArgs.push(token)
                subIdx += 1
                continue
            }
            if (GIT_OPTIONS_WITH_ARG.has(token)) {
                subIdx += 2
                continue
            }
            if (token.startsWith('-')) {
                subIdx += 1
                continue
            }
            break
        }

        if (tokens[subIdx] === 'commit') {
            const gitEnv = {}
            for (const [name, variable] of Object.entries(variables)) {
                gitEnv[name] = variable.exported ? variable.value : null
            }
            yield {
                gitDirArgs,
                gitEnv,
                unresolvedEnv: Object.values(gitEnv).some(isDynamicGitPath),
                cdDir: directory.dir !== analysis.initialCwd ? directory.dir : null,
                unresolvedCd: directory.unresolved,
                message: extractCommitMessage(tokens.slice(subIdx + 1))
            }
        }
    }
}

function extractGitCommitInvocation(command, initialCwd = null) {
    return gitCommitInvocations(command, initialCwd).next().value ?? null
}

function diffPath(value) {
    value = value.split('\t')[0]
    if (value.startsWith('"') && value.endsWith('"')) {
        const escapes = { a: '\x07', b: '\b', t: '\t', n: '\n', v: '\x0b', f: '\f', r: '\r', '"': '"', '\\': '\\' }
        const parts = value.slice(1, -1).match(/\\[0-7]{1,3}|\\.|[^\\]+/g) || []
        value = Buffer.concat(parts.map(part => {
            if (/^\\[0-7]/.test(part)) return Buffer.from([parseInt(part.slice(1), 8)])
            if (part.startsWith('\\')) return Buffer.from(escapes[part[1]] ?? part.slice(1))
            return Buffer.from(part)
        })).toString('utf8')
    }
    return value.startsWith('b/') ? value.slice(2) : value
}

function checkLinePatterns(line, filePath, lineNumber, warnings) {
    const displayPath = /[\x00-\x1f]/.test(filePath) ? JSON.stringify(filePath) : filePath
    let blocked = false

    for (const pattern of SECRET_PATTERNS) {
        if (pattern.test(line)) {
            warnings.push(`[Hook] 检测到疑似密钥: ${displayPath}:${lineNumber}`)
            blocked = true
        }
    }
    for (const pattern of DEBUG_PATTERNS) {
        if (pattern.test(line)) {
            // 同一行可能包含密钥；仅报告位置，不回显源码。
            warnings.push(`[Hook] 检测到调试代码: ${displayPath}:${lineNumber}`)
        }
    }
    return blocked
}

function scanStagedDiff(commitInvocation, baseCwd) {
    const warnings = []
    if (commitInvocation.unresolvedEnv) {
        warnings.push('[Hook] 无法检查暂存区（Git 环境路径无法静态解析）；本次密钥与调试检查未运行。')
        return { warnings, shouldBlock: false }
    }
    if (commitInvocation.unresolvedCd) {
        warnings.push('[Hook] 无法检查暂存区（cd 目标无法静态解析）；本次密钥与调试检查未运行。')
        return { warnings, shouldBlock: false }
    }

    let shouldBlock = false
    try {
        const { execFileSync } = require('child_process')
        const gitArgs = [
            ...commitInvocation.gitDirArgs,
            '-c', 'core.quotePath=false',
            '-c', 'diff.noprefix=false',
            'diff', '--cached', '--unified=0', '--no-color', '--no-ext-diff', '--no-textconv',
            '--src-prefix=a/', '--dst-prefix=b/'
        ]
        const effectiveCwd = commitInvocation.cdDir || baseCwd
        const env = { ...process.env }
        for (const [name, value] of Object.entries(commitInvocation.gitEnv)) {
            if (value === null) delete env[name]
            else env[name] = value
        }
        const execOptions = {
            env,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 10000,
            maxBuffer: 16 * 1024 * 1024,
            ...(effectiveCwd ? { cwd: effectiveCwd } : {})
        }
        const diff = execFileSync('git', gitArgs, execOptions)

        let currentFile = ''
        let newLine = 0
        let inHunk = false
        for (const line of diff.split('\n')) {
            if (line.startsWith('diff --git ')) {
                currentFile = ''
                inHunk = false
            } else if (!inHunk && line.startsWith('+++ ')) {
                currentFile = line === '+++ /dev/null' ? '' : diffPath(line.slice(4))
            } else if (/^@@ .* \+(\d+)(?:,\d+)? @@/.test(line)) {
                newLine = Number(line.match(/ \+(\d+)(?:,\d+)? @@/)[1])
                inHunk = true
            } else if (inHunk && currentFile) {
                if (line.startsWith('+')) {
                    if (checkLinePatterns(line.slice(1), currentFile, newLine, warnings)) {
                        shouldBlock = true
                    }
                    newLine += 1
                } else if (line.startsWith(' ')) {
                    newLine += 1
                }
            }
        }
    } catch (err) {
        const detail = String(err?.code || err?.message || '').split('\n')[0].trim().slice(0, 120)
        warnings.push(
            detail
                ? `[Hook] 无法检查暂存区（${detail}）；本次密钥与调试检查未运行。`
                : '[Hook] 无法检查暂存区；本次密钥与调试检查未运行。'
        )
    }

    return { warnings, shouldBlock }
}

/**
 * Hook 入口 - 支持 run-with-flags.js 直接调用
 * @param {string} raw - stdin 原始 JSON
 * @param {object} [options]
 * @param {string} [options.cwd] - 显式工作目录
 * @returns {{ exitCode: number, stderr?: string }}
 */
function run(raw, options = {}) {
    let input
    try {
        input = JSON.parse(raw)
    } catch {
        return { exitCode: 0 }
    }

    const cwd = options?.cwd || input?.cwd
    const baseCwd = typeof cwd === 'string' && cwd ? cwd : process.cwd()
    const command = input?.tool_input?.command
    if (typeof command !== 'string') return { exitCode: 0 }
    const warnings = []
    let shouldBlock = false
    for (const commitInvocation of gitCommitInvocations(command, baseCwd)) {
        if (commitInvocation.analysisWarning) {
            warnings.push(`[Hook] 无法检查暂存区（${commitInvocation.analysisWarning}）。`)
            continue
        }
        if (commitInvocation.message !== null && !COMMIT_MSG_REGEX.test(commitInvocation.message)) {
            warnings.push(
                `[Hook] Commit message 格式不符合规范: "${commitInvocation.message}"\n` +
                '[Hook] 格式: <type>(<scope>): <description>\n' +
                '[Hook] type: feat|fix|docs|style|refactor|perf|test|chore'
            )
        }

        const scan = scanStagedDiff(commitInvocation, baseCwd)
        warnings.push(...scan.warnings)
        if (scan.shouldBlock) shouldBlock = true
    }

    if (warnings.length === 0) {
        return { exitCode: 0 }
    }

    const stderr = warnings.join('\n') + '\n'
    if (shouldBlock) {
        return {
            exitCode: 2,
            stderr: stderr + '[Hook] 提交被阻止: 请移除密钥后重试\n'
        }
    }

    return { exitCode: 0, stderr }
}

module.exports = { run, diffPath, extractGitCommitInvocation }

// 支持独立运行
if (require.main === module) {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => { data += chunk })
    process.stdin.on('end', () => {
        const result = run(data)
        if (result.stderr) process.stderr.write(result.stderr)
        if (result.stdout) process.stdout.write(result.stdout)
        process.exit(result.exitCode || 0)
    })
}
