#!/usr/bin/env node
/**
 * Hook 运行时控制器
 *
 * 根据 Hook Profile 决定是否执行目标脚本
 * 支持 require() 直接加载（省去子进程开销）和 legacy spawnSync 两种模式
 *
 * 用法:
 *   node run-with-flags.js <hookId> <scriptRelativePath> [profilesCsv] [...scriptArgs]
 */

'use strict'

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { isHookEnabled } = require('../lib/hook-flags')

const MAX_STDIN = 1024 * 1024

function readStdinRaw() {
    return new Promise(resolve => {
        let raw = ''
        let truncated = false
        process.stdin.setEncoding('utf8')

        process.stdin.on('data', chunk => {
            if (raw.length < MAX_STDIN) {
                const remaining = MAX_STDIN - raw.length
                raw += chunk.substring(0, remaining)
                if (chunk.length > remaining) truncated = true
            } else {
                truncated = true
            }
        })

        process.stdin.on('end', () => resolve({ raw, truncated }))
        process.stdin.on('error', () => resolve({ raw, truncated }))
    })
}

function getPluginRoot() {
    if (process.env.CLAUDE_PLUGIN_ROOT) {
        return process.env.CLAUDE_PLUGIN_ROOT
    }
    return path.resolve(__dirname, '..', '..')
}

async function main() {
    const [, , hookId, relScriptPath, profilesCsv, ...scriptArgs] = process.argv
    const { raw } = await readStdinRaw()

    if (!hookId || !relScriptPath) {
        process.exit(0)
    }

    // Profile 检查
    if (!isHookEnabled(hookId, { profiles: profilesCsv })) {
        process.exit(0)
    }

    const pluginRoot = getPluginRoot()
    const resolvedRoot = path.resolve(pluginRoot)
    const scriptPath = path.resolve(pluginRoot, relScriptPath)

    // 路径遍历安全校验
    if (!scriptPath.startsWith(resolvedRoot + path.sep)) {
        process.stderr.write(
            `[Hook] Path traversal rejected: ${hookId}\n`
        )
        process.exit(0)
    }

    if (!fs.existsSync(scriptPath)) {
        process.stderr.write(
            `[Hook] Script not found for ${hookId}: ${scriptPath}\n`
        )
        process.exit(0)
    }

    // 优先尝试 require() 直接加载（性能优化）
    const src = fs.readFileSync(scriptPath, 'utf8')
    const hasRunExport = /\bmodule\.exports\b/.test(src)
        && /\brun\b/.test(src)

    if (hasRunExport) {
        try {
            const hookModule = require(scriptPath)
            if (typeof hookModule.run === 'function') {
                const output = hookModule.run(raw, { hookId, scriptArgs })
                if (typeof output === 'string') {
                    process.stdout.write(output)
                }
                process.exit(0)
            }
        } catch (err) {
            process.stderr.write(
                `[Hook] require() failed for ${hookId}: ${err.message}\n`
            )
        }
    }

    // Fallback: spawnSync 子进程执行
    const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
        input: raw,
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 30000
    })

    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)

    const exitCode = Number.isInteger(result.status) ? result.status : 0
    process.exit(exitCode)
}

main().catch(err => {
    process.stderr.write(`[Hook] run-with-flags error: ${err.message}\n`)
    process.exit(0)
})
