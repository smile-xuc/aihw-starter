"""media.py — 本地音视频处理：ffmpeg 抽音轨 / 变速 / 响度，demucs 人声分离，WAV 读写与拼接。

ffmpeg 需要预先装好（macOS：brew install ffmpeg；Ubuntu：apt install ffmpeg）。
demucs 首次使用时自动 pip 安装（会带上 PyTorch，约 1 GB），只在 CPU 上跑。
"""
from __future__ import annotations

import importlib.util
import json
import re
import shutil
import subprocess
import sys
import wave
from array import array
from pathlib import Path

DUB_RATE = 24000   # 配音轨统一采样率，与 TTS 输出一致


class MediaError(RuntimeError):
    pass


def require_ffmpeg() -> None:
    missing = [b for b in ("ffmpeg", "ffprobe") if not shutil.which(b)]
    if missing:
        raise MediaError(f"缺少 {' / '.join(missing)}：macOS 用 brew install ffmpeg，Ubuntu 用 apt install ffmpeg")


def run(cmd: list[str]) -> str:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise MediaError(f"{cmd[0]} 失败：{proc.stderr.strip()[-600:]}")
    return proc.stderr


def ffmpeg(*args: str) -> str:
    return run(["ffmpeg", "-hide_banner", "-nostdin", "-y", *args])


def probe_duration_ms(path: Path) -> int:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
                         capture_output=True, text=True)
    try:
        return int(float(json.loads(out.stdout)["format"]["duration"]) * 1000)
    except (KeyError, ValueError, json.JSONDecodeError):
        raise MediaError(f"读不出时长：{path}") from None


def has_video(path: Path) -> bool:
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=index",
                          "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    return bool(out.stdout.strip())


def extract_audio(video: Path, out: Path, rate: int, channels: int) -> Path:
    out.parent.mkdir(parents=True, exist_ok=True)
    ffmpeg("-i", str(video), "-vn", "-ac", str(channels), "-ar", str(rate), "-sample_fmt", "s16", str(out))
    return out


def to_mp3(src: Path, out: Path, bitrate: str = "48k") -> Path:
    """给 omni 的音频：单声道低码率 MP3，Base64 后控制在 10 MB 以内。"""
    ffmpeg("-i", str(src), "-ac", "1", "-ar", "16000", "-b:a", bitrate, str(out))
    return out


def to_wav(src: Path, out: Path, rate: int = DUB_RATE, tempo: float = 1.0) -> Path:
    """任意音频 → 单声道 16-bit WAV；tempo > 1 时用 atempo 等调变速（不变调）。"""
    args = ["-i", str(src), "-ac", "1", "-ar", str(rate), "-sample_fmt", "s16"]
    if abs(tempo - 1.0) > 1e-3:
        args += ["-filter:a", f"atempo={tempo:.4f}"]
    ffmpeg(*args, str(out))
    return out


# ───────────────────────── WAV（标准库） ─────────────────────────

def read_pcm(path: Path) -> tuple[array, int]:
    with wave.open(str(path), "rb") as w:
        if w.getsampwidth() != 2 or w.getnchannels() != 1:
            raise MediaError(f"{path}：需要单声道 16-bit WAV")
        rate, raw = w.getframerate(), w.readframes(w.getnframes())
    samples = array("h", raw)
    if sys.byteorder == "big":
        samples.byteswap()
    return samples, rate


def write_pcm(path: Path, samples: array, rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = array("h", samples)
    if sys.byteorder == "big":
        data.byteswap()
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(data.tobytes())


def wav_ms(path: Path) -> int:
    with wave.open(str(path), "rb") as w:
        return int(w.getnframes() * 1000 / w.getframerate())


def cut_and_join(src: Path, spans_ms: list[tuple[int, int]], out: Path, gap_ms: int = 150) -> float:
    """从单声道 WAV 里截出若干片段，中间留短静音拼成一个文件（声音复刻的参考音频）。返回秒数。"""
    samples, rate = read_pcm(src)
    silence = array("h", bytes(2 * int(rate * gap_ms / 1000)))
    joined = array("h")
    for start, end in spans_ms:
        if joined:
            joined.extend(silence)
        joined.extend(samples[int(start * rate / 1000):int(end * rate / 1000)])
    write_pcm(out, joined, rate)
    return len(joined) / rate


# ───────────────────────── 响度（EBU R128，ffmpeg loudnorm 两遍） ─────────────────────────

def loudnorm(src: Path, out: Path, target_i: float, true_peak: float = -1.5, lra: float = 11.0,
             rate: int = DUB_RATE, channels: int = 1) -> dict:
    """第一遍测量，第二遍按测量值线性归一，避免动态压缩改变配音的语气起伏。返回测量结果。"""
    spec = f"I={target_i}:TP={true_peak}:LRA={lra}"
    log = ffmpeg("-i", str(src), "-af", f"loudnorm={spec}:print_format=json", "-f", "null", "-")
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", log, re.S)
    if not m:
        raise MediaError("loudnorm 没有输出测量结果")
    stats = json.loads(m.group(0))
    if stats.get("input_i") in ("-inf", None):   # 全静音：原样转码
        ffmpeg("-i", str(src), "-ac", str(channels), "-ar", str(rate), str(out))
        return stats
    second = (f"loudnorm={spec}:measured_I={stats['input_i']}:measured_TP={stats['input_tp']}"
              f":measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}"
              f":offset={stats['target_offset']}:linear=true")
    ffmpeg("-i", str(src), "-af", second, "-ac", str(channels), "-ar", str(rate), str(out))
    return stats


# ───────────────────────── 人声分离（demucs htdemucs） ─────────────────────────

def ensure_demucs(auto_install: bool) -> None:
    if importlib.util.find_spec("demucs") is not None:
        return
    if not auto_install:
        raise MediaError("未安装 demucs：pip install demucs soundfile，或去掉 --no-auto-install")
    print("[设备] 首次运行：安装 demucs（含 PyTorch，约 1 GB，只需一次）……", flush=True)
    proc = subprocess.run([sys.executable, "-m", "pip", "install", "demucs", "soundfile"])
    if proc.returncode != 0:
        raise MediaError("demucs 安装失败，可手动执行：pip install demucs soundfile")


def separate(audio: Path, out_dir: Path, auto_install: bool = True) -> tuple[Path, Path]:
    """htdemucs 两轨分离：vocals（人声，用来截参考音频）+ no_vocals（背景音，最后混回成片）。"""
    ensure_demucs(auto_install)
    proc = subprocess.run([sys.executable, "-m", "demucs.separate", "-n", "htdemucs", "--two-stems", "vocals",
                           "-d", "cpu", "-o", str(out_dir), str(audio)], capture_output=True, text=True)
    stem = out_dir / "htdemucs" / audio.stem
    vocals, background = stem / "vocals.wav", stem / "no_vocals.wav"
    if proc.returncode != 0 or not vocals.is_file() or not background.is_file():
        raise MediaError(f"demucs 分离失败：{(proc.stderr or proc.stdout).strip()[-600:]}")
    return vocals, background
