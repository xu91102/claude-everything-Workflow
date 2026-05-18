#!/usr/bin/env node
/**
 * Continuous Learning 项目隔离工具
 */

'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const { execFileSync } = require('child_process')

function expandHome(value) {
    if (!value) return value
    if (value === '~') return os.homedir()
    if (value.startsWith('~/')) {
        return path.join(os.homedir(), value.slice(2))
    }
    return value
}

function getDefaultDataRoot() {
    const xdg = process.env.XDG_DATA_HOME
    if (xdg && xdg.trim()) {
        return path.join(xdg, 'ecc-homunculus')
    }
    return path.join(os.homedir(), '.local', 'share', 'ecc-homunculus')
}

function readJson(filePath, fallback = {}) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'))
    } catch {
        return fallback
    }
}

function writeJson(filePath, value) {
    ensureDir(path.dirname(filePath))
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8')
}

function loadConfig() {
    const cwdConfig = path.join(
        process.cwd(),
        'skills',
        'continuous-learning-v2',
        'config.json'
    )
    const homeConfig = path.join(
        os.homedir(),
        '.claude',
        'skills',
        'continuous-learning-v2',
        'config.json'
    )

    return readJson(fs.existsSync(cwdConfig) ? cwdConfig : homeConfig, {})
}

function getDataRoot(config = loadConfig()) {
    return path.resolve(expandHome(config.homunculus?.data_root) || getDefaultDataRoot())
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true })
    return dirPath
}

function runGit(args, cwd) {
    return execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        timeout: 1000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
}

function getProjectContext(input = {}) {
    const cwd = input.cwd || input.tool_input?.cwd || process.cwd()
    let projectRoot = path.resolve(cwd)
    let remote = null

    try {
        projectRoot = runGit(['rev-parse', '--show-toplevel'], cwd)
    } catch {
        projectRoot = path.resolve(cwd)
    }

    try {
        remote = runGit(['remote', 'get-url', 'origin'], projectRoot)
    } catch {
        remote = null
    }

    const identity = remote || projectRoot.toLowerCase()
    const projectId = crypto
        .createHash('sha1')
        .update(identity)
        .digest('hex')
        .slice(0, 12)

    return {
        cwd: path.resolve(cwd),
        project_root: projectRoot,
        project_name: path.basename(projectRoot),
        project_id: projectId,
        remote
    }
}

function getProjectsRegistryPath(dataRoot) {
    return path.join(dataRoot, 'projects.json')
}

function loadProjects(dataRoot) {
    const registryPath = getProjectsRegistryPath(dataRoot)
    const registry = readJson(registryPath, { projects: {} })
    if (!registry.projects) registry.projects = {}
    return registry
}

function registerProject(dataRoot, context) {
    const registry = loadProjects(dataRoot)
    const now = new Date().toISOString()
    const existing = registry.projects[context.project_id] || {}

    registry.projects[context.project_id] = {
        id: context.project_id,
        name: context.project_name,
        root: context.project_root,
        remote: context.remote,
        first_seen: existing.first_seen || now,
        last_seen: now
    }

    writeJson(getProjectsRegistryPath(dataRoot), registry)
    return registry.projects[context.project_id]
}

function getProjectDir(dataRoot, projectId) {
    return path.join(dataRoot, 'projects', projectId)
}

function getGlobalInstinctsDir(dataRoot) {
    return path.join(dataRoot, 'global', 'instincts')
}

function getProjectInstinctsDir(dataRoot, projectId) {
    return path.join(getProjectDir(dataRoot, projectId), 'instincts')
}

function listMarkdownFiles(dirPath) {
    if (!fs.existsSync(dirPath)) return []
    return fs.readdirSync(dirPath)
        .filter(file => file.endsWith('.md'))
        .map(file => path.join(dirPath, file))
}

function scanInstincts(basePath, scope) {
    const files = []
    for (const category of ['personal', 'inherited']) {
        const dirPath = path.join(basePath, category)
        for (const filePath of listMarkdownFiles(dirPath)) {
            files.push({ path: filePath, category, scope })
        }
    }
    return files
}

function parseFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) return { meta: {}, body: content }

    const meta = {}
    for (const line of match[1].split(/\r?\n/)) {
        const colonIndex = line.indexOf(':')
        if (colonIndex <= 0) continue
        const key = line.slice(0, colonIndex).trim()
        let value = line.slice(colonIndex + 1).trim()
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1)
        }
        if (value === 'true') value = true
        else if (value === 'false') value = false
        else if (/^-?\d+\.?\d*$/.test(String(value))) value = parseFloat(value)
        meta[key] = value
    }

    return { meta, body: content.slice(match[0].length) }
}

module.exports = {
    ensureDir,
    expandHome,
    getDataRoot,
    getDefaultDataRoot,
    getGlobalInstinctsDir,
    getProjectContext,
    getProjectDir,
    getProjectInstinctsDir,
    loadConfig,
    loadProjects,
    parseFrontmatter,
    readJson,
    registerProject,
    scanInstincts,
    writeJson
}
