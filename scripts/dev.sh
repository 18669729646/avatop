#!/bin/bash
set -Eeuo pipefail

PORT=5000
COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"
NODE_ENV=development
DEPLOY_RUN_PORT=5000

cd "${COZE_WORKSPACE_PATH}"

kill_port_if_listening() {
    local pids
    pids=$(ss -H -lntp 2>/dev/null | awk -v port="${DEPLOY_RUN_PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    if [[ -z "${pids}" ]]; then
      echo "Port ${DEPLOY_RUN_PORT} is free."
      return
    fi
    echo "Port ${DEPLOY_RUN_PORT} in use by PIDs: ${pids} (SIGKILL)"
    echo "${pids}" | xargs -I {} kill -9 {}
    sleep 1
    pids=$(ss -H -lntp 2>/dev/null | awk -v port="${DEPLOY_RUN_PORT}" '$4 ~ ":"port"$"' | grep -o 'pid=[0-9]*' | cut -d= -f2 | paste -sd' ' - || true)
    if [[ -n "${pids}" ]]; then
      echo "Warning: port ${DEPLOY_RUN_PORT} still busy after SIGKILL, PIDs: ${pids}"
    else
      echo "Port ${DEPLOY_RUN_PORT} cleared."
    fi
}

# 预热 API - 让 Next.js 提前编译关键路由（后台执行，不阻塞）
warmup_apis() {
    (
        echo "🔥 Starting API warmup in background..."
        
        # 等待服务就绪（Next.js 启动较慢，最长等待 120 秒）
        local max_retries=240
        local retry=0
        while ! curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}" 2>/dev/null | grep -q "200"; do
            retry=$((retry + 1))
            if [[ $retry -ge $max_retries ]]; then
                echo "⚠️ Warmup timeout, service not ready after $((max_retries / 2)) seconds"
                exit 1
            fi
            sleep 0.5
        done
        
        echo "✅ Service ready after $((retry / 2)) seconds, warming up APIs..."
        local start_time=$(date +%s)
        
        # 预热上传相关 API
        curl -s -X POST "http://localhost:${PORT}/api/upload-image" \
            -H "Content-Type: application/json" \
            -d '{"image":"http://warmup"}' > /dev/null 2>&1
        
        # 预热角色 API
        curl -s "http://localhost:${PORT}/api/characters" > /dev/null 2>&1
        
        # 预热其他常用 API（并行执行）
        curl -s "http://localhost:${PORT}/api/tasks" > /dev/null 2>&1 &
        curl -s "http://localhost:${PORT}/api/tasks/batch" > /dev/null 2>&1 &
        curl -s "http://localhost:${PORT}/api/queue-config" > /dev/null 2>&1 &
        curl -s "http://localhost:${PORT}/api/user-preferences" > /dev/null 2>&1 &
        curl -s "http://localhost:${PORT}/api/system-config" > /dev/null 2>&1 &
        curl -s "http://localhost:${PORT}/api/products/manage" > /dev/null 2>&1 &
        curl -s "http://localhost:${PORT}/api/images/history" > /dev/null 2>&1 &
        
        # 预热页面
        curl -s "http://localhost:${PORT}/library" > /dev/null 2>&1 &
        curl -s "http://localhost:${PORT}/queue" > /dev/null 2>&1 &
        curl -s "http://localhost:${PORT}/shortfilm/new" > /dev/null 2>&1 &
        
        wait
        local end_time=$(date +%s)
        echo "🔥 API warmup completed in $((end_time - start_time))s!"
    ) &
}

echo "Clearing port ${PORT} before start."
kill_port_if_listening
echo "Starting HTTP service on port ${PORT} for dev..."

# 启动预热（在后台运行）
warmup_apis

pnpm next dev --webpack --port $PORT
