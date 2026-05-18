#!/usr/bin/env node
/**
 * 将旧 ~/.claude/homunculus 结构迁移到 project/global 分层数据根目录
 */

'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')
const {
    ensureDir,
    getDataRoot,
    getGlobalInstinctsDir,
    getProjectContext,
    getProjectInstinctsDir,
    loadConfig,
    registerProject
} = require('./project-utils')

function parseArgs() {
    const args = process.argv.slice(2)
    return {
        apply: args.includes('--apply'),
        dryRun: args.includes('--dry-run') || !args.includes('--apply'),
        scope: parseStringArg(args, '--scope') || 'project',
        source: parseStringArg(args, '--source') ||
            path.join(os.homedir(), '.claude', 'homunculus', 'instincts')
    }
}

function parseStringArg(args, flag) {
    const index = args.indexOf(flag)
    if (index === -1 || !args[index + 1]) return null
    return args[index + 1]
}

function copyDirPreview(sourceRoot, destinationRoot, apply) {
    const operations = []
    for (const category of ['personal', 'inherited']) {
        const sourceDir = path.join(sourceRoot, category)
        if (!fs.existsSync(sourceDir)) continue
        for (const file of fs.readdirSync(sourceDir)) {
            if (!file.endsWith('.md')) continue
            const source = path.join(sourceDir, file)
            const destination = path.join(destinationRoot, category, file)
            operations.push({ source, destination, exists: fs.existsSync(destination) })
            if (apply && !fs.existsSync(destination)) {
                ensureDir(path.dirname(destination))
                fs.copyFileSync(source, destination)
            }
        }
    }
    return operations
}

function main() {
    const options = parseArgs()
    const config = loadConfig()
    const dataRoot = getDataRoot(config)
    const context = getProjectContext({ cwd: process.cwd() })
    const destinationRoot = options.scope === 'global'
        ? getGlobalInstinctsDir(dataRoot)
        : getProjectInstinctsDir(dataRoot, context.project_id)

    if (options.scope !== 'global') {
        registerProject(dataRoot, context)
    }

    const operations = copyDirPreview(options.source, destinationRoot, options.apply)

    console.log(options.apply ? '[Migrate] 已应用迁移' : '[Migrate] dry-run 预览')
    console.log(`[Migrate] 源目录: ${options.source}`)
    console.log(`[Migrate] 目标目录: ${destinationRoot}`)
    console.log(`[Migrate] 范围: ${options.scope}`)
    console.log('')

    if (operations.length === 0) {
        console.log('[Migrate] 没有找到可迁移的直觉文件。')
        return
    }

    console.log('| 源文件 | 状态 | 目标 |')
    console.log('|--------|------|------|')
    for (const operation of operations) {
        const status = operation.exists
            ? '已存在，跳过'
            : options.apply ? '已复制' : '将复制'
        console.log(`| ${operation.source} | ${status} | ${operation.destination} |`)
    }
}

main()
