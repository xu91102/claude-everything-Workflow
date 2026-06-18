#!/usr/bin/env node
/**
 * Evaluate Session Hook
 * 
 * 会话结束时评估是否有可提取的模式
 * 用于 Stop hook
 */

const path = require('path')
const fs = require('fs')
const os = require('os')

function getLearnedSkillsDir() {
    return path.join(os.homedir(), '.claude', 'skills', 'learn')
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}

async function main() {
    // 默认配置
    const minSessionLength = 10
    const learnedSkillsPath = getLearnedSkillsDir()

    // 确保学习技能根目录存在；具体技能保存到分类子目录
    ensureDir(learnedSkillsPath)

    // 获取会话记录路径
    const transcriptPath = process.env.CLAUDE_TRANSCRIPT_PATH

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
        process.exit(0)
    }

    // 计算用户消息数量
    const content = fs.readFileSync(transcriptPath, 'utf8')
    const messageCount = (content.match(/"type":"user"/g) || []).length

    // 当前为占位实现：只统计消息数，不做自动提取。
    // 遵循 rules/common/hooks.md「stdout 默认静默、stderr 只给必要提示」：
    // 不在每次会话结束喷提示行污染 transcript。
    // 短会话直接跳过；长会话保持静默，交给 /learn-eval 手动提取。
    if (messageCount < minSessionLength) {
        process.exit(0)
    }

    process.exit(0)
}

main().catch(err => {
    console.error('[ContinuousLearning] 错误:', err.message)
    process.exit(0)
})
