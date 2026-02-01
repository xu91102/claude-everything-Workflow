#!/bin/bash
#
# start-observer.sh - 启动 Observer Agent
#
# 后台运行的观察代理，定期分析会话观察数据，
# 检测模式并创建直觉。
#

set -e

# 配置
CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
OBSERVATIONS_FILE="$CLAUDE_HOME/homunculus/observations.jsonl"
INSTINCTS_DIR="$CLAUDE_HOME/homunculus/instincts/personal"
CONFIG_FILE="$CLAUDE_HOME/skills/continuous-learning-v2/config.json"
LOG_FILE="$CLAUDE_HOME/homunculus/observer.log"
PID_FILE="$CLAUDE_HOME/homunculus/observer.pid"

# 默认配置
INTERVAL_MINUTES=5
MIN_OBSERVATIONS=20

# 确保目录存在
mkdir -p "$INSTINCTS_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

# 读取配置
if [ -f "$CONFIG_FILE" ]; then
    INTERVAL_MINUTES=$(jq -r '.observer.run_interval_minutes // 5' "$CONFIG_FILE")
    MIN_OBSERVATIONS=$(jq -r '.observer.min_observations_to_analyze // 20' "$CONFIG_FILE")
fi

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

check_observations() {
    if [ -f "$OBSERVATIONS_FILE" ]; then
        wc -l < "$OBSERVATIONS_FILE"
    else
        echo 0
    fi
}

analyze_patterns() {
    log "开始分析模式..."
    
    # 这里应该调用 Claude API (Haiku) 进行分析
    # 由于需要 API 密钥，这里只是示例
    
    OBSERVATION_COUNT=$(check_observations)
    log "观察数量: $OBSERVATION_COUNT"
    
    if [ "$OBSERVATION_COUNT" -lt "$MIN_OBSERVATIONS" ]; then
        log "观察不足，跳过分析 (需要 $MIN_OBSERVATIONS，当前 $OBSERVATION_COUNT)"
        return
    fi
    
    log "分析完成"
    
    # 清理已处理的观察
    # tail -n 100 "$OBSERVATIONS_FILE" > "$OBSERVATIONS_FILE.tmp"
    # mv "$OBSERVATIONS_FILE.tmp" "$OBSERVATIONS_FILE"
}

stop_observer() {
    log "停止 Observer..."
    rm -f "$PID_FILE"
    exit 0
}

trap stop_observer SIGTERM SIGINT

# 启动
log "Observer 启动"
log "配置: 间隔=${INTERVAL_MINUTES}分钟, 最小观察=${MIN_OBSERVATIONS}"
echo $$ > "$PID_FILE"

# 主循环
while true; do
    analyze_patterns
    sleep $((INTERVAL_MINUTES * 60))
done
