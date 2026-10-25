#!/usr/bin/env bash
# qwen-audio-agent 语音委派后台改文件：前台同 Demo C，后台走 ACP（默认 Qwen Code），工作区是 out/acp-workspace/ 里的 fixture 副本。
#   bash run.sh            重置工作区、生成独立配置、只读检查后台是否就绪
#   bash run.sh gateway    前台运行 Gateway（带后台），保持这个终端
#   bash run.sh webui      另开终端，打开 WebUI
#   bash run.sh doctor     Gateway 与 WebUI 都开着时，确认后台已就绪、语音服务已连接
#   bash run.sh check      语音任务完成后，核对 target.txt 是否只剩 hello-aihw
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$(cd "$HERE/.." && pwd)/out"
QWENAUDIO="${QWENAUDIO:-qwenaudio}"
BACKEND="${BACKEND:-qwen}"
MODEL="qwen-audio-3.0-realtime-plus"
EXPECT="hello-aihw"
export QWAUDIO_CONFIG_DIR="${QWAUDIO_CONFIG_DIR:-$OUT/qwaudio-acp}"
export QWAUDIO_WORKSPACE="${QWAUDIO_WORKSPACE:-$OUT/acp-workspace}"
TARGET="$QWAUDIO_WORKSPACE/target.txt"

# 2.0.1 文档列出的后台；acp 为通用 ACP，需另设 ACP_COMMAND / ACP_ARGS
case "$BACKEND" in
  qwen|opencode|openclaw|qoder|minimax|kimi|hermes|codebuddy|codex|claude|deepseek|pi|acp) ;;
  *) echo "BACKEND=$BACKEND 不在 qwen-audio-agent 2.0.1 支持的后台列表里" >&2; exit 2 ;;
esac

if ! command -v "$QWENAUDIO" >/dev/null 2>&1; then
  echo "[qwenaudio] 没找到 qwenaudio。先安装：npm i -g qwen-audio-agent@2.0.1，并跑通上一级的 Demo C" >&2
  exit 2
fi

need_key() {
  if [[ -z "${DASHSCOPE_API_KEY:-}" ]]; then
    echo "停在凭证：没有 DASHSCOPE_API_KEY（前台 Realtime 用），未连接语音服务、未计费。"
    echo "      export DASHSCOPE_API_KEY=sk-xxxx 后重跑；后台 Agent 用它自己的登录与模型配置"
    return 1
  fi
}

prepare() {
  echo "[1/4] 工作区（QWAUDIO_WORKSPACE=$QWAUDIO_WORKSPACE）"
  mkdir -p "$QWAUDIO_WORKSPACE"
  cp "$HERE/fixture/target.txt" "$TARGET"
  echo "      已重置 target.txt：$(head -n 1 "$TARGET")"

  echo "[2/4] 独立配置（QWAUDIO_CONFIG_DIR=$QWAUDIO_CONFIG_DIR）"
  local cfg
  cfg="$("$QWENAUDIO" config)"
  node -e '
    const fs = require("fs");
    const [file, ...pairs] = process.argv.slice(1);
    let s = fs.readFileSync(file, "utf8");
    for (const pair of pairs) {
      const [k, v] = pair.split(/=(.*)/s);
      const re = new RegExp(`^${k}=.*$`, "m");
      s = re.test(s) ? s.replace(re, `${k}=${v}`) : s.replace(/\n?$/, `\n${k}=${v}\n`);
    }
    fs.writeFileSync(file, s);
  ' "$cfg" "QWEN_AUDIO_REALTIME_PROVIDER=dashscope" "QWEN_AUDIO_REALTIME_MODEL=$MODEL" \
    "AGENT_PROTOCOL=$BACKEND" "QWAUDIO_WORKSPACE=$QWAUDIO_WORKSPACE"
  echo "      AGENT_PROTOCOL=$BACKEND · 权限模式默认 native（是否请求授权由后台决定，请求会转到 WebUI 确认）"

  echo "[3/4] 后台检查（qwenaudio setup --backend $BACKEND，只读 → out/setup-$BACKEND.json）"
  mkdir -p "$OUT"
  "$QWENAUDIO" setup --backend "$BACKEND" --json > "$OUT/setup-$BACKEND.json" || true
  if ! node -e '
    const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const b = (d.backends || []).find(x => x.id === process.argv[2]) || {};
    console.log(`      ${b.label || process.argv[2]}：${b.ready ? "已就绪（组件齐全，不代表登录与额度可用）" : "未就绪：" + (b.issues || []).join("；")}`);
    process.exit(b.ready ? 0 : 10);
  ' "$OUT/setup-$BACKEND.json" "$BACKEND"; then
    echo "停在后台：先装好 $BACKEND 并在它自己的终端里登录、跑通一次（可用 qwenaudio install $BACKEND 补齐组件），再重跑。"
    exit 0
  fi

  echo "[4/4] 凭证"
  if ! need_key; then exit 0; fi
  echo "      DASHSCOPE_API_KEY 已设置（来自环境变量，不写进 config.env）"
  echo "下一步：终端 1 运行 bash run.sh gateway；终端 2 运行 bash run.sh webui 并跑 bash run.sh doctor，通过后对 WebUI 说「请后台把工作区里的 target.txt 改成只有一行 hello-aihw」；完成后运行 bash run.sh check"
}

