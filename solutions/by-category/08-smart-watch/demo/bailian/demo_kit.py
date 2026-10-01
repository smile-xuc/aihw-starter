"""demo_kit.py — aihw-starter 百炼参考 demo 公共件 v0.2

每个百炼 demo 目录放一份原样副本，单个目录拷走也能跑。
正本：solutions/demo-standard/templates/bailian/demo_kit.py
CI（solutions/demo-standard/check.py）校验副本与正本逐字节一致；要改先改正本，再同步到各 demo。
所有接入地址都从 Config 的方法取，demo 代码里不写死域名（check.py 会检查）。

只依赖标准库。麦克风 / 扬声器 / 摄像头为可选能力，需要时安装 requirements-device.txt。
"""
from __future__ import annotations

import argparse
import datetime as _dt
import json
import math
import os
import platform
import sys
import time
import urllib.error
import urllib.request
import uuid
import wave
from array import array
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Optional, Tuple, Union

KIT_VERSION = "0.2"

# 地域 → 接入地址（查证 2026-10-01，来源见 solutions/demo-standard/README.md「地域」一节）
REGIONS = {
    "cn-beijing": {
        "label": "华北2（北京）",
        "http": "https://dashscope.aliyuncs.com",
        "ws": "wss://dashscope.aliyuncs.com",
        "workspace_host": "{workspace}.cn-beijing.maas.aliyuncs.com",
    },
    "ap-southeast-1": {
        "label": "新加坡",
        "http": "https://dashscope-intl.aliyuncs.com",
        "ws": "wss://dashscope-intl.aliyuncs.com",
        "workspace_host": "{workspace}.ap-southeast-1.maas.aliyuncs.com",
    },
}
DEFAULT_REGION = "cn-beijing"
_PLACEHOLDER_HINTS = ("xxx", "your", "<", "在此", "...")


# ───────────────────────── 配置与模式 ─────────────────────────

def load_dotenv(path: Path) -> None:
    """读取 .env 里的 DASHSCOPE_* / AIHW_* 变量；不覆盖已存在的环境变量。"""
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip().removeprefix("export ").strip()
        value = value.strip().strip('"').strip("'")
        if key.startswith(("DASHSCOPE_", "AIHW_")) and value and key not in os.environ:
            os.environ[key] = value


def env_files(demo_dir: Path) -> list[Path]:
    """先读 demo 目录的 .env，再读仓库根目录的 .env（一次填写，全部 demo 可用）。"""
    files = [demo_dir / ".env"]
    for parent in demo_dir.parents:
        if (parent / ".git").exists():
            files.append(parent / ".env")
            break
    return files


def _unset(value: str) -> bool:
    v = value.strip().lower()
    return not v or any(h in v for h in _PLACEHOLDER_HINTS)


@dataclass
class Config:
    mode: str               # "live" | "mock"
    reason: str
    region: str
    api_key: str = ""       # 只在内存里使用，任何输出都不打印
    workspace_id: str = ""

    @property
    def live(self) -> bool:
        return self.mode == "live"

    @property
    def region_label(self) -> str:
        return REGIONS[self.region]["label"]

    # 地址规则：填了业务空间 ID，下面所有 HTTP / WebSocket 地址都走业务空间专属域名；
    # 没填时走通用域名。必须用专属域名的模型（如 qwen3.8-omni-flash-realtime）由 resolve(need_workspace=True) 拦住。

    def workspace_host(self) -> str | None:
        """业务空间专属域名，如 llm-xxx.cn-beijing.maas.aliyuncs.com；没填业务空间 ID 时为 None。"""
        if not self.workspace_id:
            return None
        return REGIONS[self.region]["workspace_host"].format(workspace=self.workspace_id)

    def http_root(self) -> str:
        host = self.workspace_host()
        return f"https://{host}" if host else REGIONS[self.region]["http"]

    def ws_root(self) -> str:
        host = self.workspace_host()
        return f"wss://{host}" if host else REGIONS[self.region]["ws"]

    def compatible_base(self) -> str:
        """OpenAI 兼容接口（Chat Completions 等）。"""
        return self.http_root() + "/compatible-mode/v1"

    def api_base(self) -> str:
        """DashScope 原生 HTTP 接口（同步 / 异步推理、任务查询、上传凭证、TTS HTTP 等）。"""
        return self.http_root() + "/api/v1"

    def ws_inference(self) -> str:
        """任务制 WebSocket（run-task：流式 ASR、TTS 等）。"""
        return self.ws_root() + "/api-ws/v1/inference"

    def realtime_url(self, model: str) -> str:
        """会话制 Realtime WebSocket（omni / Qwen-Audio 实时 / 同传 / 实时 ASR、TTS）。"""
        return f"{self.ws_root()}/api-ws/v1/realtime?model={model}"

    def shared_api_base(self) -> str:
        """通用域名的原生 HTTP 接口，只用于官方仅给出通用域名、且专属域名返回 404 时的退路。"""
        return REGIONS[self.region]["http"] + "/api/v1"

    def headers(self, **extra: str) -> dict:
        return {"Authorization": f"Bearer {self.api_key}", **extra}


