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

const COMMIT_PATTERN = /^git\s+commit/
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

function diffPath(value) {
    value = value.split('\t')[0]
    if (value.startsWith('"')) {
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

/**
 * Hook 入口 - 支持 run-with-flags.js 直接调用
 * @param {string} raw - stdin 原始 JSON
 * @returns {{ exitCode: number, stderr: string }}
 */
function run(raw) {
    let input
    try {
        input = JSON.parse(raw)
    } catch {
        return { exitCode: 0 }
    }

    const command = input.tool_input?.command || ''

    // 仅拦截 git commit 命令
    if (!COMMIT_PATTERN.test(command)) {
        return { exitCode: 0 }
    }

    const warnings = []
    let shouldBlock = false

    // 检查 commit message 格式 (如果通过 -m 提供)
    const msgMatch = command.match(/-m\s+['"]([^'"]+)['"]/)
    if (msgMatch) {
        const msg = msgMatch[1]
        if (!COMMIT_MSG_REGEX.test(msg)) {
            warnings.push(
                `[Hook] Commit message 格式不符合规范: "${msg}"\n` +
                '[Hook] 格式: <type>(<scope>): <description>\n' +
                '[Hook] type: feat|fix|docs|style|refactor|perf|test|chore'
            )
        }
    }

    // 检测密钥和调试代码（通过 git diff --cached）
    const checkPatterns = (line, filePath, lineNumber) => {
        const displayPath = /[\x00-\x1f]/.test(filePath) ? JSON.stringify(filePath) : filePath
        for (const pattern of SECRET_PATTERNS) {
            if (pattern.test(line)) {
                warnings.push(`[Hook] 检测到疑似密钥: ${displayPath}:${lineNumber}`)
                shouldBlock = true
            }
        }

        for (const pattern of DEBUG_PATTERNS) {
            if (pattern.test(line)) {
                // 同一行可能包含密钥；仅报告位置，不回显源码。
                warnings.push(`[Hook] 检测到调试代码: ${displayPath}:${lineNumber}`)
            }
        }
    }

    // 尝试检查 staged 内容
    try {
        const { execFileSync } = require('child_process')
        const diff = execFileSync('git', [
            '-c', 'core.quotePath=false', '-c', 'diff.noprefix=false',
            'diff', '--cached', '--unified=0', '--no-color', '--no-ext-diff', '--no-textconv',
            '--src-prefix=a/', '--dst-prefix=b/'
        ], {
            encoding: 'utf8',
            timeout: 10000,
            maxBuffer: 16 * 1024 * 1024
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
            } else if (/^@@ .* \+\d+(?:,\d+)? @@/.test(line)) {
                newLine = Number(line.match(/ \+(\d+)(?:,\d+)? @@/)[1])
                inHunk = true
            } else if (inHunk && currentFile) {
                if (line.startsWith('+')) {
                    checkPatterns(line.slice(1), currentFile, newLine)
                    newLine++
                } else if (line.startsWith(' ')) {
                    newLine++
                }
            }
        }
    } catch {
        warnings.push('[Hook] 无法检查暂存区；本次密钥与调试检查未运行。')
    }

    if (warnings.length === 0) {
        return { exitCode: 0 }
    }

    const stderr = warnings.join('\n') + '\n'

    if (shouldBlock) {
        return {
            exitCode: 2,
            stderr: stderr +
                '[Hook] 提交被阻止: 请移除密钥后重试\n'
        }
    }

    return { exitCode: 0, stderr }
}

module.exports = { run }

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
