#!/usr/bin/env node
/**
 * Check Code Size Hook
 *
 * 编辑后只检查本次改动的代码文件，正常静默，避免增加上下文噪音。
 */

'use strict'

const fs = require('fs')

const DEFAULT_MAX_LINES = 600
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

function getMaxLines(filePath) {
    return isTestFile(filePath) ? TEST_MAX_LINES : DEFAULT_MAX_LINES
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

    const maxLines = getMaxLines(filePath)
    const lineCount = countLines(content)
    if (lineCount <= maxLines) {
        return { exitCode: 0 }
    }

    return {
        exitCode: 0,
        stderr:
            `[Hook] 代码文件超过 ${maxLines} 行: ` +
            `${filePath} (${lineCount} 行)，请拆分后继续。\n`
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
