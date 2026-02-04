#!/usr/bin/env node
/**
 * Decay Confidence Hook
 * 
 * 实现直觉置信度衰减机制
 * 每周无观察，置信度降低 0.02
 * 
 * 用法:
 *   node decay-confidence.js              # 执行衰减
 *   node decay-confidence.js --dry-run    # 预览变更
 *   node decay-confidence.js --path <dir> # 指定直觉目录
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

// 默认配置
const DEFAULT_CONFIG = {
    decayRate: 0.02,
    minConfidence: 0.3
}

/**
 * 解析命令行参数
 */
function parseArgs() {
    const args = process.argv.slice(2)
    const result = {
        dryRun: args.includes('--dry-run'),
        customPath: null
    }

    const pathIndex = args.indexOf('--path')
    if (pathIndex !== -1 && args[pathIndex + 1]) {
        result.customPath = args[pathIndex + 1]
    }

    return result
}

/**
 * 查找直觉目录
 * 优先级: 命令行参数 > 当前目录 > ~/.claude/
 */
function findInstinctsPath(customPath) {
    // 1. 命令行指定的路径
    if (customPath) {
        const resolved = path.resolve(customPath)
        if (fs.existsSync(resolved)) {
            return resolved
        }
    }

    // 2. 当前工作目录下的 homunculus/instincts
    const cwdPath = path.join(process.cwd(), 'homunculus', 'instincts')
    if (fs.existsSync(cwdPath)) {
        return cwdPath
    }

    // 3. 默认 ~/.claude/homunculus/instincts
    const defaultPath = path.join(os.homedir(), '.claude', 'homunculus', 'instincts')
    return defaultPath
}

/**
 * 查找配置文件
 */
function findConfigPath() {
    // 当前目录下的配置
    const cwdConfig = path.join(process.cwd(), 'skills', 'continuous-learning-v2', 'config.json')
    if (fs.existsSync(cwdConfig)) {
        return cwdConfig
    }

    // 默认配置
    return path.join(os.homedir(), '.claude', 'skills', 'continuous-learning-v2', 'config.json')
}

/**
 * 加载配置文件
 */
function loadConfig(customPath) {
    const configPath = findConfigPath()
    const instinctsPath = findInstinctsPath(customPath)

    let config = { ...DEFAULT_CONFIG, instinctsPath }

    try {
        if (fs.existsSync(configPath)) {
            const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
            config.decayRate = fileConfig.instincts?.confidence_decay_rate ?? config.decayRate
            config.minConfidence = fileConfig.instincts?.min_confidence ?? config.minConfidence
        }
    } catch (error) {
        console.error('[Decay] 加载配置失败，使用默认值:', error.message)
    }

    return config
}

/**
 * 解析 YAML frontmatter
 */
function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) return { meta: {}, body: content }

    const yamlContent = match[1]
    const body = content.slice(match[0].length)
    const meta = {}

    // 简单 YAML 解析
    yamlContent.split(/\r?\n/).forEach(line => {
        const colonIndex = line.indexOf(':')
        if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim()
            let value = line.slice(colonIndex + 1).trim()

            // 移除引号
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1)
            }

            // 解析数字
            if (/^-?\d+\.?\d*$/.test(value)) {
                value = parseFloat(value)
            }

            meta[key] = value
        }
    })

    return { meta, body }
}

/**
 * 序列化 YAML frontmatter
 */
