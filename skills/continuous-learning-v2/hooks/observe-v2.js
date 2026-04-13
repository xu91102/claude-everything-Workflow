#!/usr/bin/env node
/**
 * Observe Hook v2
 * 
 * 观察工具调用，带详细上下文记录
 * 用于 PreToolUse/PostToolUse hook
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const { execFileSync } = require('child_process')

function getConfig() {
    const configPath = path.join(os.homedir(), '.claude', 'skills', 'continuous-learning-v2', 'config.json')
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'))
    } catch {
        return {
            observation: {
                enabled: true,
                store_path: path.join(os.homedir(), '.claude', 'homunculus', 'observations.jsonl'),
                capture_tools: ['Edit', 'Write', 'Bash', 'Read', 'Grep', 'Glob'],
                ignore_tools: ['TodoWrite']
            }
        }
    }
}

function getObservationsPath(config) {
    const storePath = config.observation?.store_path || '~/.claude/homunculus/observations.jsonl'
    return storePath.replace('~', os.homedir())
}

function ensureDir(filePath) {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}

function compactPayload(value, maxChars) {
    if (value === undefined || value === null) {
        return value
    }

    const serialized = typeof value === 'string'
        ? value
        : JSON.stringify(value)

    if (!serialized || serialized.length <= maxChars) {
        return value
    }

    return {
        truncated: true,
        original_chars: serialized.length,
        preview: serialized.slice(0, maxChars)
    }
}

function getProjectContext(input) {
    const cwd = input.cwd || input.tool_input?.cwd || process.cwd()
    let projectRoot = cwd

    try {
        projectRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
            cwd,
            encoding: 'utf8',
            timeout: 1000,
            windowsHide: true,
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim()
    } catch {
        projectRoot = path.resolve(cwd)
    }

    const projectId = crypto
        .createHash('sha1')
        .update(projectRoot.toLowerCase())
        .digest('hex')
        .slice(0, 12)

    return {
        cwd,
        project_root: projectRoot,
        project_name: path.basename(projectRoot),
        project_id: projectId
    }
}

function shouldCapture(tool, config) {
    const captureTools = config.observation?.capture_tools || []
    const ignoreTools = config.observation?.ignore_tools || []

    if (ignoreTools.includes(tool)) return false
    if (captureTools.length === 0) return true
    return captureTools.includes(tool)
}

async function main() {
    const phase = process.argv[2] // 'pre' or 'post'
    const config = getConfig()

    if (!config.observation?.enabled) {
        process.exit(0)
    }

    let data = ''
    process.stdin.on('data', chunk => {
        data += chunk
    })

    process.stdin.on('end', () => {
        try {
            const input = JSON.parse(data)

            // 检查是否需要捕获此工具
            if (!shouldCapture(input.tool, config)) {
                return
            }

            const observationsPath = getObservationsPath(config)
            ensureDir(observationsPath)

            const observation = {
                timestamp: new Date().toISOString(),
                event: phase === 'pre' ? 'tool_start' : 'tool_complete',
                session_id: input.session_id || process.env.CLAUDE_SESSION_ID,
                ...getProjectContext(input),
                tool: input.tool,
                tool_input: phase === 'pre'
                    ? compactPayload(
                        input.tool_input,
                        config.observation?.max_tool_input_chars || 2000
                    )
                    : undefined,
                tool_output: phase === 'post'
                    ? compactPayload(
                        input.tool_output || '',
                        config.observation?.max_tool_output_chars || 500
                    )
                    : undefined
            }

            // 追加到观察记录
            fs.appendFileSync(
                observationsPath,
                JSON.stringify(observation) + '\n'
            )

        } catch (error) {
            console.error(`[Hook] observe-v2 failed: ${error.message}`)
        }
    })
}

main()
