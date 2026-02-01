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
    return path.join(os.homedir(), '.claude', 'skills', 'learned')
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

    // 确保目录存在
    ensureDir(learnedSkillsPath)

    // 获取会话记录路径
    const transcriptPath = process.env.CLAUDE_TRANSCRIPT_PATH

    if (!transcriptPath || !fs.existsSync(transcriptPath)) {
        process.exit(0)
    }

    // 计算用户消息数量
    const content = fs.readFileSync(transcriptPath, 'utf8')
    const messageCount = (content.match(/"type":"user"/g) || []).length

    // 跳过短会话
    if (messageCount < minSessionLength) {
        console.error(`[ContinuousLearning] 会话过短 (${messageCount} 消息)，跳过`)
        process.exit(0)
    }

    // 提示开始评估
    console.error(`[ContinuousLearning] 会话有 ${messageCount} 消息 - 评估可提取模式`)
    console.error(`[ContinuousLearning] 保存技能到: ${learnedSkillsPath}`)
    console.error('[ContinuousLearning] 提示: 使用 /learn 手动提取有价值的模式')

    process.exit(0)
}

main().catch(err => {
    console.error('[ContinuousLearning] 错误:', err.message)
    process.exit(0)
})