doctor_acp() {
  mkdir -p "$OUT"
  "$QWENAUDIO" doctor --json > "$OUT/doctor-acp.json" || true
  node -e '
    const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const get = id => d.checks.find(c => c.id === id) || { status: "missing", summary: "未读到" };
    const [gateway, backend, voice] = ["gateway", "backend", "realtime.connection"].map(get);
    for (const [id, c] of [["gateway", gateway], ["backend", backend], ["realtime.connection", voice]]) console.log(`      [${c.status}] ${id}：${c.summary}`);
    const fail = msg => { console.error(msg); process.exit(1); };
    if (gateway.status !== "ok") fail("失败：没有读到 Gateway 状态，先在另一个终端运行 bash run.sh gateway。");
    if (backend.status === "skipped") fail("失败：连上的 Gateway 是仅前台模式（多为 Demo C 的 Gateway 还开着）；关掉它，用本目录的 bash run.sh gateway 启动。");
    if (backend.status !== "ok") fail(`未就绪：后台 Agent 没起来。看 Gateway 终端或 ${process.argv[2]}/state/logs/gateway.log 里的 acp.initialization_failed：带 spawn … ENOENT 是后台不在启动 Gateway 的终端的 PATH 里，其他原因多为后台起来了但没完成 ACP 握手。`);
    if (voice.status === "warning") fail("未连接：Gateway 与后台在运行，但当前没有语音会话。先 bash run.sh webui 并保持页面打开。");
    if (voice.status !== "ok") fail("失败：语音服务连接异常。401 多为 Key 无效或地域不符，见上一级 README「失败态」。");
    console.log("通过：后台 Agent 已就绪，语音服务已连接。对 WebUI 说出指令，完成后运行 bash run.sh check。");
  ' "$OUT/doctor-acp.json" "$QWAUDIO_CONFIG_DIR"
}

check_target() {
  if [[ ! -f "$TARGET" ]]; then
    echo "失败：没有 $TARGET，先运行 bash run.sh 准备工作区" >&2
    exit 1
  fi
  local got
  got="$(node -e 'process.stdout.write(require("fs").readFileSync(process.argv[1], "utf8").trim())' "$TARGET")"
  if [[ "$got" == "$EXPECT" ]]; then
    echo "通过：$TARGET 的内容是 $EXPECT"
  else
    echo "未通过：$TARGET 当前内容是「$got」，期望只有一行 $EXPECT" >&2
    exit 1
  fi
}

case "${1:-prepare}" in
  prepare) prepare ;;
  gateway)
    need_key || exit 2
    echo "[gateway] 后台 $BACKEND，工作区 $QWAUDIO_WORKSPACE，配置目录 $QWAUDIO_CONFIG_DIR；Ctrl+C 退出"
    exec "$QWENAUDIO" --backend "$BACKEND"
    ;;
  webui) shift; exec "$QWENAUDIO" webui "$@" ;;
  doctor) doctor_acp ;;
  check) check_target ;;
  -h|--help) sed -n 2,7p "$0" | sed 's/^# \{0,1\}//' ;;
  *) echo "未知子命令：$1（可用 prepare / gateway / webui / doctor / check）" >&2; exit 2 ;;
esac
