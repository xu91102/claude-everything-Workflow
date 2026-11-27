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
    const segments = []
    let current = ''
    let quote = null
    let escaped = false
    let depth = 0

    const push = (segDepth) => {
        if (current.trim()) segments.push({ text: current.trim(), depth: segDepth })
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
        if (ch === '(') {
            push(depth)
            depth += 1
            continue
        }
        if (ch === ')') {
            push(depth)
            depth = Math.max(0, depth - 1)
            continue
        }
        if (ch === '\n' || ch === ';') {
            push(depth)
            continue
        }
        if ((ch === '&' || ch === '|') && command[i + 1] === ch) {
            push(depth)
            i += 1
            continue
        }
        if (ch === '&' || ch === '|') {
            push(depth)
            continue
        }
        current += ch
    }
    push(depth)
    return segments
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
        if (ch === '\\' && quote !== "'") {
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
    if (!target || target === '-' || target.startsWith('$') || target.includes('`')) {
        return { dir: baseDir, unresolved: true }
    }
    return { dir: baseDir ? path.resolve(baseDir, target) : target, unresolved: false }
}

function extractGitCommitInvocation(command, initialCwd = null) {
    let trackedDir = initialCwd
    let unresolvedDir = false

    for (const { text, depth } of splitCommandSegments(command)) {
        const tokens = tokenizeSegment(text)
        let idx = 0
        while (idx < tokens.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[idx]) || tokens[idx] === 'env')) {
            idx += 1
        }
        const executable = tokens[idx]
        if (!executable) continue

        if (executable === 'cd' && depth === 0) {
            const target = tokens[idx + 1]
            if (target && target !== '--') {
                const next = applyCdTarget(target, trackedDir)
                trackedDir = next.dir
                unresolvedDir = next.unresolved
            } else if (tokens[idx + 1] === '--' && tokens[idx + 2]) {
                const next = applyCdTarget(tokens[idx + 2], trackedDir)
                trackedDir = next.dir
                unresolvedDir = next.unresolved
            } else {
                unresolvedDir = true
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
            return {
                gitDirArgs,
                cdDir: trackedDir !== initialCwd ? trackedDir : null,
                unresolvedCd: unresolvedDir && !gitDirArgs.length,
                message: extractCommitMessage(tokens.slice(subIdx + 1))
            }
        }
    }
    return null
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
        const execOptions = {
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

    const baseCwd = options && typeof options.cwd === 'string' && options.cwd ? options.cwd : process.cwd()
    const command = input.tool_input?.command || ''
    const commitInvocation = extractGitCommitInvocation(command, baseCwd)
    if (!commitInvocation) {
        return { exitCode: 0 }
    }

    const warnings = []
    if (commitInvocation.message !== null && !COMMIT_MSG_REGEX.test(commitInvocation.message)) {
        warnings.push(
            `[Hook] Commit message 格式不符合规范: "${commitInvocation.message}"\n` +
            '[Hook] 格式: <type>(<scope>): <description>\n' +
            '[Hook] type: feat|fix|docs|style|refactor|perf|test|chore'
        )
    }

    const scan = scanStagedDiff(commitInvocation, baseCwd)
    warnings.push(...scan.warnings)

    if (warnings.length === 0) {
        return { exitCode: 0 }
    }

    const stderr = warnings.join('\n') + '\n'
    if (scan.shouldBlock) {
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
