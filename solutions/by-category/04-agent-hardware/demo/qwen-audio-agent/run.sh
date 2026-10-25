#!/usr/bin/env bash
# qwen-audio-agent 仅前台语音回合：独立配置目录 out/qwaudio/，AGENT_PROTOCOL=none，Key 只从环境变量读取、不落盘。
#   bash run.sh            检查 Node / qwenaudio 版本，生成独立配置并跑 doctor
#   bash run.sh gateway    前台运行 Gateway（保持这个终端）
#   bash run.sh webui      另开终端，打开 WebUI（--no-open 只打印地址）
#   bash run.sh doctor     WebUI 连着时再跑，确认语音服务已连接
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$DIR/out"
QWENAUDIO="${QWENAUDIO:-qwenaudio}"
PINNED="2.0.1"
MODEL="qwen-audio-3.0-realtime-plus"
export QWAUDIO_CONFIG_DIR="${QWAUDIO_CONFIG_DIR:-$OUT/qwaudio}"
URL_ARGS=()
[[ -n "${QAA_URL:-}" ]] && URL_ARGS=(--url "$QAA_URL")

if ! command -v "$QWENAUDIO" >/dev/null 2>&1; then
  echo "[qwenaudio] 没找到 qwenaudio。先安装：npm i -g qwen-audio-agent@$PINNED" >&2
  exit 2
fi

run_qa() { "$QWENAUDIO" "$@" ${URL_ARGS[@]+"${URL_ARGS[@]}"}; }

need_key() {
  if [[ -z "${DASHSCOPE_API_KEY:-}" ]]; then
    echo "停在配置：没有 DASHSCOPE_API_KEY，未连接语音服务、未计费。"
    echo "      export DASHSCOPE_API_KEY=sk-xxxx 后重跑；Key 只从环境变量读取，不写进 config.env"
    return 1
  fi
}

check() {
  echo "[1/4] 运行环境"
  node -e '
    const [maj, min, pat] = process.versions.node.split(".").map(Number);
    const ok = (maj === 22 && (min > 22 || (min === 22 && pat >= 2))) || (maj === 24 && min >= 15) || maj >= 26;
    console.log(`      Node ${process.version}${ok ? "" : "（不满足 ^22.22.2 || ^24.15.0 || >=26）"}`);
    process.exit(ok ? 0 : 3);
  '
  local version
  version="$(node -e '
    const fs = require("fs"), p = require("path");
    let d = p.dirname(fs.realpathSync(process.argv[1]));
    for (; d !== p.dirname(d); d = p.dirname(d)) {
      const f = p.join(d, "package.json");
      if (fs.existsSync(f)) { const j = JSON.parse(fs.readFileSync(f, "utf8")); if (j.name === "qwen-audio-agent") { process.stdout.write(j.version); break; } }
    }
  ' "$(command -v "$QWENAUDIO")")"
  echo "      qwen-audio-agent ${version:-未知版本}$([[ "$version" == "$PINNED" ]] || echo "（本示例钉 $PINNED，其他版本的变量名与默认模型可能不同）")"

  echo "[2/4] 独立配置（QWAUDIO_CONFIG_DIR=$QWAUDIO_CONFIG_DIR）"
  local cfg
  cfg="$("$QWENAUDIO" config)"
  node -e '
    const fs = require("fs");
    const [file, model] = process.argv.slice(1);
    let s = fs.readFileSync(file, "utf8");
    const set = (k, v) => { const re = new RegExp(`^${k}=.*$`, "m"); s = re.test(s) ? s.replace(re, `${k}=${v}`) : s.replace(/\n?$/, `\n${k}=${v}\n`); };
    set("QWEN_AUDIO_REALTIME_PROVIDER", "dashscope");
    set("QWEN_AUDIO_REALTIME_MODEL", model);
    set("AGENT_PROTOCOL", "none");
    fs.writeFileSync(file, s);
  ' "$cfg" "$MODEL"
  echo "      $cfg：QWEN_AUDIO_REALTIME_PROVIDER=dashscope · QWEN_AUDIO_REALTIME_MODEL=$MODEL · AGENT_PROTOCOL=none"

  echo "[3/4] 凭证"
  if ! need_key; then exit 0; fi
  echo "      DASHSCOPE_API_KEY 已设置（来自环境变量，doctor 不校验额度）"

  echo "[4/4] doctor（→ out/doctor-check.json）"
  doctor_summary "$OUT/doctor-check.json" || true
  echo "下一步：终端 1 运行 bash run.sh gateway；终端 2 运行 bash run.sh webui，允许麦克风后说「你好」；连着时再跑 bash run.sh doctor"
}

doctor_summary() {
  local file="$1" rc=0
  mkdir -p "$OUT"
  run_qa doctor --json > "$file" || rc=$?
  node -e '
    const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    for (const c of d.checks) console.log(`      [${c.status}] ${c.id}：${c.summary}`);
  ' "$file"
  return "$rc"
}

case "${1:-check}" in
  check) check ;;
  gateway)
    need_key || exit 2
    echo "[gateway] 仅前台模式（--backend none），配置目录 $QWAUDIO_CONFIG_DIR；Ctrl+C 退出"
    exec "$QWENAUDIO" --backend none ${URL_ARGS[@]+"${URL_ARGS[@]}"}
    ;;
  webui)
    shift
    exec "$QWENAUDIO" webui ${URL_ARGS[@]+"${URL_ARGS[@]}"} "$@"
    ;;
  doctor)
    rc=0
    doctor_summary "$OUT/doctor.json" || rc=$?
    [[ -z "${DASHSCOPE_API_KEY:-}" ]] && echo "      注：本终端没设 DASHSCOPE_API_KEY，realtime.configuration 报 error 属正常；Gateway 用的是启动它的终端里的 Key，以 realtime.connection 为准"
    status="$(node -e '
      const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
      const c = d.checks.find(x => x.id === "realtime.connection");
      process.stdout.write(c ? c.status : "missing");
    ' "$OUT/doctor.json")"
    case "$status" in
      ok) echo "通过：Gateway 与语音前台已连接（仅前台模式）。在 WebUI 里说「你好」，确认看到转写并听到回答。" ;;
      warning) echo "未连接：Gateway 在运行，但当前没有语音会话。先 bash run.sh webui 并保持页面打开。"; rc=1 ;;
      error)
        base="${QAA_URL:-http://127.0.0.1:3101}"
        reason="$(node -e '
          fetch(process.argv[1] + "/api/health", { signal: AbortSignal.timeout(3000) }).then(r => r.json()).then(h => {
            const p = h?.voiceClients?.realtime?.byProvider || {};
            process.stdout.write(Object.values(p).map(x => x.error).filter(Boolean).join("；"));
          }).catch(() => {});
        ' "$base")"
        echo "失败：语音服务连接异常${reason:+（$reason）}。401 多为 Key 无效或地域不符；Key 与地域见 README「失败态」。" >&2
        rc=1
        ;;
      *) echo "失败：没有读到 Gateway 状态，先在另一个终端运行 bash run.sh gateway。" >&2; rc=1 ;;
    esac
    exit "$rc"
    ;;
  -h|--help) sed -n 2,6p "$0" | sed 's/^# \{0,1\}//' ;;
  *) echo "未知子命令：$1（可用 check / gateway / webui / doctor）" >&2; exit 2 ;;
esac
