#!/usr/bin/env node
/**
 * Check Console Log Hook
 * 
 * 在代码编辑后检测 console.log
 * 用于 PostToolUse hook
 */

const fs = require('fs')

function main() {
    let data = ''

    process.stdin.on('data', chunk => {
        data += chunk
    })

    process.stdin.on('end', () => {
        try {
            const input = JSON.parse(data)
            const filePath = input.tool_input?.file_path

            if (filePath && fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8')

                if (/console\.log/.test(content)) {
                    console.error('[Hook] 警告: 发现 console.log，请在提交前移除')
                }
            }

        } catch (error) {
            console.error(`[Hook] console.log 检查失败: ${error.message}`)
        }
    })
}

main()