def add_standard_args(parser: argparse.ArgumentParser) -> None:
    """所有百炼 demo 共有的三个参数。"""
    parser.add_argument("--mock", action="store_true", help="强制离线 mock：不联网、不需要 Key（CI 用）")
    parser.add_argument("--region", choices=sorted(REGIONS), help="临时覆盖 .env 里的 DASHSCOPE_API_REGION")
    parser.add_argument("--record", action="store_true", help="真跑成功后把验证记录追加到 VERIFY.md")


def resolve(args: argparse.Namespace, demo_dir: Path, need_workspace: bool = False) -> Config:
    """决定 live / mock。没有 Key → 自动 mock；有 Key 但配置不全 → 报错退出，不静默降级。"""
    for path in env_files(demo_dir):
        load_dotenv(path)
    # 变量名与官方 dashscope SDK 一致；DASHSCOPE_REGION 是早期写法，仍兼容
    region = (args.region or os.getenv("DASHSCOPE_API_REGION") or os.getenv("DASHSCOPE_REGION")
              or DEFAULT_REGION).strip()
    if region not in REGIONS:
        sys.exit(f"DASHSCOPE_API_REGION={region!r} 不支持，可选：{' / '.join(REGIONS)}")
    key = os.getenv("DASHSCOPE_API_KEY", "")
    workspace = os.getenv("DASHSCOPE_WORKSPACE_ID", "").strip()

    if args.mock:
        cfg = Config("mock", "--mock", region)
    elif _unset(key):
        cfg = Config("mock", "未检测到 DASHSCOPE_API_KEY，自动进入 mock", region)
    elif need_workspace and _unset(workspace):
        sys.exit("已读取 DASHSCOPE_API_KEY，但缺少 DASHSCOPE_WORKSPACE_ID：本 demo 的模型必须走业务空间专属域名。"
                 "在百炼控制台「业务空间详情」复制 ID 填入 .env；只想离线体验请加 --mock。")
    else:
        cfg = Config("live", "已读取 DASHSCOPE_API_KEY", region, key.strip(), "" if _unset(workspace) else workspace)
    if args.record and not cfg.live:
        sys.exit(f"--record 只记录真跑结果，当前为 mock（{cfg.reason}）")
    return cfg


def banner(title: str, cfg: Config, models: list[str]) -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")  # 非 UTF-8 终端也不因个别字符崩溃
    rule = "─" * 64
    mode = "LIVE 真实调用百炼" if cfg.live else f"MOCK 离线模拟（{cfg.reason}）"
    print(rule)
    print(title)
    print(f"模式：{mode}")
    print(f"地域：{cfg.region_label} · {cfg.region}    模型：{'、'.join(models)}")
    print(rule, flush=True)


def say(tag: str, text: str) -> None:
    """统一的「设备 / 云端 / App」日志行，让硬件场景一眼可见。"""
    print(f"[{tag}] {text}", flush=True)


def now_ms() -> float:
    return time.perf_counter() * 1000


# ───────────────────────── 验证记录 ─────────────────────────

