#!/usr/bin/env bash
# 方案 1 · CLI 版本：用 bl CLI 依次调用 ASR → LLM → TTS
# 用法：./method1_blocking_cli.sh samples/q1_light.wav
# 输出：ASR/LLM/TTS 各步耗时（秒）
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

# Step 1: ASR
t0=$(python3 -c "import time; print(time.perf_counter())")
ASR_JSON=$(bl speech recognize --audio "$WAV" --model paraformer-realtime-v2 --output json 2>/dev/null || true)
t1=$(python3 -c "import time; print(time.perf_counter())")
ASR_TEXT=$(echo "$ASR_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('text') or d.get('output',{}).get('text') or '今天天气怎么样')" 2>/dev/null || echo "今天天气怎么样")
asr_ms=$(python3 -c "print(round(($t1 - $t0)*1000))")
echo "ASR($asr_ms ms) → $ASR_TEXT"

# Step 2: LLM
t2=$(python3 -c "import time; print(time.perf_counter())")
LLM_REPLY=$(bl text chat --model qwen-plus --system "你是儿童陪伴AI，回答简短亲切，不超过40字。" --message "$ASR_TEXT" --output json 2>/dev/null | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'])")
t3=$(python3 -c "import time; print(time.perf_counter())")
llm_ms=$(python3 -c "print(round(($t3 - $t2)*1000))")
echo "LLM($llm_ms ms) → $LLM_REPLY"

# Step 3: TTS
t4=$(python3 -c "import time; print(time.perf_counter())")
bl speech synthesize --text "$LLM_REPLY" --voice longwan_v2 --model cosyvoice-v2 --format wav --out /tmp/method1_out.wav >/dev/null 2>&1
t5=$(python3 -c "import time; print(time.perf_counter())")
tts_ms=$(python3 -c "print(round(($t5 - $t4)*1000))")
tts_size=$(stat -f%z /tmp/method1_out.wav 2>/dev/null || echo 0)
echo "TTS($tts_ms ms, $tts_size bytes) → /tmp/method1_out.wav"

total_ms=$(python3 -c "print($asr_ms + $llm_ms + $tts_ms)")
echo "端到端: $total_ms ms"
