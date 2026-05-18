#!/usr/bin/env node
/**
 * 列出 Continuous Learning 项目注册表
 */

'use strict'

const {
    getDataRoot,
    getProjectContext,
    loadConfig,
    loadProjects,
    registerProject
} = require('./project-utils')

function parseArgs() {
    const args = process.argv.slice(2)
    return {
        json: args.includes('--json'),
        registerCurrent: args.includes('--register-current')
    }
}

function main() {
    const options = parseArgs()
    const config = loadConfig()
    const dataRoot = getDataRoot(config)

    if (options.registerCurrent) {
        registerProject(dataRoot, getProjectContext({ cwd: process.cwd() }))
    }

    const projects = Object.values(loadProjects(dataRoot).projects || {})
        .sort((a, b) => String(b.last_seen).localeCompare(String(a.last_seen)))

    if (options.json) {
        console.log(JSON.stringify({ dataRoot, projects }, null, 2))
        return
    }

    console.log(`[Projects] 数据根目录: ${dataRoot}`)
    console.log(`[Projects] 项目数量: ${projects.length}`)
    console.log('')

    if (projects.length === 0) {
        console.log('[Projects] 未注册项目。运行一次观察 Hook 或使用 --register-current。')
        return
    }

    console.log('| ID | 名称 | 最近观察 | 路径 |')
    console.log('|----|------|----------|------|')
    for (const project of projects) {
        console.log(
            `| ${project.id} | ${project.name} | ` +
            `${project.last_seen || 'N/A'} | ${project.root || 'N/A'} |`
        )
    }
}

main()
