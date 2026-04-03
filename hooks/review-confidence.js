#!/usr/bin/env node
/**
 * Review Confidence
 *
 * 置信度审查工具 - 生成直觉健康报告，帮助用户识别需关注的直觉
 * 不自动修改任何置信度值，所有变更由用户决策驱动
 *
 * 用法:
 *   node review-confidence.js              # 生成审查报告
 *   node review-confidence.js --stale 30   # 自定义过期天数
 *   node review-confidence.js --json       # JSON 格式输出
 *   node review-confidence.js --help       # 显示帮助
 *   node review-confidence.js --path <dir> # 指定直觉目录
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const DEFAULT_STALE_DAYS = 30

// --- 命令行解析 ---

function parseArgs() {
    const args = process.argv.slice(2)

    if (args.includes('--help')) {
        printHelp()
        process.exit(0)
    }

    return {
        staleDays: parseIntArg(args, '--stale', DEFAULT_STALE_DAYS),
        jsonOutput: args.includes('--json'),
        customPath: parseStringArg(args, '--path')
    }
}

function parseIntArg(args, flag, defaultValue) {
    const index = args.indexOf(flag)
    if (index === -1 || !args[index + 1]) return defaultValue
    const value = parseInt(args[index + 1], 10)
    return isNaN(value) ? defaultValue : value
}

function parseStringArg(args, flag) {
    const index = args.indexOf(flag)
    if (index === -1 || !args[index + 1]) return null
    return args[index + 1]
}

function printHelp() {
    console.log(`
置信度审查工具 - 生成直觉健康报告

用法:
  node review-confidence.js [选项]

选项:
  --stale <天数>   过期阈值天数 (默认: ${DEFAULT_STALE_DAYS})
  --json           JSON 格式输出
  --path <目录>    指定直觉目录
  --help           显示帮助

报告分类:
  [活跃]     最近有观察记录，置信度有证据支持
  [待审查]   超过阈值天数未被观察，建议用户验证
  [低证据]   置信度较低且缺乏充分证据

注意: 此工具只生成报告，不会修改任何文件的置信度值。
`.trim())
}

// --- 路径查找 ---

function findInstinctsPath(customPath) {
    if (customPath) {
        const resolved = path.resolve(customPath)
        if (fs.existsSync(resolved)) return resolved
    }

    const cwdPath = path.join(process.cwd(), 'homunculus', 'instincts')
    if (fs.existsSync(cwdPath)) return cwdPath

    return path.join(os.homedir(), '.claude', 'homunculus', 'instincts')
}

function findConfig() {
    const cwdConfig = path.join(
        process.cwd(), 'skills', 'continuous-learning-v2', 'config.json'
    )
    if (fs.existsSync(cwdConfig)) return cwdConfig

    return path.join(
        os.homedir(), '.claude', 'skills',
        'continuous-learning-v2', 'config.json'
    )
}

function loadStaleDays(cliValue) {
    if (cliValue !== DEFAULT_STALE_DAYS) return cliValue

    try {
        const configPath = findConfig()
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
            return config.instincts?.stale_threshold_days ?? cliValue
        }
    } catch {
        // 配置加载失败时使用 CLI 传入值
    }
    return cliValue
}

// --- YAML Frontmatter 解析 ---

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

        // 解析数字
        if (/^-?\d+\.?\d*$/.test(value)) {
            value = parseFloat(value)
        }

        meta[key] = value
    })

    return { meta, body: content.slice(match[0].length) }
}

// --- 文件扫描 ---

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

// --- 直觉分析 ---

/**
 * 计算自上次观察以来的天数
 */
