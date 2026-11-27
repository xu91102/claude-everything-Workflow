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

const fs = require('fs')
const path = require('path')

const SECRET_PATTERNS = [
    /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9]{16,}/i,
    /(?:secret|password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}/i,
    /(?:token)\s*[:=]\s*['"][a-zA-Z0-9_\-.]{20,}/i,
    /(?:AKIA|AGPA|AIDA|AROA|AIPA)[A-Z0-9]{12,}/
]
const DEBUG_PATTERNS = [/\bconsole\.log\b/, /\bdebugger\b/]
const COMMIT_MSG_REGEX =
    /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?:\s.+/
const GIT_OPTIONS_WITH_ARG = new Set([
    '-C', '-c', '--git-dir', '--work-tree', '--namespace',
    '--super-prefix', '--exec-path', '--config-env'
])
const FORWARDED_GIT_VALUE_FLAGS = new Set(['-C', '--git-dir', '--work-tree'])
const GIT_PATH_ENV = new Set([
    'GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR',
    'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES'
])
const SHELL_ASSIGNMENT = /^([a-zA-Z_][a-zA-Z0-9_]*)=([\s\S]*)$/
const SHELL_CONTROL_WORDS = new Set(['!'])
const CONDITIONAL_OPEN = new Set(['if', 'while', 'until', 'for', 'case'])
const CONDITIONAL_CLOSE = new Map([['fi', 'if'], ['done', 'loop'], ['esac', 'case']])
const GIT_EXECUTABLE_REGEX = /^(?:.*[\\/])?git(?:\.exe)?$/i

