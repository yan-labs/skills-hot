#!/bin/bash
# Skills Hot 定时同步器启动脚本

# 加载 .env.local
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
fi

# 设置环境变量
export SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
export SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}

echo "🚀 启动 Skills Hot 定时同步器..."
echo ""
echo "按 Ctrl+C 停止"
echo ""

# 运行定时器
node scripts/scheduler.mjs
