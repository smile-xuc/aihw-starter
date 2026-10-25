#!/usr/bin/env bash
# 百炼 CLI 冒烟：bl --version → bl auth status → 一次文本调用（可选一张图），产物写到 out/
# 没有 Key 或加 --mock 时只打印 --dry-run 请求体，不发请求、不计费，退出码 0。
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$DIR/out"
BL="${BL:-bl}"
MODEL="qwen3.7-flash"
PROMPT="用一句话介绍 AI 硬件，不超过 40 字。"
IMAGE_PROMPT="白色桌面上的一台圆形 AI 语音盒子，产品摄影，柔和光线"
MOCK=0
IMAGE=0
REGION=""

usage() {
  cat <<'EOF'
用法：bash run.sh [--mock] [--image] [--region cn|intl] [--model 模型]
  --mock          不发请求：只跑 bl --version、auth status 和 --dry-run 请求体（CI 用这一档）
  --image         再生成一张 1:1 图片（默认 qwen-image-3.0，按张计费）
  --region cn     华北2（北京），默认
  --region intl   新加坡；已设 DASHSCOPE_BASE_URL 时以它为准
  --model 模型    文本模型，默认 qwen3.7-flash
环境变量：BL 指定 bl 可执行文件；DASHSCOPE_API_KEY 或 bl auth login 保存的 Key
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mock) MOCK=1 ;;
    --image) IMAGE=1 ;;
    --region) REGION="${2:-}"; shift ;;
    --model) MODEL="${2:-}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数：$1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

# 上游文档写 BAILIAN_BASE_URL、2.5.1 源码读 DASHSCOPE_BASE_URL，这里显式传 --base-url 避开分歧
BASE_OVERRIDE=""
case "$REGION" in
  ""|cn) ;;
  intl) [[ -z "${DASHSCOPE_BASE_URL:-}" ]] && BASE_OVERRIDE="https://dashscope-intl.aliyuncs.com" ;;
  *) echo "--region 只接受 cn 或 intl" >&2; exit 2 ;;
esac

# 关闭 CLI 遥测和更新检查；需要时在外部设为 0
export DO_NOT_TRACK="${DO_NOT_TRACK:-1}"
export NO_UPDATE_NOTIFIER="${NO_UPDATE_NOTIFIER:-1}"

if ! command -v "$BL" >/dev/null 2>&1; then
  echo "[bl] 没找到 bl。先安装：npm i -g bailian-cli@2.5.1（需要 Node.js 18.17+）" >&2
  exit 2
fi

json_get() {
  node -e '
    const [file, path] = process.argv.slice(1);
    let v;
    try { v = JSON.parse(require("fs").readFileSync(file, "utf8")); } catch { process.exit(0); }
    for (const k of path.split(".")) v = v == null ? undefined : v[k];
    if (v != null) process.stdout.write(typeof v === "object" ? JSON.stringify(v) : String(v));
  ' "$1" "$2"
}
now_ms() { node -e 'process.stdout.write(String(Date.now()))'; }
bl_api() {
  if [[ -n "$BASE_OVERRIDE" ]]; then "$BL" "$@" --base-url "$BASE_OVERRIDE"; else "$BL" "$@"; fi
}

mkdir -p "$OUT"

echo "[1/3] 版本"
"$BL" --version | tee "$OUT/version.txt"

echo "[2/3] 鉴权状态（bl auth status --output json → out/auth-status.json）"
"$BL" auth status --output json > "$OUT/auth-status.json"
"$BL" config show --output json > "$OUT/config.json"
AUTHED="$(json_get "$OUT/auth-status.json" authenticated)"
BASE_URL="${BASE_OVERRIDE:-$(json_get "$OUT/config.json" base_url)}"
case "$BASE_URL" in
  *dashscope-intl.aliyuncs.com*) REGION_LABEL="国际（新加坡）" ;;
  *dashscope.aliyuncs.com*) REGION_LABEL="北京" ;;
  *) REGION_LABEL="自定义地址" ;;
