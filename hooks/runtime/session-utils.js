/**
 * Session Hook 共享工具
 */

'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

function getHomeDir() {
    const explicit = process.env.HOME || process.env.USERPROFILE
    if (explicit && explicit.trim().length > 0) {
        return path.resolve(explicit)
    }
    return os.homedir()
}

function getClaudeDir() {
    return path.join(getHomeDir(), '.claude')
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
    }
    return dirPath
}

function getDateTimeString() {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const h = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    const s = String(now.getSeconds()).padStart(2, '0')
    return `${y}-${m}-${d} ${h}:${min}:${s}`
}

module.exports = {
    ensureDir,
    getClaudeDir,
    getDateTimeString
}
