# Session Learning Hook
# 会话结束时检测可学习模式并支持自动提取
# 用法: 由 Claude Code Stop hook 自动调用

param()

# 从 stdin 读取 hook 输入
$input_json = [Console]::In.ReadToEnd()
$hook_input = $input_json | ConvertFrom-Json

$session_id = $hook_input.session_id
$transcript_path = $hook_input.transcript_path

# 配置路径
$skills_dir = "$env:USERPROFILE\.claude\skills\continuous-learning"
$learned_dir = "$env:USERPROFILE\.claude\skills\learned"
$config_path = "$skills_dir\config.json"
$extract_script = "$skills_dir\scripts\extract_patterns.py"

# 确保 learned 目录存在
if (-not (Test-Path $learned_dir)) {
    New-Item -ItemType Directory -Path $learned_dir -Force | Out-Null
}

# 检查会话记录是否存在
if (-not $transcript_path -or -not (Test-Path $transcript_path)) {
    exit 0
}

# 读取会话记录（只读取最后 2000 行以节省内存）
$transcript = Get-Content $transcript_path -Tail 2000 -ErrorAction SilentlyContinue

if (-not $transcript -or $transcript.Count -lt 10) {
    # 会话太短，跳过学习
    exit 0
}

# 加载配置
$config = @{
    min_session_length = 10
    extraction_threshold = "medium"
    auto_approve = $false
}

if (Test-Path $config_path) {
    try {
        $config = Get-Content $config_path -Raw | ConvertFrom-Json
    } catch {
        # 使用默认配置
    }
}

# 模式检测关键词（增强版）
$learning_indicators = @{
    error_resolution = @('error', 'exception', 'failed', 'fix', 'resolved', 'solution')
    user_corrections = @('not', 'wrong', 'should be', 'actually', 'instead')
    debugging = @('debug', 'breakpoint', 'console.log', 'print(', 'trace')
    workarounds = @('workaround', 'hack', 'temporary', 'bypass')
}

$transcript_text = $transcript -join "`n"
$detected_patterns = @{}

foreach ($type in $learning_indicators.Keys) {
    $count = 0
    foreach ($indicator in $learning_indicators[$type]) {
        $matches = [regex]::Matches($transcript_text, [regex]::Escape($indicator), 'IgnoreCase')
        $count += $matches.Count
    }
    if ($count -ge 2) {
        $detected_patterns[$type] = $count
    }
}

# 如果检测到可学习模式
if ($detected_patterns.Count -gt 0) {
    $pattern_summary = ($detected_patterns.Keys | ForEach-Object { "$_($($detected_patterns[$_]))" }) -join ", "
    
    # 检查是否有提取脚本
    $has_extractor = Test-Path $extract_script
    
    $message = "Detected learnable patterns: $pattern_summary."
    $context = "Patterns found in this session:`n"
    
    foreach ($type in $detected_patterns.Keys) {
        $context += "- $type`: $($detected_patterns[$type]) occurrences`n"
    }
    
    if ($has_extractor) {
        $context += "`nUse /learn to extract and save these patterns."
        $context += "`nUse /evolve to combine similar patterns into skills."
    } else {
        $context += "`nExtraction script not found. Consider running /learn manually."
    }
    
    @{
        systemMessage = $message
        additionalContext = $context
    } | ConvertTo-Json -Compress
}

exit 0
