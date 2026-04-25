#!/usr/bin/env node
/**
 * Session End Hook
 *
 * 会话结束时持久化状态
 * 用于 SessionEnd hook 或手动调用
 */

'use strict'

const fs = require('fs')
const path = require('path')

function getSessionDir() {
    const utils = require('../lib/utils')
    return utils.ensureDir(
        path.join(utils.getClaudeDir(), 'session-data')
    )
}

function getProjectName() {
    try {
        const { execSync } = require('child_process')
        const toplevel = execSync('git rev-parse --show-toplevel', {
            encoding: 'utf8',
            timeout: 5000
        }).trim()
        return path.basename(toplevel)
    } catch {
        return path.basename(process.cwd()) || 'unknown'
    }
}

function run() {
    const sessionDir = getSessionDir()
    const stateFile = path.join(sessionDir, 'last-state.json')

    const utils = require('../lib/utils')
    const state = {
        project: getProjectName(),
        lastActive: utils.getDateTimeString(),
        cwd: process.cwd(),
        sessionId: process.env.CLAUDE_SESSION_ID || null
    }

    try {
        fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8')
        process.stderr.write(
            `[Session] 状态已保存: ${stateFile}\n`
        )
    } catch (err) {
        process.stderr.write(
            `[Session] 保存状态失败: ${err.message}\n`
        )
    }
}

module.exports = { run }

if (require.main === module) {
    run()
}