function isWindowsPathSuffix(text) {
    return /(?:^|[\s;|&(])(?:[A-Za-z]:|\\\\)[^\s;|&()<>'"]*$/.test(text)
}

function readBalancedParen(source, start) {
    let depth = 1
    let quote = null
    let escaped = false
    for (let i = start; i < source.length; i++) {
        const ch = source[i]
        if (escaped) {
            escaped = false
            continue
        }
        if (ch === '\\' && quote !== "'") {
            escaped = true
            continue
        }
        if (quote) {
            if (ch === quote) quote = null
            continue
        }
        if (ch === "'" || ch === '"') {
            quote = ch
            continue
        }
        if (ch === '(') depth += 1
        else if (ch === ')') {
            depth -= 1
            if (depth === 0) return i
        }
    }
    return source.length - 1
}

function isBareArithmetic(command, start) {
    const closeIdx = readBalancedParen(command, start + 1)
    if (command[closeIdx - 1] !== ')') return false
    const inner = command.slice(start + 2, closeIdx - 1)
    return !/[;\n|&]|\bcommit\b/.test(inner)
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

function splitCommandSegments(command) {
    const root = []
    const groups = []
    let segments = root
    const fnHead = new RegExp(
        '(?:function[ \\t]+([\\w-]+)(?:\\s*\\(\\s*\\))?|([a-zA-Z_][\\w-]*)[ \\t]*\\(\\s*\\))' +
        '(?:\\s|#[^\\n]*\\n)*(\\{(?=[\\s;&|()<>]|$)|\\()',
        'y'
    )
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
        if (ch === '\\' && quote !== "'" && (quote !== null || !isWindowsPathSuffix(current))) {
            if (command[i + 1] === '\n') {
                i += 1
                continue
            }
            current += ch
            escaped = true
            continue
        }
        if (quote !== "'" && command.startsWith('$(', i)) {
            const endIdx = readBalancedParen(command, i + 2)
            current += command.slice(i, endIdx + 1)
            i = endIdx
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
        if (arithmeticDepth) {
            if (ch === '(') arithmeticDepth += 1
            if (ch === ')') arithmeticDepth -= 1
            current += ch
            continue
        }
        if (command.startsWith('((', i) && isBareArithmetic(command, i)) {
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
            const m = /^<<(-?)[ \t]*((?:'[^'\n]*'|"(?:\\.|[^"\\\n])*"|\\[^\n]|[^\s;&|<>()\\'"])+)/
                .exec(command.slice(i))
            if (m) {
                hereDocs.push({ delimiter: tokenizeSegment(m[2])[0], stripTabs: Boolean(m[1]) })
                current += ' '
                i += m[0].length - 1
                continue
            }
        }
        let opener = ch
        let functionName
        if (/[a-zA-Z_]/.test(ch) && (!i || /[\s;&|({]/.test(command[i - 1])) && !current.trim()) {
            fnHead.lastIndex = i
            const header = fnHead.exec(command)
            if (header) {
                functionName = header[1] || header[2]
                opener = header[3]
                i = fnHead.lastIndex - 1
            }
        }
        const braceWord = (ch === '{' || ch === '}') && !current.trim() &&
            (i + 1 === command.length || /[\s;&|()<>]/.test(command[i + 1]))
        if (!functionName && ch === '(' &&
            /(?:^|\s)[a-zA-Z_][a-zA-Z0-9_]*(?:\[[^\]]*\])?\+?=$/.test(current)) {
            i = readBalancedParen(command, i + 1)
            current += '()'
            continue
        }
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
            if (ch === ';' || !continuations.has(segments.at(-1)?.operator)) segments.push({ operator: ';' })
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
        const winPath = quote === null && /^(?:[A-Za-z]:|\\\\)/.test(current)
        if (ch === '\\' && quote !== "'" && !winPath &&
            (quote !== '"' || /["$\\\x60\n]/.test(segment[i + 1] || ''))) {
            escaped = true
            hasToken = true
            continue
        }
        if (quote !== "'" && segment.startsWith('$(', i)) {
            const endIdx = readBalancedParen(segment, i + 2)
            current += segment.slice(i, endIdx + 1)
            hasToken = true
            i = endIdx
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

function isDynamicValue(value) {
    return typeof value === 'string' && /[$\x60]/.test(value)
}

function extractCommitMessage(commitArgs) {
    for (let i = 0; i < commitArgs.length; i++) {
        const arg = commitArgs[i]
        if (arg === '--') break
        let raw = null
        if ((arg === '-m' || arg === '--message') && i + 1 < commitArgs.length) raw = commitArgs[i + 1]
        else if (arg.startsWith('--message=')) raw = arg.slice('--message='.length)
        else if (/^-m.+/.test(arg)) raw = arg.slice(2)
        if (raw !== null) return isDynamicValue(raw) ? null : raw
    }
    return null
}

function applyCdTarget(target, baseDir, physical = false) {
    if (!target || target === '-' || target.startsWith('~') || isDynamicValue(target)) {
        return { dir: baseDir, unresolved: true }
    }
    const isWinAbs = /^(?:[A-Za-z]:[\\/]|\\\\)/.test(target)
    if (physical) {
        if (!path.isAbsolute(target) && !isWinAbs && !baseDir) {
            return { dir: baseDir, unresolved: true }
        }
        const rawPath = path.isAbsolute(target) || isWinAbs ? target : `${baseDir}${path.sep}${target}`
        try {
            return { dir: fs.realpathSync.native(rawPath), unresolved: false }
        } catch {
            return { dir: baseDir, unresolved: true }
        }
    }
    if (isWinAbs) {
        return { dir: target, unresolved: false }
    }
    return { dir: baseDir ? path.resolve(baseDir, target) : target, unresolved: false }
}

function shellScope(directory, inFunction = false, localVars = null) {
    return {
        directory,
        pipelineStart: directory,
        listStart: directory,
        inPipeline: false,
        inFunction,
        localVars,
        returned: false,
        exited: false,
        controlStack: [],
        conditionalDepth: 0,
        preConditionalDir: null,
        listMutatedCd: false,
        listMutatedEnv: false,
        condMutatedCd: false,
        condMutatedEnv: false
    }
}

function resetConditionalState(scope) {
    scope.conditionalDepth = 0
    scope.preConditionalDir = null
    scope.listMutatedCd = false
    scope.listMutatedEnv = false
    scope.condMutatedCd = false
    scope.condMutatedEnv = false
}

function sameGitVariables(a, b) {
    if (a === b) return true
    for (const name of GIT_PATH_ENV) {
        if ((a[name]?.value ?? null) !== (b[name]?.value ?? null) ||
            Boolean(a[name]?.exported) !== Boolean(b[name]?.exported)) {
            return false
        }
    }
    return true
}

function recordScopeMutation(scope, nextDirectory) {
    const before = scope.directory
    const cdChanged = nextDirectory.dir !== before.dir ||
        Boolean(nextDirectory.unresolved) !== Boolean(before.unresolved)
    const envChanged = !sameGitVariables(nextDirectory.variables, before.variables) ||
        Boolean(nextDirectory.unresolvedEnv) !== Boolean(before.unresolvedEnv)
    scope.directory = nextDirectory
    if (cdChanged) {
        scope.listMutatedCd = true
        if (scope.conditionalDepth > 0) scope.condMutatedCd = true
        for (const frame of scope.controlStack) {
            frame.mutatedCd = true
            if (frame.phase === 'cond') frame.condMutatedCd = true
        }
    }
    if (envChanged) {
        scope.listMutatedEnv = true
        if (scope.conditionalDepth > 0) scope.condMutatedEnv = true
        for (const frame of scope.controlStack) {
            frame.mutatedEnv = true
            if (frame.phase === 'cond') frame.condMutatedEnv = true
        }
    }
}

function mergeConditionalUncertain(base, mutatedCd, mutatedEnv) {
    return {
        ...base,
        unresolved: Boolean(base.unresolved || mutatedCd),
        unresolvedEnv: Boolean(base.unresolvedEnv || mutatedEnv)
    }
}

function advanceShellScope(scope, operator) {
    if (operator === '|') {
        scope.directory = scope.pipelineStart
        scope.inPipeline = true
        return
    }
    if (scope.inPipeline) {
        scope.directory = scope.pipelineStart
        scope.inPipeline = false
    }
    if (operator === '&') {
        scope.directory = scope.listStart
        scope.pipelineStart = scope.directory
        resetConditionalState(scope)
        return
    }
    if (operator === ';') {
        if (scope.condMutatedCd || scope.condMutatedEnv) {
            scope.directory = mergeConditionalUncertain(
                scope.preConditionalDir,
                scope.condMutatedCd,
                scope.condMutatedEnv
            )
        }
        scope.listStart = scope.directory
        scope.pipelineStart = scope.directory
        resetConditionalState(scope)
        return
    }
    if (operator === '&&' || operator === '||') {
        if (operator === '||' && (scope.listMutatedCd || scope.listMutatedEnv)) {
            scope.directory = mergeConditionalUncertain(
                scope.directory,
                scope.listMutatedCd,
                scope.listMutatedEnv
            )
            if (scope.conditionalDepth > 0) {
                if (scope.listMutatedCd) scope.condMutatedCd = true
                if (scope.listMutatedEnv) scope.condMutatedEnv = true
            }
        }
        if (scope.conditionalDepth === 0) scope.preConditionalDir = scope.directory
        scope.conditionalDepth += 1
        scope.pipelineStart = scope.directory
    }
}

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

function updateDeclaredGitVariables(previous, args, isLocal, scope) {
    let idx = 0
    let exportFlag = null
    let isGlobal = false
    while (idx < args.length) {
        const arg = args[idx]
        if (arg === '--') {
            idx += 1
            break
        }
        if (!/^[-+][a-zA-Z]+$/.test(arg)) break
        const plus = arg.startsWith('+')
        for (const ch of arg.slice(1)) {
            if (!plus && (ch === 'f' || ch === 'F' || ch === 'p')) return previous
            if (ch === 'x') exportFlag = !plus
            if (!plus && !isLocal && ch === 'g') isGlobal = true
        }
        idx += 1
    }
    const variables = { ...previous }
    for (const word of args.slice(idx)) {
        const assignment = SHELL_ASSIGNMENT.exec(word)
        const name = assignment ? assignment[1] : word
        if (!GIT_PATH_ENV.has(name)) continue
        if (scope.inFunction && !isGlobal && scope.localVars) scope.localVars.add(name)
        const old = variables[name]
        variables[name] = {
            value: assignment ? assignment[2] : (old?.value ?? null),
            exported: exportFlag !== null ? exportFlag : Boolean(old?.exported)
        }
    }
    return variables
}

function isDynamicGitPath(value) {
    return typeof value === 'string' && (isDynamicValue(value) || value.startsWith('~'))
}

function parseLeadingCommandPrefix(tokens, baseVariables) {
    const assignments = []
    const ops = []
    let usedEnvCommand = false
    let bypassFunctions = false
    let idx = 0

    while (idx < tokens.length) {
        const token = tokens[idx]
        if (SHELL_CONTROL_WORDS.has(token)) {
            idx += 1
            continue
        }
        if (token === 'command') {
            bypassFunctions = true
            idx += 1
            while (idx < tokens.length) {
                const opt = tokens[idx]
                if (opt === '--') {
                    idx += 1
                    break
                }
                if (/^-[pvV]+$/.test(opt)) {
                    if (opt.includes('v') || opt.includes('V')) {
                        return {
                            idx: tokens.length,
                            executable: undefined,
                            assignments,
                            usedEnvCommand,
                            bypassFunctions,
                            variables: baseVariables
                        }
                    }
                    idx += 1
                } else {
                    break
                }
            }
            continue
        }
        if (token === 'exec') {
            bypassFunctions = true
            idx += 1
            while (idx < tokens.length) {
                const opt = tokens[idx]
                if (opt === '--') {
                    idx += 1
                    break
                }
                if (opt === '-a' && idx + 1 < tokens.length) idx += 2
                else if (/^-[cl]+$/.test(opt)) {
                    if (opt.includes('c')) ops.push({ type: 'clear' })
                    idx += 1
                } else break
            }
            continue
        }
        if (token === 'builtin') {
            bypassFunctions = true
            idx += 1
            continue
        }
        if (token === 'env') {
            usedEnvCommand = true
            bypassFunctions = true
            idx += 1
            while (idx < tokens.length) {
                const opt = tokens[idx]
                if (opt === '-i' || opt === '--ignore-environment') {
                    ops.push({ type: 'clear' })
                    idx += 1
                } else if (opt === '-u' && idx + 1 < tokens.length) {
                    ops.push({ type: 'unset', name: tokens[idx + 1] })
                    idx += 2
                } else if (opt.startsWith('--unset=')) {
                    ops.push({ type: 'unset', name: opt.slice('--unset='.length) })
                    idx += 1
                } else if (opt === '--') {
                    idx += 1
                    break
                } else {
                    break
                }
            }
            continue
        }
        const assignment = SHELL_ASSIGNMENT.exec(token)
        if (!assignment) break
        if (GIT_PATH_ENV.has(assignment[1])) {
            ops.push({ type: 'assign', token })
            if (!usedEnvCommand) assignments.push(token)
        }
        idx += 1
    }

    const assignOp = tokens[idx] || usedEnvCommand ? 'export' : 'assign'
    let variables = { ...baseVariables }
    for (const op of ops) {
        if (op.type === 'clear') {
            variables = Object.fromEntries(
                [...GIT_PATH_ENV].map((name) => [name, { value: null, exported: false }])
            )
        } else if (op.type === 'unset') {
            variables = updateGitVariables(variables, [op.name], 'unset')
        } else {
            variables = updateGitVariables(variables, [op.token], assignOp)
        }
    }
    return { idx, executable: tokens[idx], assignments, usedEnvCommand, bypassFunctions, variables }
}

function parseGitCommand(tokens, startIdx) {
    const gitDirArgs = []
    const gitArgValues = []
    let subIdx = startIdx + 1
    while (subIdx < tokens.length) {
        const token = tokens[subIdx]
        if (token === '--') {
            subIdx += 1
            break
        }
        if (FORWARDED_GIT_VALUE_FLAGS.has(token)) {
            if (subIdx + 1 < tokens.length) {
                gitDirArgs.push(token, tokens[subIdx + 1])
                gitArgValues.push(tokens[subIdx + 1])
                subIdx += 2
                continue
            }
            break
        }
        if (token.startsWith('-C') && token.length > 2) {
            const val = token.slice(2)
            gitDirArgs.push('-C', val)
            gitArgValues.push(val)
            subIdx += 1
            continue
        }
        if (token.startsWith('--git-dir=') || token.startsWith('--work-tree=')) {
            gitDirArgs.push(token)
            gitArgValues.push(token.slice(token.indexOf('=') + 1))
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
    return { subcommand: tokens[subIdx], subIdx, gitDirArgs, gitArgValues }
}

function parseCdTarget(tokens, startIdx) {
    let idx = startIdx + 1
    let physical = false
    while (idx < tokens.length && /^-[LPe@]+$/.test(tokens[idx])) {
        for (const flag of tokens[idx].slice(1)) {
            if (flag === 'P') physical = true
            else if (flag === 'L') physical = false
        }
        idx += 1
    }
    if (tokens[idx] === '--') idx += 1
    return { target: tokens[idx], physical }
}

function consumeControlKeywords(tokens, scope) {
    let idx = 0
    while (idx < tokens.length) {
        const token = tokens[idx]
        if (CONDITIONAL_OPEN.has(token)) {
            const kind = token === 'while' || token === 'until' || token === 'for' ? 'loop' : token
            scope.controlStack.push({
                kind,
                phase: 'cond',
                entryDir: scope.directory,
                condMutatedCd: false,
                condMutatedEnv: false,
                mutatedCd: false,
                mutatedEnv: false
            })
            if (token === 'for' || token === 'case') return { idx: tokens.length, skipCommand: true }
            idx += 1
            continue
        }
        if (token === 'then' || token === 'do') {
            const top = scope.controlStack.at(-1)
            if (top) top.phase = 'body'
            idx += 1
            continue
        }
        if (token === 'elif' || token === 'else') {
            const top = scope.controlStack.at(-1)
            if (top && top.kind === 'if') {
                top.phase = token === 'elif' ? 'cond' : 'body'
                scope.directory = mergeConditionalUncertain(top.entryDir, top.condMutatedCd, top.condMutatedEnv)
                scope.listStart = scope.directory
                scope.pipelineStart = scope.directory
                resetConditionalState(scope)
            }
            idx += 1
            continue
        }
        if (CONDITIONAL_CLOSE.has(token)) {
            const expected = CONDITIONAL_CLOSE.get(token)
            if (scope.controlStack.at(-1)?.kind === expected) {
                const frame = scope.controlStack.pop()
                if (frame.mutatedCd || frame.mutatedEnv) {
                    recordScopeMutation(
                        scope,
                        mergeConditionalUncertain(frame.entryDir, frame.mutatedCd, frame.mutatedEnv)
                    )
                    scope.listStart = scope.directory
                    scope.pipelineStart = scope.directory
                }
            }
            idx += 1
            continue
        }
        break
    }
    return { idx, skipCommand: false }
}

function* gitCommitInvocations(command, initialCwd) {
    const variables = {}
    for (const name of GIT_PATH_ENV) {
        if (Object.hasOwn(process.env, name)) variables[name] = { value: process.env[name], exported: true }
    }
    const scope = shellScope({
        dir: initialCwd, unresolved: false, unresolvedEnv: false, hasPriorStagingMutation: false,
        functions: new Map(), variables
    })
    const analysis = { initialCwd, active: new Set(), calls: 0 }
    yield* walkShellCommands(splitCommandSegments(command), scope, analysis, 0)
}

function* walkShellCommands(segments, scope, analysis, depth) {
    if (depth > 64) {
        yield { analysisWarning: 'Shell 嵌套过深' }
        return
    }
    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
        const segment = segments[segIdx]
        const nextOp = segments[segIdx + 1]?.operator
        const deterministic = scope.controlStack.length === 0 && scope.conditionalDepth === 0 &&
            !scope.inPipeline && nextOp !== '|' && nextOp !== '&'
        const directory = scope.directory
        if (segment.functionName) {
            const functions = new Map(directory.functions)
            functions.set(segment.functionName, segment)
            scope.directory = { ...directory, functions }
            continue
        }
        if (segment.body) {
            const child = shellScope(directory, scope.inFunction, segment.shared ? scope.localVars : null)
            yield* walkShellCommands(segment.body, child, analysis, depth + 1)
            if (segment.shared) {
                recordScopeMutation(scope, child.directory)
                if (deterministic && child.exited) {
                    scope.exited = true
                    break
                }
                if (deterministic && child.returned && scope.inFunction) {
                    scope.returned = true
                    break
                }
            }
            continue
        }
        if (segment.operator) {
            advanceShellScope(scope, segment.operator)
            continue
        }
        const rawTokens = tokenizeSegment(segment.text)
        const { idx: controlIdx, skipCommand } = consumeControlKeywords(rawTokens, scope)
        if (skipCommand || controlIdx >= rawTokens.length) continue
        const activeDir = scope.directory
        const tokens = controlIdx > 0 ? rawTokens.slice(controlIdx) : rawTokens
        const { idx, executable, assignments, usedEnvCommand, bypassFunctions, variables } =
            parseLeadingCommandPrefix(tokens, activeDir.variables)

        if (!executable) {
            if (assignments.length && !usedEnvCommand) {
                recordScopeMutation(scope, { ...activeDir, variables })
            }
            continue
        }
        if (executable === 'export' || executable === 'unset') {
            recordScopeMutation(scope, {
                ...activeDir,
                variables: updateGitVariables(activeDir.variables, tokens.slice(idx + 1), executable)
            })
            continue
        }
        if (executable === 'local' || executable === 'declare' || executable === 'typeset') {
            const nextVars = updateDeclaredGitVariables(
                activeDir.variables,
                tokens.slice(idx + 1),
                executable === 'local',
                scope
            )
            recordScopeMutation(scope, { ...activeDir, variables: nextVars })
            continue
        }
        const definition = bypassFunctions ? null : activeDir.functions.get(executable)
        if (definition) {
            if (analysis.active.has(definition) || ++analysis.calls > 128) {
                yield { analysisWarning: 'Shell 函数调用超出静态分析范围' }
                continue
            }
            analysis.active.add(definition)
            const child = shellScope({ ...activeDir, variables }, true, new Set())
            yield* walkShellCommands(definition.body, child, analysis, depth + 1)
            analysis.active.delete(definition)
            if (definition.shared) {
                const restored = { ...child.directory.variables }
                const restoreNames = [
                    ...assignments.map((assignment) => SHELL_ASSIGNMENT.exec(assignment)[1]),
                    ...(child.localVars || [])
                ]
                for (const name of restoreNames) {
                    if (Object.hasOwn(activeDir.variables, name)) restored[name] = activeDir.variables[name]
                    else delete restored[name]
                }
                recordScopeMutation(scope, { ...child.directory, variables: restored })
                if (deterministic && child.exited) {
                    scope.exited = true
                    break
                }
            }
            continue
        }
        if (executable === 'cd') {
            const { target, physical } = parseCdTarget(tokens, idx)
            const next = applyCdTarget(target, activeDir.dir, physical)
            const isAbs = path.isAbsolute(target || '') || /^(?:[A-Za-z]:[\\/]|\\\\)/.test(target || '')
            recordScopeMutation(scope, {
                ...activeDir,
                dir: next.dir,
                unresolved: next.unresolved || (activeDir.unresolved && !isAbs)
            })
            continue
        }
        if (executable === 'return') {
            if (deterministic && scope.inFunction) {
                scope.returned = true
                break
            }
            continue
        }
        if (executable === 'exit') {
            if (deterministic) {
                scope.exited = true
                break
            }
            continue
        }
        if (!GIT_EXECUTABLE_REGEX.test(executable)) continue

        const { subcommand, subIdx, gitDirArgs, gitArgValues } = parseGitCommand(tokens, idx)
        if ((subcommand === 'add' || subcommand === 'stage' || subcommand === 'rm') &&
            !tokens.slice(subIdx + 1).some(arg => arg === '-n' || arg === '--dry-run')) {
            scope.directory = { ...activeDir, hasPriorStagingMutation: true }
            continue
        }
        if (subcommand === 'commit') {
            const gitEnv = {}
            for (const [name, variable] of Object.entries(variables)) {
                gitEnv[name] = variable.exported ? variable.value : null
            }
            yield {
                gitDirArgs,
                gitEnv,
                unresolvedEnv: Boolean(activeDir.unresolvedEnv) || Object.values(gitEnv).some(isDynamicGitPath),
                unresolvedGitArg: gitArgValues.some(isDynamicGitPath),
                cdDir: activeDir.dir !== analysis.initialCwd ? activeDir.dir : null,
                unresolvedCd: activeDir.unresolved,
                hasPriorStagingMutation: Boolean(activeDir.hasPriorStagingMutation),
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

function formatGitError(err) {
    const stderrLine = String(err?.stderr || '').split(/\r?\n/).find(line => line.trim()) || ''
    const fallback = String(err?.code || err?.message || '').split(/\r?\n/)[0]
    return (stderrLine || fallback).replace(/[\x00-\x1f]/g, ' ').trim().slice(0, 120)
}

function scanStagedDiff(commitInvocation, baseCwd) {
    const warnings = []
    if (commitInvocation.unresolvedEnv) {
        warnings.push('[Hook] 无法检查暂存区（Git 环境路径无法静态解析）；本次密钥与调试检查未运行。')
        return { warnings, shouldBlock: false }
    }
    if (commitInvocation.unresolvedGitArg) {
        warnings.push('[Hook] 无法检查暂存区（Git 路径参数无法静态解析）；本次密钥与调试检查未运行。')
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
        const diff = execFileSync('git', gitArgs, {
            env,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 10000,
            maxBuffer: 16 * 1024 * 1024,
            ...(effectiveCwd ? { cwd: effectiveCwd } : {})
        })

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
                    if (checkLinePatterns(line.slice(1), currentFile, newLine, warnings)) shouldBlock = true
                    newLine += 1
                } else if (line.startsWith(' ')) {
                    newLine += 1
                }
            }
        }
    } catch (err) {
        const detail = formatGitError(err)
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
    let warnedStaging = false
    const scanCache = new Map()

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
        if (commitInvocation.hasPriorStagingMutation && !warnedStaging) {
            warnings.push('[Hook] 命令包含暂存操作（git add/stage/rm），PreToolUse 仅检查执行前的已暂存区。')
            warnedStaging = true
        }

        const cacheKey = JSON.stringify([
            commitInvocation.cdDir || baseCwd,
            commitInvocation.gitDirArgs,
            commitInvocation.gitEnv,
            commitInvocation.unresolvedEnv,
            commitInvocation.unresolvedGitArg,
            commitInvocation.unresolvedCd
        ])
        let scan = scanCache.get(cacheKey)
        if (!scan) {
            scan = scanStagedDiff(commitInvocation, baseCwd)
            scanCache.set(cacheKey, scan)
            warnings.push(...scan.warnings)
        }
        if (scan.shouldBlock) shouldBlock = true
    }

    if (warnings.length === 0) return { exitCode: 0 }
    const stderr = warnings.join('\n') + '\n'
    if (shouldBlock) {
        return { exitCode: 2, stderr: stderr + '[Hook] 提交被阻止: 请移除密钥后重试\n' }
    }
    return { exitCode: 0, stderr }
}

module.exports = { run, diffPath, extractGitCommitInvocation }

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