function daysSinceLastObserved(lastObserved, filePath) {
    const dateStr = lastObserved || getFileModifiedDate(filePath)
    if (!dateStr) return null

    const lastDate = new Date(dateStr)
    if (isNaN(lastDate.getTime())) return null

    const diffMs = Date.now() - lastDate.getTime()
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

function getFileModifiedDate(filePath) {
    try {
        return fs.statSync(filePath).mtime.toISOString().split('T')[0]
    } catch {
        return null
    }
}

/**
 * 分析单个直觉文件，生成审查条目
 */
function analyzeInstinct(fileInfo, staleDays) {
    const content = fs.readFileSync(fileInfo.path, 'utf8')
    const { meta } = parseFrontmatter(content)

    const confidence = typeof meta.confidence === 'number'
        ? meta.confidence
        : parseFloat(meta.confidence) || 0.5

    const daysSince = daysSinceLastObserved(meta.lastObserved, fileInfo.path)
    const status = classifyStatus(confidence, daysSince, staleDays)

    return {
        id: meta.id || path.basename(fileInfo.path, '.md'),
        file: path.basename(fileInfo.path),
        category: fileInfo.category,
        confidence,
        domain: meta.domain || 'unknown',
        lastObserved: meta.lastObserved || 'N/A',
        daysSinceObserved: daysSince,
        status,
        suggestion: getSuggestion(status, confidence, daysSince)
    }
}

/**
 * 根据证据对直觉进行分类
 */
function classifyStatus(confidence, daysSince, staleDays) {
    if (daysSince !== null && daysSince <= staleDays) {
        return 'active'
    }
    if (confidence <= 0.3) {
        return 'low-evidence'
    }
    if (daysSince !== null && daysSince > staleDays) {
        return 'stale'
    }
    return 'active'
}

/**
 * 根据状态生成操作建议
 */
function getSuggestion(status, confidence, daysSince) {
    switch (status) {
        case 'active':
            return '保持现状，置信度有近期证据支持'
        case 'stale':
            if (confidence >= 0.7) {
                return `${daysSince} 天未观察，但置信度高 - 建议人工确认是否仍适用`
            }
            return `${daysSince} 天未观察 - 建议验证或考虑移除`
        case 'low-evidence':
            return '证据不足，建议在实践中验证后再决定保留或移除'
        default:
            return '请人工评估'
    }
}

// --- 报告输出 ---

function printTextReport(results, staleDays) {
    const grouped = {
        active: results.filter(r => r.status === 'active'),
        stale: results.filter(r => r.status === 'stale'),
        'low-evidence': results.filter(r => r.status === 'low-evidence')
    }

    console.log('[Review] 置信度审查报告')
    console.log(`[Review] 过期阈值: ${staleDays} 天`)
    console.log(`[Review] 扫描直觉: ${results.length} 个`)
    console.log('')

    printSection('活跃', grouped.active, '近期有观察证据')
    printSection('待审查', grouped.stale, '超过阈值天数未观察')
    printSection('低证据', grouped['low-evidence'], '置信度低且缺乏证据')

    console.log('---')
    console.log(
        `[Review] 总结: ${grouped.active.length} 活跃, ` +
        `${grouped.stale.length} 待审查, ` +
        `${grouped['low-evidence'].length} 低证据`
    )

    if (grouped.stale.length > 0 || grouped['low-evidence'].length > 0) {
        console.log('')
        console.log(
            '[Review] 提示: 使用 /instinct-status 查看详情，' +
            '手动决定是否保留、更新或移除'
        )
    }

    console.log('')
    console.log('[Review] 注意: 此报告不会修改任何文件。')
}

function printSection(label, items, description) {
    if (items.length === 0) return

    console.log(`## ${label} (${items.length}) - ${description}`)
    console.log('')
    console.log('| 直觉 | 置信度 | 领域 | 最后观察 | 建议 |')
    console.log('|------|--------|------|----------|------|')

    for (const item of items) {
        console.log(
            `| ${item.id} | ${item.confidence} | ` +
            `${item.domain} | ${item.lastObserved} | ` +
            `${item.suggestion} |`
        )
    }
    console.log('')
}

function printJsonReport(results, staleDays) {
    const report = {
        generated: new Date().toISOString(),
        staleThresholdDays: staleDays,
        totalInstincts: results.length,
        summary: {
            active: results.filter(r => r.status === 'active').length,
            stale: results.filter(r => r.status === 'stale').length,
            lowEvidence: results.filter(r => r.status === 'low-evidence').length
        },
        instincts: results,
        note: '此报告不会修改任何文件的置信度值'
    }
    console.log(JSON.stringify(report, null, 2))
}

// --- 主函数 ---

function main() {
    const { staleDays: cliStaleDays, jsonOutput, customPath } = parseArgs()
    const staleDays = loadStaleDays(cliStaleDays)
    const instinctsPath = findInstinctsPath(customPath)

    if (!jsonOutput) {
        console.log(`[Review] 直觉目录: ${instinctsPath}`)
        console.log('')
    }

    const files = scanInstinctsDir(instinctsPath)

    if (files.length === 0) {
        if (jsonOutput) {
            printJsonReport([], staleDays)
        } else {
            console.log('[Review] 未找到直觉文件')
        }
        return
    }

    const results = []
    for (const fileInfo of files) {
        try {
            results.push(analyzeInstinct(fileInfo, staleDays))
        } catch (error) {
            console.error(
                `[Review] 分析 ${path.basename(fileInfo.path)} 失败:`,
                error.message
            )
        }
    }

    if (jsonOutput) {
        printJsonReport(results, staleDays)
    } else {
        printTextReport(results, staleDays)
    }
}

main()