VERIFY_HEADER = "| 日期 | 地域 | 模型 | 首字延迟 | 单次成本（元） | 输入 | 环境 | 验证人 | 备注 |"


Cost = Optional[Union[float, Tuple[float, float]]]  # 单次成本：确定值，或（下限, 上限）估算区间


def fmt_cny(value: Cost) -> str:
    """金额显示：≥ 0.01 元保留 3 位小数，更小的保留 2 位有效数字（始终是定点小数，不出现 9.8e-05）。
    传入（下限, 上限）时显示区间，用于接口未返回用量、只能按官方口径估算的情况。"""
    if isinstance(value, tuple):
        low, high = value
        return fmt_cny(low) if abs(high - low) < 1e-9 else f"{fmt_cny(low)}–{fmt_cny(high)}"
    if value is None:
        return "—"
    if value >= 0.01:
        return f"{value:.3f}"
    text = f"{value:.2g}"
    if "e" not in text:
        return text
    rounded = float(text)
    return f"{rounded:.{1 - math.floor(math.log10(rounded))}f}".rstrip("0")


def verify_row(cfg: Config, models: list[str], first_ms: float | None, cost: Cost,
               sample: str, note: str = "") -> str:
    env = f"{platform.system()} {platform.machine()} · Python {platform.python_version()}"
    who = os.getenv("AIHW_VERIFIED_BY", "").strip() or "（填 GitHub ID）"
    first = "—" if first_ms is None else f"{first_ms:.0f} ms"
    cells = [_dt.date.today().isoformat(), cfg.region, " + ".join(models), first, fmt_cny(cost),
             sample, env, who, note]
    return "| " + " | ".join(c.replace("|", "/") for c in cells) + " |"


def finish(cfg: Config, args: argparse.Namespace, demo_dir: Path, *, models: list[str],
           first_ms: float | None, cost: Cost, sample: str, note: str = "") -> None:
    """打印本次运行的验证记录；--record 时追加到 VERIFY.md 末尾的表格。"""
    row = verify_row(cfg, models, first_ms if cfg.live else None, cost, sample,
                     note if cfg.live else "；".join(filter(None, ["mock 用量为示意值", note])))
    print("\n—— 验证记录（VERIFY.md 格式）——")
    print(VERIFY_HEADER)
    print(row)
    if not cfg.live:
        print("（mock 结果仅用于检查流程，不写入 VERIFY.md）")
    elif args.record:
        path = demo_dir / "VERIFY.md"
        with path.open("a", encoding="utf-8") as fh:
            fh.write(row + "\n")
        print(f"已追加到 {path.name}；提交 PR 前请把「验证人」改成 GitHub ID，并更新 solution.yaml 的 verification")


# ───────────────────────── HTTP（标准库） ─────────────────────────

class HttpError(RuntimeError):
    """接口返回非 2xx。status 为 HTTP 状态码（mock 或非 HTTP 原因时为 None）。"""

    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


def _request(method: str, url: str, headers: dict | None, body: bytes | None, timeout: float):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        return urllib.request.urlopen(req, timeout=timeout)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:500]
        raise HttpError(f"HTTP {exc.code} {method} {url.split('?')[0]}：{detail}", exc.code) from None


class HttpTransport:
    """live 模式的 HTTP 传输。mock 时由 demo 换成同接口的假实现。"""

    def json(self, method: str, url: str, headers: dict | None = None, payload: dict | None = None,
             timeout: float = 60) -> dict:
        body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode()
        hdrs = {"Content-Type": "application/json", **(headers or {})}
        with _request(method, url, hdrs, body, timeout) as resp:
            return json.loads(resp.read().decode("utf-8") or "{}")

    def sse(self, url: str, headers: dict, payload: dict, timeout: float = 120) -> Iterator[dict]:
        """POST 后按 Server-Sent Events 逐条产出 data JSON（OpenAI 兼容流式）。"""
        body = json.dumps(payload, ensure_ascii=False).encode()
        hdrs = {"Content-Type": "application/json", "Accept": "text/event-stream", **headers}
        with _request("POST", url, hdrs, body, timeout) as resp:
            for raw in resp:
                line = raw.decode("utf-8").strip()
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    return
                yield json.loads(data)

    def multipart(self, url: str, fields: dict, file_field: str, filename: str, content: bytes,
                  timeout: float = 120) -> int:
        boundary = uuid.uuid4().hex
        parts = []
        for name, value in fields.items():
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{file_field}"; '
                     f'filename="{filename}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode())
        body = b"".join(parts) + content + f"\r\n--{boundary}--\r\n".encode()
        with _request("POST", url, {"Content-Type": f"multipart/form-data; boundary={boundary}"}, body, timeout) as resp:
            return resp.status

    def get_bytes(self, url: str, timeout: float = 60) -> bytes:
        with _request("GET", url, None, None, timeout) as resp:
            return resp.read()


