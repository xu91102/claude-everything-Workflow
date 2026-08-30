#!/usr/bin/env node
/**
 * Check Forbidden Patterns Hook
 *
 * 在代码编辑后检测静态禁止模式：console.log、debugger，
 * 以及 TypeScript 文件中的 @ts-ignore、@ts-nocheck、`: any`、`as any`。
 * 对应 rules/07-forbidden.md 的代码禁止项；文档文件不受检查。
 * 用于 PostToolUse hook，警告不阻塞。
 */

'use strict'

const fs = require('fs')

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts'])

function getExtension(filePath) {
    const match = filePath.match(/(\.[^.\\/]+)$/)
    return match ? match[1].toLowerCase() : ''
}

const FORBIDDEN_PATTERNS = [
    { label: 'console.log 调试残留', pattern: /\bconsole\.log\s*\(/ },
    { label: 'debugger 调试残留', pattern: /^\s*debugger\b/m },
    { label: '@ts-ignore', pattern: /@ts-ignore/ },
    { label: '@ts-nocheck', pattern: /@ts-nocheck/ },
    { label: 'any 类型（: any）', pattern: /:\s*any\b/ },
    { label: 'any 断言（as any）', pattern: /\bas\s+any\b/ }
]

function run(raw) {
    let input
    try {
        input = JSON.parse(raw)
    } catch {
        return { exitCode: 0 }
    }

    const filePath = input.tool_input?.file_path
    if (!filePath || !fs.existsSync(filePath)) {
        return { exitCode: 0 }
    }

    const ext = getExtension(filePath)
    const isCode = Boolean(ext) && !/^\.(md|json|txt)$/.test(ext)
    const isTs = TS_EXTENSIONS.has(ext)
    if (!isCode) {
        return { exitCode: 0 }
    }

    let content
    try {
        content = fs.readFileSync(filePath, 'utf8')
    } catch {
        return { exitCode: 0 }
    }

    const hits = []
    for (const rule of FORBIDDEN_PATTERNS) {
        if (rule.label.includes('any') && !isTs) continue
        if (rule.pattern.test(content)) hits.push(rule.label)
    }
    if (hits.length === 0) {
        return { exitCode: 0 }
    }

    return {
        exitCode: 0,
        stderr: `[Hook] 警告: ${filePath} 含禁止模式: ${hits.join('、')}，请按 rules/07-forbidden.md 处理\n`
    }
}

module.exports = { run }

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
