#!/usr/bin/env node
/**
 * Pre-commit 质量门 Hook
 *
 * 在 git commit 前执行质量检查:
 * - 检查 staged 文件中的 console.log / debugger
 * - 校验 commit message 格式
 * - 检测硬编码密钥模式
 *
 * 退出码: 2 = 阻止提交, 0 = 仅警告
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
    const checkPatterns = (content, filePath) => {
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            // 仅检查新增行
            if (!line.startsWith('+') || line.startsWith('+++')) continue

            for (const pattern of SECRET_PATTERNS) {
                if (pattern.test(line)) {
                    warnings.push(
                        `[Hook] 检测到疑似密钥: ${filePath}:${i + 1}`
                    )
                    shouldBlock = true
                }
            }

            for (const pattern of DEBUG_PATTERNS) {
                if (pattern.test(line)) {
                    warnings.push(
                        `[Hook] 检测到调试代码: ${filePath}:${i + 1} ` +
                        `(${line.trim().substring(0, 60)})`
                    )
                }
            }
        }
    }

    // 尝试检查 staged 内容
    try {
        const { execSync } = require('child_process')
        const diff = execSync('git diff --cached --unified=0', {
            encoding: 'utf8',
            timeout: 10000
        })

        let currentFile = ''
        for (const line of diff.split('\n')) {
            if (line.startsWith('diff --git')) {
                const match = line.match(/b\/(.+)$/)
                if (match) currentFile = match[1]
            }
        }

        checkPatterns(diff, currentFile)
    } catch {
        // git 不可用时跳过
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
