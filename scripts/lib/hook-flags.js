/**
 * Hook Profile 标志控制
 * 通过环境变量控制 Hook 启用/禁用
 *
 * 环境变量:
 *   ECC_HOOK_PROFILE   - minimal | standard | strict (默认: standard)
 *   ECC_DISABLED_HOOKS - 逗号分隔的 Hook ID 列表
 */

'use strict'

/**
 * 检查指定 Hook 是否启用
 * @param {string} hookId - Hook 唯一标识 (如 "pre:bash:commit-quality")
 * @param {object} options
 * @param {string} options.profiles - 逗号分隔的允许 Profile 列表
 * @returns {boolean}
 */
function isHookEnabled(hookId, options = {}) {
    // 检查是否被显式禁用
    const disabled = (process.env.ECC_DISABLED_HOOKS || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)

    if (disabled.includes(hookId)) {
        return false
    }

    // 检查 Profile 匹配
    const { profiles = 'standard,strict' } = options
    const allowedProfiles = profiles.split(',').map(s => s.trim())
    const currentProfile = (
        process.env.ECC_HOOK_PROFILE || 'standard'
    ).trim().toLowerCase()

    return allowedProfiles.includes(currentProfile)
}

module.exports = { isHookEnabled }
