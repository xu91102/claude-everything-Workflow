#!/usr/bin/env node
'use strict'

const fs = require('node:fs')
const { isHookEnabled } = require('./runtime/hook-flags')

const CODE_TARGET_LINES = 800
const TEST_MAX_LINES = 1000
const MAX_LINE_LENGTH = 120
const MAX_STDIN_BYTES = 1024 * 1024
const CODE_EXTENSIONS = new Set([
    '.c', '.cc', '.cpp', '.cs', '.css', '.go', '.h', '.hpp',
    '.html', '.java', '.js', '.jsx', '.kt', '.lua', '.mjs', '.php',
    '.py', '.rb', '.rs', '.sh', '.swift', '.ts', '.tsx', '.vue'
])
const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts'])
const FORBIDDEN_PATTERNS = [
    { label: 'console.log 调试残留', pattern: /\bconsole\.log\s*\(/ },
    { label: 'debugger 调试残留', pattern: /^\s*debugger\b/m },
    { label: '@ts-ignore', pattern: /@ts-ignore/ },
    { label: '@ts-nocheck', pattern: /@ts-nocheck/ },
    { label: 'any 类型（: any）', pattern: /:\s*any\b/ },
    { label: 'any 断言（as any）', pattern: /\bas\s+any\b/ }
]

function getExtension(filePath) {
    const match = filePath.match(/(\.[^.\\/]+)$/)
    return match ? match[1].toLowerCase() : ''
}

function isTestFile(filePath) {
    return /(^|[\\/])__tests__([\\/]|$)/.test(filePath) ||
        /\.(test|spec)\.[^.\\/]+$/.test(filePath)
}

function countLines(content) {
    if (content.length === 0) return 0
    const lines = content.split(/\r?\n/)
    return content.endsWith('\n') ? lines.length - 1 : lines.length
}

function sizeWarnings(filePath, content) {
    const testFile = isTestFile(filePath)
    const lineThreshold = testFile ? TEST_MAX_LINES : CODE_TARGET_LINES
    const lineCount = countLines(content)
    const messages = []

    if (lineCount > lineThreshold) {
        messages.push(
            testFile
                ? `测试文件超过 ${lineThreshold} 行上限 (${lineCount} 行)，请拆分测试场景。`
                : `代码文件超过约 ${lineThreshold} 行的参考值 (${lineCount} 行)，请评估是否按职责拆分。`
        )
    }

    const longLineNumbers = []
    content.split(/\r?\n/).forEach((line, index) => {
        if (line.length > MAX_LINE_LENGTH && longLineNumbers.length < 3) {
            longLineNumbers.push(index + 1)
        }
    })
    if (longLineNumbers.length > 0) {
        messages.push(
            `存在超过 ${MAX_LINE_LENGTH} 字符的行（如第 ${longLineNumbers.join('、')} 行），请换行或提取。`
        )
    }

    return messages
}

function checkEditedFile(raw, patterns, size) {
    let filePath
    try {
        filePath = JSON.parse(raw)?.tool_input?.file_path
    } catch {
        return { exitCode: 0 }
    }
    if (typeof filePath !== 'string') return { exitCode: 0 }

    const ext = getExtension(filePath)
    const checkPatterns = patterns && ext && !/^\.(md|json|txt)$/.test(ext)
    const checkSize = size && CODE_EXTENSIONS.has(ext)
    if (!checkPatterns && !checkSize) return { exitCode: 0 }

    let content
    try {
        content = fs.readFileSync(filePath, 'utf8')
    } catch {
        return { exitCode: 0 }
    }

    const warnings = []
    if (checkPatterns) {
        const hits = FORBIDDEN_PATTERNS
            .filter(rule => (!rule.label.includes('any') || TS_EXTENSIONS.has(ext)) && rule.pattern.test(content))
            .map(rule => rule.label)
        if (hits.length) {
            warnings.push(
                `[Hook] 警告: ${filePath} 含禁止模式: ${hits.join('、')}，请按 rules/02-implementation.md 处理`
            )
        }
    }
    if (checkSize) {
        const messages = sizeWarnings(filePath, content)
        if (messages.length) warnings.push(`[Hook] ${filePath}: ${messages.join(' ')}`)
    }
    return warnings.length ? { exitCode: 0, stderr: warnings.join('\n') + '\n' } : { exitCode: 0 }
}

function isSubHookEnabled(hookId) {
    // Allow ECC_DISABLED_HOOKS per sub-check without overriding the profile set on post:edit:quality.
    return isHookEnabled(hookId, { profiles: 'minimal,standard,strict' })
}

function run(raw) {
    return checkEditedFile(
        raw,
        isSubHookEnabled('post:edit:console-log'),
        isSubHookEnabled('post:edit:code-size')
    )
}

function runCli(check) {
    let raw = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', chunk => {
        if (raw.length < MAX_STDIN_BYTES) raw += chunk.slice(0, MAX_STDIN_BYTES - raw.length)
    })
    process.stdin.on('end', () => {
        const result = check(raw)
        if (result.stderr) process.stderr.write(result.stderr)
        if (result.stdout) process.stdout.write(result.stdout)
        process.exit(result.exitCode || 0)
    })
    process.stdin.on('error', () => process.exit(0))
}

module.exports = { run, checkEditedFile, runCli }
if (require.main === module) runCli(run)