# ───────────────────────── 音频 / 图像（模拟设备） ─────────────────────────

def read_wav(path: Path, rate: int = 16000) -> bytes:
    """WAV → 单声道 16-bit PCM（小端），必要时线性重采样到 rate。"""
    with wave.open(str(path), "rb") as w:
        channels, width, src_rate = w.getnchannels(), w.getsampwidth(), w.getframerate()
        raw = w.readframes(w.getnframes())
    if width != 2:
        sys.exit(f"{path}：只支持 16-bit PCM WAV。转换：ffmpeg -i in.xxx -ac 1 -ar {rate} -sample_fmt s16 out.wav")
    samples = array("h", raw)
    if sys.byteorder == "big":
        samples.byteswap()
    if channels > 1:
        samples = array("h", (sum(samples[i:i + channels]) // channels for i in range(0, len(samples), channels)))
    if src_rate != rate:
        samples = _resample(samples, src_rate, rate)
    if sys.byteorder == "big":
        samples.byteswap()
    return samples.tobytes()


def _resample(samples: array, src: int, dst: int) -> array:
    n = int(len(samples) * dst / src)
    out = array("h", bytes(2 * n))
    step, last = src / dst, len(samples) - 1
    for i in range(n):
        x = i * step
        j = int(x)
        a = samples[j]
        b = samples[j + 1] if j < last else a
        out[i] = int(a + (b - a) * (x - j))
    return out


def write_wav(path: Path, pcm: bytes, rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)


def pcm_seconds(pcm: bytes, rate: int) -> float:
    return len(pcm) / 2 / rate


def _optional(module: str, purpose: str):
    try:
        return __import__(module)
    except ImportError:
        sys.exit(f"{purpose}需要可选依赖 {module}：pip install -r requirements-device.txt")


def record_mic(rate: int = 16000, seconds: float | None = None) -> bytes:
    """录一段麦克风。seconds 为空时按回车结束（按键说话）。"""
    sd = _optional("sounddevice", "麦克风")
    chunks: list[bytes] = []
    with sd.RawInputStream(samplerate=rate, channels=1, dtype="int16",
                           callback=lambda data, frames, t, status: chunks.append(bytes(data))):
        if seconds:
            time.sleep(seconds)
        else:
            input("        ……录音中，再按回车结束 ")
    return b"".join(chunks)


def play_pcm(pcm: bytes, rate: int) -> bool:
    """有 sounddevice 就用扬声器播放，返回是否播放。"""
    try:
        import sounddevice as sd
    except ImportError:
        return False
    with sd.RawOutputStream(samplerate=rate, channels=1, dtype="int16") as stream:
        stream.write(pcm)
    return True


def capture_jpeg(index: int = 0, width: int = 640, height: int = 480, quality: int = 80) -> bytes:
    """从摄像头抓一帧 JPEG（模拟设备摄像头）。"""
    cv2 = _optional("cv2", "摄像头")
    cap = cv2.VideoCapture(index)
    try:
        ok, frame = False, None
        for _ in range(5):  # 丢掉曝光未稳定的前几帧
            ok, frame = cap.read()
        if not ok:
            sys.exit(f"摄像头 {index} 读取失败")
    finally:
        cap.release()
    ok, buf = cv2.imencode(".jpg", cv2.resize(frame, (width, height)), [cv2.IMWRITE_JPEG_QUALITY, quality])
    return buf.tobytes()