esac
if [[ "$AUTHED" == "true" ]]; then
  echo "      已鉴权：Key $(json_get "$OUT/auth-status.json" api_key.masked) · 来源 $(json_get "$OUT/auth-status.json" api_key.source) · $REGION_LABEL $BASE_URL"
else
  echo "      未鉴权 · 接入地址 $REGION_LABEL $BASE_URL"
fi

if [[ "$MOCK" == "1" || "$AUTHED" != "true" ]]; then
  echo "[3/3] 请求体预览（--dry-run，不发请求 → out/dry-run-text.json）"
  bl_api text chat --model "$MODEL" --message "$PROMPT" --output json --dry-run > "$OUT/dry-run-text.json"
  echo "      POST $BASE_URL/compatible-mode/v1/chat/completions · model=$(json_get "$OUT/dry-run-text.json" request.model)"
  if [[ "$IMAGE" == "1" ]]; then
    bl_api image generate --prompt "$IMAGE_PROMPT" --size 1:1 --output json --dry-run > "$OUT/dry-run-image.json"
    echo "      POST $BASE_URL$(json_get "$OUT/dry-run-image.json" path) · model=$(json_get "$OUT/dry-run-image.json" request.model)"
  fi
  if [[ "$AUTHED" != "true" ]]; then
    echo "停在鉴权：没有找到 Key，未发请求、未计费。"
    echo "      bl auth login --api-key \"\$DASHSCOPE_API_KEY\"   # 校验后保存到 ~/.bailian/config.json"
    echo "      或 export DASHSCOPE_API_KEY=sk-xxxx 后重跑 bash run.sh"
  else
    echo "mock 完成：未发请求、未计费。去掉 --mock 真跑一次。"
  fi
  exit 0
fi

echo "[3/3] 文本调用 bl text chat --model $MODEL（→ out/chat.json）"
rc=0
t0="$(now_ms)"
bl_api text chat --model "$MODEL" --message "$PROMPT" --output json > "$OUT/chat.json" 2> "$OUT/chat.err.json" || rc=$?
t1="$(now_ms)"
if [[ "$rc" != "0" ]]; then
  http="$(json_get "$OUT/chat.err.json" error.http_status)"
  echo "      调用失败（退出码 $rc${http:+ · HTTP $http}）：$(json_get "$OUT/chat.err.json" error.message)" >&2
  hint="$(json_get "$OUT/chat.err.json" error.hint)"
  [[ -n "$hint" ]] && echo "      $hint" >&2
  echo "      排查：Key 与地域是否一致（--region intl 用国际 Key）；sk-sp- 开头的 Token Plan Key 不能调模型接口；用 bl auth login --api-key 校验 Key" >&2
  exit "$rc"
fi
ELAPSED="$(node -e 'process.stdout.write(((process.argv[2]-process.argv[1])/1000).toFixed(1))' "$t0" "$t1")"
echo "      回复：$(json_get "$OUT/chat.json" choices.0.message.content)"
echo "      用量：输入 $(json_get "$OUT/chat.json" usage.prompt_tokens) / 输出 $(json_get "$OUT/chat.json" usage.completion_tokens) Token · 整次 ${ELAPSED} 秒（含 CLI 启动）"

if [[ "$IMAGE" == "1" ]]; then
  echo "[+] 图片 bl image generate --size 1:1（→ out/）"
  rc=0
  bl_api image generate --prompt "$IMAGE_PROMPT" --size 1:1 --out-dir "$OUT" --out-prefix aihw --output json > "$OUT/image.json" 2> "$OUT/image.err.json" || rc=$?
  if [[ "$rc" != "0" ]]; then
    echo "      图片失败（退出码 $rc）：$(json_get "$OUT/image.err.json" error.message)" >&2
    exit "$rc"
  fi
  echo "      已保存：$(json_get "$OUT/image.json" saved.0)"
fi

echo "[VERIFY] | $(date +%F) | $REGION_LABEL | $MODEL | 整次 ${ELAPSED} 秒 | 按 out/chat.json 的 usage 计算 | 文本 1 条$([[ "$IMAGE" == "1" ]] && echo "＋图片 1 张") | $(uname -s) · Node $(node --version) · $(cat "$OUT/version.txt") | 待补 | |"
