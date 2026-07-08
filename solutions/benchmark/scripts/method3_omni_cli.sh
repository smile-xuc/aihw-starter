#!/usr/bin/env bash
# 方案 3 · CLI 版本：用 bl CLI 直接调用 Qwen-Omni（语音进语音出）
# 用法：./method3_omni_cli.sh samples/q1_light.wav
# 说明：bl omni 一次调用即完成 ASR+LLM+TTS，无法拆分子阶段。
set -euo pipefail

WAV="${1:-samples/q1_light.wav}"
if [ ! -f "$WAV" ]; then
  echo "音频文件不存在: $WAV" >&2
  exit 1
fi

if [ -z "${DASHSCOPE_API_KEY:-}" ]; then
  echo "环境变量未就位，请参考 benchmark/.env.example 配置后再运行" >&2
  exit 1
fi

echo "=== 输入音频: $WAV ==="

t0=$(python3 -c "import time; print(time.perf_counter())")
bl omni --audio "$WAV" --message "" \
        --system "你是儿童陪伴AI，回答简短亲切，不超过40字。" \
        --voice Cherry \
        --audio-out /tmp/method3_out.wav \
        --output json > /tmp/method3_meta.json 2>&1
t1=$(python3 -c "import time; print(time.perf_counter())")
e2e_ms=$(python3 -c "print(round(($t1 - $t0)*1000))")

if [ -f /tmp/method3_out.wav ]; then
  size=$(stat -f%z /tmp/method3_out.wav 2>/dev/null || echo 0)
  echo "Qwen-Omni 端到端($e2e_ms ms, 音频 $size bytes) → /tmp/method3_out.wav"
else
  echo "输出音频未生成，请查看 /tmp/method3_meta.json"
fi
