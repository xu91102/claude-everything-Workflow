#!/usr/bin/env node
/**
 * Session Start Hook
 *
 * 会话启动时加载上次上下文
 * 用于 SessionStart 或手动调用
 */

'use strict'

const fs = require('fs')
const path = require('path')

function getSessionDir() {
    const utils = require('../lib/utils')
    return path.join(utils.getClaudeDir(), 'session-data')
}

function run() {
    const sessionDir = getSessionDir()
    const stateFile = path.join(sessionDir, 'last-state.json')

    if (!fs.existsSync(stateFile)) {
        process.stderr.write(
            '[Session] 无上次会话状态，以全新会话启动\n'
        )
        return
    }

    try {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
        const parts = []

        if (state.project) {
            parts.push(`项目: ${state.project}`)
        }
        if (state.lastActive) {
            parts.push(`上次活动: ${state.lastActive}`)
        }
        if (state.pendingTasks && state.pendingTasks.length > 0) {
            parts.push(`待处理: ${state.pendingTasks.join(', ')}`)
        }

        if (parts.length > 0) {
            process.stderr.write(
                `[Session] 恢复上下文 - ${parts.join(' | ')}\n`
            )
        }
    } catch (err) {
        process.stderr.write(
            `[Session] 加载上次状态失败: ${err.message}\n`
        )
    }
}

module.exports = { run }

if (require.main === module) {
    run()
}
