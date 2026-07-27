#!/usr/bin/env node
/**
 * Check Code Size Hook
 *
 * 编辑后只检查本次改动的代码文件，正常静默，避免增加上下文噪音。
 */

'use strict'

const fs = require('fs')

const CODE_TARGET_LINES = 800
const TEST_MAX_LINES = 1000
const CODE_EXTENSIONS = new Set([
    '.c',
    '.cc',
    '.cpp',
    '.cs',
    '.css',
    '.go',
    '.h',
    '.hpp',
    '.html',
    '.java',
    '.js',
    '.jsx',
    '.kt',
    '.lua',
    '.mjs',
    '.php',
    '.py',
    '.rb',
    '.rs',
    '.sh',
    '.swift',
    '.ts',
    '.tsx',
    '.vue'
])

function getExtension(filePath) {
    const match = filePath.match(/(\.[^.\\/]+)$/)
    return match ? match[1].toLowerCase() : ''
}

function isCodeFile(filePath) {
    return CODE_EXTENSIONS.has(getExtension(filePath))
}

function isTestFile(filePath) {
    return /(^|[\\/])__tests__([\\/]|$)/.test(filePath) ||
        /\.(test|spec)\.[^.\\/]+$/.test(filePath)
}

function getLineThreshold(filePath) {
    return isTestFile(filePath) ? TEST_MAX_LINES : CODE_TARGET_LINES
}

function countLines(content) {
    if (content.length === 0) return 0
    const lines = content.split(/\r?\n/)
    return content.endsWith('\n') ? lines.length - 1 : lines.length
}

function run(raw) {
    let input
    try {
        input = JSON.parse(raw)
    } catch {
        return { exitCode: 0 }
    }

    const filePath = input.tool_input?.file_path
    if (!filePath || !isCodeFile(filePath) || !fs.existsSync(filePath)) {
        return { exitCode: 0 }
    }

    let content
    try {
        content = fs.readFileSync(filePath, 'utf8')
    } catch {
        return { exitCode: 0 }
    }

    const testFile = isTestFile(filePath)
    const lineThreshold = getLineThreshold(filePath)
    const lineCount = countLines(content)
    if (lineCount <= lineThreshold) {
        return { exitCode: 0 }
    }

    const message = testFile
        ? `[Hook] 测试文件超过 ${lineThreshold} 行上限: ` +
            `${filePath} (${lineCount} 行)，请拆分测试场景后继续。\n`
        : `[Hook] 代码文件超过约 ${lineThreshold} 行的参考值: ` +
            `${filePath} (${lineCount} 行)，请评估是否需要按职责拆分。\n`

    return { exitCode: 0, stderr: message }
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