function serializeFrontmatter(meta, body) {
    const lines = ['---']

    for (const [key, value] of Object.entries(meta)) {
        if (typeof value === 'number') {
            lines.push(`${key}: ${value}`)
        } else if (typeof value === 'string') {
            // 包含特殊字符时加引号
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

/**
 * 计算衰减周数
 */
function calculateWeeksPassed(lastObserved) {
    if (!lastObserved) return 0

    const lastDate = new Date(lastObserved)
    if (isNaN(lastDate.getTime())) return 0

    const now = new Date()
    const diffMs = now.getTime() - lastDate.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)

    return Math.floor(diffDays / 7)
}

/**
 * 扫描直觉目录
 */
function scanInstinctsDir(basePath) {
    const files = []

    const dirs = ['personal', 'inherited']
    for (const dir of dirs) {
        const dirPath = path.join(basePath, dir)
        if (!fs.existsSync(dirPath)) continue

        const entries = fs.readdirSync(dirPath)
        for (const entry of entries) {
            if (entry.endsWith('.md')) {
                files.push(path.join(dirPath, entry))
            }
        }
    }

    return files
}

/**
 * 获取文件修改时间作为 fallback
 */
function getFileModifiedDate(filePath) {
    try {
        const stats = fs.statSync(filePath)
        return stats.mtime.toISOString().split('T')[0]
    } catch {
        return null
    }
}

/**
 * 处理单个直觉文件
 */
function processInstinctFile(filePath, config, dryRun) {
    const content = fs.readFileSync(filePath, 'utf8')
    const { meta, body } = parseFrontmatter(content)

    // 获取当前置信度
    const currentConfidence = typeof meta.confidence === 'number'
        ? meta.confidence
        : parseFloat(meta.confidence) || 0.5

    // 获取上次观察日期（fallback 到文件修改时间）
    const lastObserved = meta.lastObserved || getFileModifiedDate(filePath)

    // 计算衰减周数
    const weeksPassed = calculateWeeksPassed(lastObserved)

    // 计算新置信度
    const decay = weeksPassed * config.decayRate
    const newConfidence = Math.max(
        config.minConfidence,
        Math.round((currentConfidence - decay) * 100) / 100
    )

    // 如果没有变化，跳过
    if (newConfidence === currentConfidence && meta.lastDecayCheck) {
        return null
    }

    const result = {
        file: path.basename(filePath),
        id: meta.id || path.basename(filePath, '.md'),
        oldConfidence: currentConfidence,
        newConfidence: newConfidence,
        weeksPassed: weeksPassed,
        decay: Math.round(decay * 100) / 100
    }

    if (!dryRun && (newConfidence !== currentConfidence || !meta.lastDecayCheck)) {
        // 更新 meta
        meta.confidence = newConfidence
        meta.lastDecayCheck = new Date().toISOString().split('T')[0]
        if (!meta.lastObserved) {
            meta.lastObserved = lastObserved
        }

        // 写入文件
        const newContent = serializeFrontmatter(meta, body)
        fs.writeFileSync(filePath, newContent, 'utf8')
        result.updated = true
    }

    return result
}

/**
 * 主函数
 */
function main() {
    const { dryRun, customPath } = parseArgs()

    console.log('[Decay] 置信度衰减检查')
    console.log(`[Decay] 模式: ${dryRun ? 'DRY-RUN (预览)' : '执行更新'}`)
    console.log('')

    const config = loadConfig(customPath)
    console.log(`[Decay] 直觉目录: ${config.instinctsPath}`)
    console.log(`[Decay] 衰减率: ${config.decayRate}/周`)
    console.log(`[Decay] 最低置信度: ${config.minConfidence}`)
    console.log('')

    const files = scanInstinctsDir(config.instinctsPath)

    if (files.length === 0) {
        console.log('[Decay] 未找到直觉文件')
        return
    }

    console.log(`[Decay] 扫描到 ${files.length} 个直觉文件`)
    console.log('')

    const results = []

    for (const file of files) {
        try {
            const result = processInstinctFile(file, config, dryRun)
            if (result) {
                results.push(result)
            }
        } catch (error) {
            console.error(`[Decay] 处理 ${path.basename(file)} 失败:`, error.message)
        }
    }

    if (results.length === 0) {
        console.log('[Decay] 所有直觉置信度均为最新')
        return
    }

    // 输出结果表格
    console.log('变更摘要:')
    console.log('| 直觉 | 原置信度 | 新置信度 | 周数 | 衰减 |')
    console.log('|------|----------|----------|------|------|')

    for (const r of results) {
        const status = r.updated ? ' (已更新)' : ''
        console.log(`| ${r.id} | ${r.oldConfidence} | ${r.newConfidence} | ${r.weeksPassed} | -${r.decay}${status} |`)
    }

    console.log('')

    const updated = results.filter(r => r.updated).length
    const decayed = results.filter(r => r.oldConfidence !== r.newConfidence).length

    if (dryRun) {
        console.log(`[Decay] 预览: ${decayed} 个直觉将被衰减`)
        console.log('[Decay] 使用 node decay-confidence.js 执行更新')
    } else {
        console.log(`[Decay] 完成: 更新了 ${updated} 个直觉文件`)
    }
}

main()
