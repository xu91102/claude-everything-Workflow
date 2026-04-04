#!/usr/bin/env node
/**
 * PreCompact Hook
 *
 * 在上下文压缩前保存关键信息
 * 用于 PreCompact hook
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

function getCompactLogPath() {
    const claudeDir = path.join(os.homedir(), '.claude')
    return path.join(claudeDir, 'compact-history.jsonl')
}

function ensureDir(filePath) {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}

async function main() {
    let data = ''

    process.stdin.on('data', chunk => {
        data += chunk
    })

    process.stdin.on('end', () => {
        try {
            const input = JSON.parse(data)

            // 记录压缩事件
            const compactLog = {
                timestamp: new Date().toISOString(),
                session_id: input.session_id,
                context_size: input.context_size || 'unknown',
                message_count: input.message_count || 'unknown'
            }

            const logPath = getCompactLogPath()
            ensureDir(logPath)

            fs.appendFileSync(logPath, JSON.stringify(compactLog) + '\n')

            // 提示用户
            console.error('[PreCompact] 上下文即将压缩，关键信息已保存')
            console.error(`[PreCompact] 当前消息数: ${compactLog.message_count}`)

            // 透传原始数据
            console.log(data)
        } catch (error) {
            // 出错时透传原始数据
            console.log(data)
        }
    })
}

main()
