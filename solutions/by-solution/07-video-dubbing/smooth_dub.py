"""smooth_dub.py — ⑧ 对齐混音：把每句配音放回原时间轴，保证句与句零重叠，响度按 EBU R128 归一后混回背景音，
再把音轨封装回原视频（画面流直接复制，不重编码）。

放置规则（place，纯函数，selftest.py 覆盖）：
  1. 每句从原句开始时刻起播；前一句还没播完时顺延，句间至少留 GAP_MS
  2. 可用时长 = 到下一句原开始时刻为止；放不下时先加速，最多 MAX_SPEED 倍（atempo，不变调）
  3. 加速到上限仍放不下，就让它越过下一句的原开始时刻，下一句顺延；越过的毫秒数记为 overflow_ms，交给质检
"""
from __future__ import annotations

from array import array
from pathlib import Path

import media

GAP_MS = 80
MAX_SPEED = 1.25
LEAD_MS = 120            # 允许比原句早开口的上限：原文开头常有吸气、语气词，译文早一点进更自然
DIALOG_LUFS = -16.0      # 移动端 / 网络视频常用的对白响度
BACKGROUND_LUFS = -26.0  # 背景音比对白低约 10 LU，听得见环境声又不抢对白


def place(segments: list[dict], durations_ms: dict[int, int], media_ms: int) -> list[dict]:
    """segments 需含 id、start_ms、end_ms；durations_ms 为各句配音的原始时长。返回逐句的放置结果。"""
    ordered = sorted(segments, key=lambda s: s["start_ms"])
    out: list[dict] = []
    for i, seg in enumerate(ordered):
        dur = durations_ms.get(seg["id"])
        if not dur:
            continue
        last = i + 1 == len(ordered)
        limit = max(media_ms, seg["end_ms"]) if last else ordered[i + 1]["start_ms"] - GAP_MS
        earliest = out[-1]["at_ms"] + out[-1]["dur_ms"] + GAP_MS if out else 0
        at = max(seg["start_ms"], earliest)
        if dur > limit - at:
            at = max(earliest, seg["start_ms"] - LEAD_MS, 0)
        room = max(limit - at, 1)
        speed = 1.0 if dur <= room else min(MAX_SPEED, dur / room)
        played = int(round(dur / speed))
        out.append({"id": seg["id"], "at_ms": at, "dur_ms": played, "speed": round(speed, 3),
                    "overflow_ms": max(0, at + played - limit)})
    return out


def build_dialog(placements: list[dict], clips: dict[int, Path], media_ms: int, work: Path) -> Path:
    """按放置结果变速、拼成整条对白轨（单声道 24 kHz）。零重叠，所以直接写入，不需要叠加。"""
    rate = media.DUB_RATE
    total = max([media_ms] + [p["at_ms"] + p["dur_ms"] for p in placements])
    track = array("h", bytes(2 * int(total * rate / 1000) + 2))
    for p in placements:
        clip = clips[p["id"]]
        if p["speed"] > 1.0:
            clip = media.to_wav(clip, work / f"{clip.stem}.x{p['speed']:.3f}.wav", rate, p["speed"])
        samples, clip_rate = media.read_pcm(clip)
        if clip_rate != rate:
            samples, _ = media.read_pcm(media.to_wav(clip, work / f"{clip.stem}.{rate}.wav", rate))
        offset = int(p["at_ms"] * rate / 1000)
        end = min(len(track), offset + len(samples))
        track[offset:end] = samples[:end - offset]
    out = work / "dialog_raw.wav"
    media.write_pcm(out, track, rate)
    return out


def render(placements: list[dict], clips: dict[int, Path], media_ms: int, work: Path,
           background: Path | None, video: Path | None, out_mp4: Path | None, out_audio: Path) -> dict:
    """对白轨响度归一 → 背景音归一 → 混音 → 封装。返回响度测量值，写进字幕 JSON。"""
    raw = build_dialog(placements, clips, media_ms, work)
    dialog = work / "dialog.wav"
    report = {"dialog": media.loudnorm(raw, dialog, DIALOG_LUFS)}
    if background:
        bg = work / "background.wav"
        report["background"] = media.loudnorm(background, bg, BACKGROUND_LUFS, rate=48000, channels=2)
        media.ffmpeg("-i", str(dialog), "-i", str(bg), "-filter_complex",
                     "[0:a]aresample=48000,pan=stereo|c0=c0|c1=c0[d];"
                     "[d][1:a]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.89[m]",
                     "-map", "[m]", "-ar", "48000", str(out_audio))
    else:
        media.ffmpeg("-i", str(dialog), "-ar", "48000", "-ac", "2", str(out_audio))
    if video and out_mp4:
        out_mp4.parent.mkdir(parents=True, exist_ok=True)
        media.ffmpeg("-i", str(video), "-i", str(out_audio), "-map", "0:v:0", "-map", "1:a:0",
                     "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
                     "-metadata", "comment=AI-generated dubbing (AIGC)", str(out_mp4))
    return report
