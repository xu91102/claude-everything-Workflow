#!/usr/bin/env node
/**
 * 预览或执行 project instinct -> global instinct 推广
 */

'use strict'

const fs = require('fs')
const path = require('path')
const {
    ensureDir,
    getDataRoot,
    getGlobalInstinctsDir,
    getProjectContext,
    getProjectInstinctsDir,
    loadConfig,
    parseFrontmatter,
    scanInstincts,
    shouldApply
} = require('./project-utils')

function parseConfidence(value) {
    if (typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) {
        value = Number(value)
    }
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined
}

function parseArgs() {
    const args = process.argv.slice(2)
    const apply = shouldApply(args)
    const flag = '--min-confidence'
    const thresholds = args.filter(arg => arg === flag || arg.startsWith(`${flag}=`))
    const raw = thresholds[0] === flag ? args[args.indexOf(flag) + 1] : thresholds[0]?.slice(flag.length + 1)
    const minConfidence = thresholds.length === 0 ? 0.7 : parseConfidence(raw)
    if (thresholds.length > 1 || minConfidence === undefined) {
        throw new Error('--min-confidence requires a single number between 0 and 1')
    }
    return {
        apply,
        projectId: parseStringArg(args, '--project-id'),
        minConfidence
    }
}

function parseStringArg(args, flag) {
    const index = args.indexOf(flag)
    if (index === -1 || !args[index + 1]) return null
    return args[index + 1]
}

function candidateSlug(filePath) {
    return path.basename(filePath)
}

function main() {
    const options = parseArgs()
    const config = loadConfig()
    const dataRoot = getDataRoot(config)
    const projectId = options.projectId || getProjectContext({ cwd: process.cwd() }).project_id
    const projectInstinctsDir = getProjectInstinctsDir(dataRoot, projectId)
    const globalInstinctsDir = getGlobalInstinctsDir(dataRoot)
    const files = scanInstincts(projectInstinctsDir, 'project')

    const candidates = []
    for (const fileInfo of files) {
        const content = fs.readFileSync(fileInfo.path, 'utf8')
        const { meta } = parseFrontmatter(content)
        const confidence = parseConfidence(meta.confidence)
        if (confidence === undefined || confidence < options.minConfidence) continue

        const destination = path.join(globalInstinctsDir, fileInfo.category, candidateSlug(fileInfo.path))
        candidates.push({
            id: meta.id || path.basename(fileInfo.path, '.md'),
            confidence,
            source: fileInfo.path,
            destination,
            exists: fs.existsSync(destination)
        })

        if (options.apply && !fs.existsSync(destination)) {
            ensureDir(path.dirname(destination))
            fs.copyFileSync(fileInfo.path, destination)
        }
    }

    console.log(options.apply ? '[Promote] 已应用推广' : '[Promote] dry-run 预览')
    console.log(`[Promote] 项目: ${projectId}`)
    console.log(`[Promote] 最小置信度: ${options.minConfidence}`)
    console.log('')

    if (candidates.length === 0) {
        console.log('[Promote] 没有符合条件的候选。')
        return
    }

    console.log('| 直觉 | 置信度 | 状态 | 目标 |')
    console.log('|------|--------|------|------|')
    for (const candidate of candidates) {
        const status = candidate.exists
            ? '已存在，跳过'
            : options.apply ? '已复制' : '将复制'
        console.log(
            `| ${candidate.id} | ${candidate.confidence} | ` +
            `${status} | ${candidate.destination} |`
        )
    }
}

try {
    main()
} catch (error) {
    console.error(`[Promote] ${error.message}`)
    process.exitCode = 1
}
