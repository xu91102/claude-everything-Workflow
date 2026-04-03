/**
 * 跨平台共享工具函数
 * 供 hooks 和 scripts 统一使用
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

// --- 平台检测 ---

const isWindows = process.platform === 'win32'

// --- 路径工具 ---

/**
 * 获取用户 home 目录（跨平台）
 */
function getHomeDir() {
    const explicit = process.env.HOME || process.env.USERPROFILE
    if (explicit && explicit.trim().length > 0) {
        return path.resolve(explicit)
    }
    return os.homedir()
}

/**
 * 获取 Claude 配置根目录
 */
function getClaudeDir() {
    return path.join(getHomeDir(), '.claude')
}

/**
 * 获取直觉目录路径
 * 优先级: customPath > cwd > ~/.claude/
 */
function findInstinctsPath(customPath) {
    if (customPath) {
        const resolved = path.resolve(customPath)
        if (fs.existsSync(resolved)) return resolved
    }

    const cwdPath = path.join(process.cwd(), 'homunculus', 'instincts')
    if (fs.existsSync(cwdPath)) return cwdPath

    return path.join(getClaudeDir(), 'homunculus', 'instincts')
}

/**
 * 获取学习技能目录
 */
function getLearnedSkillsDir() {
    return path.join(getClaudeDir(), 'skills', 'learned')
}

// --- 文件工具 ---

/**
 * 确保目录存在，不存在则递归创建
 * @param {string} dirPath - 要创建的目录路径
 * @returns {string} 该目录路径
 */
function ensureDir(dirPath) {
    try {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true })
        }
    } catch (err) {
        if (err.code !== 'EEXIST') {
            throw new Error(
                `Failed to create directory '${dirPath}': ${err.message}`
            )
        }
    }
    return dirPath
}

/**
 * 扫描直觉目录下的 .md 文件
 * @param {string} basePath - instincts 目录路径
 * @returns {Array<{path: string, category: string}>}
 */
function scanInstinctsDir(basePath) {
    const files = []
    for (const dir of ['personal', 'inherited']) {
        const dirPath = path.join(basePath, dir)
        if (!fs.existsSync(dirPath)) continue

        for (const entry of fs.readdirSync(dirPath)) {
            if (entry.endsWith('.md')) {
                files.push({
                    path: path.join(dirPath, entry),
                    category: dir
                })
            }
        }
    }
    return files
}

/**
 * 获取文件最后修改日期 (YYYY-MM-DD)
 * @param {string} filePath
 * @returns {string|null}
 */
function getFileModifiedDate(filePath) {
    try {
        return fs.statSync(filePath).mtime.toISOString().split('T')[0]
    } catch {
        return null
    }
}

// --- stdin 工具 ---

/**
 * 从 stdin 读取 JSON（含超时防挂起）
 * @param {object} options
 * @param {number} options.timeoutMs - 超时毫秒数（默认 5000）
 * @param {number} options.maxSize - 最大读取字节（默认 1MB）
 * @returns {Promise<object>}
 */
async function readStdinJson(options = {}) {
    const { timeoutMs = 5000, maxSize = 1024 * 1024 } = options

    return new Promise((resolve) => {
        let data = ''
        let settled = false

        const timer = setTimeout(() => {
            if (!settled) {
                settled = true
                process.stdin.removeAllListeners('data')
                process.stdin.removeAllListeners('end')
                process.stdin.removeAllListeners('error')
                if (process.stdin.unref) process.stdin.unref()
                try {
                    resolve(data.trim() ? JSON.parse(data) : {})
                } catch {
                    resolve({})
                }
            }
        }, timeoutMs)

        process.stdin.setEncoding('utf8')
        process.stdin.on('data', chunk => {
            if (data.length < maxSize) {
                data += chunk.substring(0, maxSize - data.length)
            }
        })
        process.stdin.on('end', () => {
            if (!settled) {
                settled = true
                clearTimeout(timer)
                try {
                    resolve(data.trim() ? JSON.parse(data) : {})
                } catch {
                    resolve({})
                }
            }
        })
        process.stdin.on('error', () => {
            if (!settled) {
                settled = true
                clearTimeout(timer)
                resolve({})
            }
        })
    })
}

// --- YAML Frontmatter ---

/**
 * 解析 Markdown 文件的 YAML frontmatter
 * @param {string} content - 文件内容
 * @returns {{ meta: object, body: string }}
 */
function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) return { meta: {}, body: content }

    const meta = {}
    match[1].split(/\r?\n/).forEach(line => {
        const colonIndex = line.indexOf(':')
        if (colonIndex <= 0) return

        const key = line.slice(0, colonIndex).trim()
        let value = line.slice(colonIndex + 1).trim()

        // 移除引号
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1)
        }

        // 解析布尔
        if (value === 'true') { meta[key] = true; return }
        if (value === 'false') { meta[key] = false; return }

        // 解析数字
        if (/^-?\d+\.?\d*$/.test(value)) {
            meta[key] = parseFloat(value)
            return
        }

        meta[key] = value
    })

    return { meta, body: content.slice(match[0].length) }
}

/**
 * 序列化 meta + body 为带 YAML frontmatter 的内容
 * @param {object} meta
 * @param {string} body
 * @returns {string}
 */
function serializeFrontmatter(meta, body) {
    const lines = ['---']

    for (const [key, value] of Object.entries(meta)) {
        if (typeof value === 'number' || typeof value === 'boolean') {
            lines.push(`${key}: ${value}`)
        } else if (typeof value === 'string') {
            if (value.includes(':') || value.includes('#') || value.includes('"')) {
                lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`)
            } else {
                lines.push(`${key}: ${value}`)
            }
        } else {
            lines.push(`${key}: ${value}`)
        }
    }

    lines.push('---')
    return lines.join('\n') + body
}

// --- 日期工具 ---

/**
 * 获取当前日期 YYYY-MM-DD
 */
function getDateString() {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/**
 * 获取当前日期时间 YYYY-MM-DD HH:MM:SS
 */
function getDateTimeString() {
    const now = new Date()
    const date = getDateString()
    const h = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    const s = String(now.getSeconds()).padStart(2, '0')
    return `${date} ${h}:${min}:${s}`
}

// --- 命令行工具 ---

/**
 * 解析命令行中指定 flag 的 string 值
 * @param {string[]} args
 * @param {string} flag
 * @returns {string|null}
 */
function parseStringArg(args, flag) {
    const index = args.indexOf(flag)
    if (index === -1 || !args[index + 1]) return null
    return args[index + 1]
}

/**
 * 解析命令行中指定 flag 的 int 值
 * @param {string[]} args
 * @param {string} flag
 * @param {number} defaultValue
 * @returns {number}
 */
function parseIntArg(args, flag, defaultValue) {
    const index = args.indexOf(flag)
    if (index === -1 || !args[index + 1]) return defaultValue
    const value = parseInt(args[index + 1], 10)
    return isNaN(value) ? defaultValue : value
}

module.exports = {
    isWindows,
    getHomeDir,
    getClaudeDir,
    findInstinctsPath,
    getLearnedSkillsDir,
    ensureDir,
    scanInstinctsDir,
    getFileModifiedDate,
    readStdinJson,
    parseFrontmatter,
    serializeFrontmatter,
    getDateString,
    getDateTimeString,
    parseStringArg,
    parseIntArg
}
