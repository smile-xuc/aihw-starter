"""dub.py — AI 视频翻译配音：中文视频 → 目标语言配音版视频 + 字幕 JSON。

  ① 多说话人转写   qwen-audio-3.0-asr-flash-filetrans（词级时间戳 + 说话人分离，时间戳唯一来源）
  ② 一次性校正     qwen3.8-omni-flash 听原声 + 读转写稿：说话人重标注、身份、情绪卡、同音字建议
  ③ 时间轴骨架     pause_plan.py：按停顿切小节 + 音节预算
  ④ 翻译           qwen3.8-flash 口语化翻译，受音节预算约束；也可用 --translations 导入 Agent 的译文
  ⑤ 人声分离       demucs htdemucs（本地 CPU，首次自动安装），保留背景音
  ⑥ 参考音频       每个说话人截 10–20 秒原声（需 --consent 声明已获授权，否则用系统音色）
  ⑦ 配音           qwen-audio-3.0-tts-plus 复刻音色 + instruction 情绪控制
  ⑧ 对齐混音       smooth_dub.py：零重叠放置 + EBU R128 响度 + 背景音混回，画面流直接复制
  ⑨ 质检门禁       ASR 回查语言泄漏 + omni 盲测音色 / 语速 / 重叠 / 自然度

用法：
  python3 dub.py input/demo.mp4 --target en --consent      # 交付 output/demo.json + output/demo.mp4
  python3 dub.py input/*.mp4 --target ja                   # 批量；未声明授权时用系统音色
  python3 dub.py input/demo.mp4 --until plan               # 停在③，把 work/demo/plan.json 交给 Agent 翻译
  python3 dub.py input/demo.mp4 --translations my.json     # 导入译文，从④继续

每一步的中间结果写在 work/<视频名>/，再次运行时直接复用（--fresh 全部重算），改了译文只会重做后面几步。
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
from pathlib import Path

import bailian
import demo_kit as kit
import media
import pause_plan
import smooth_dub

DIR = Path(__file__).resolve().parent
LANGS = {"en": "英语", "ja": "日语", "ko": "韩语", "es": "西班牙语", "fr": "法语", "de": "德语", "it": "意大利语",
         "pt": "葡萄牙语", "ru": "俄语", "id": "印尼语", "vi": "越南语", "th": "泰语", "ar": "阿拉伯语"}
REF_TARGET_S, REF_MAX_S, REF_MIN_S = 15.0, 20.0, 3.0   # 参考音频：目标 15 秒，最长 20 秒，不足 3 秒不复刻
REF_SPAN_MIN_MS = 1200
TRANSLATE_BATCH = 40
TTS_RETRY_RATE_MAX = 1.3
QA_MIN_SCORE, QA_MIN_MEAN, QA_MAX_OVERFLOW_MS, QA_LEAK_CHARS = 3, 3.5, 300, 2

ALIGN_PROMPT = """你是视频配音前的校对员。请听这段音频，对照下面的 ASR 转写稿。转写稿的时间戳是准确的，不要改时间。
请完成四件事：
1. 说话人重标注：ASR 可能把音色相近的两个人合并成一个，或者把同一个人拆成两个。按你听到的声音给每一句重新标注说话人（A、B、C……），同一个人前后一致。
2. 身份：每个说话人写性别、大致年龄段、在视频里的角色（如主持人、嘉宾、旁白），以及一句适合配音的声音描述（音调、语速、音色特点，不要写像某个名人）。
3. 情绪卡：每一句的情绪（平静、开心、激动、疑惑、严肃、悲伤、生气等），和一句不超过 25 个字的配音语气指令，例如「语气兴奋，语速稍快」。
4. 同音字建议：只在你确信 ASR 写错了同音字或近音字时给出，原文里必须能找到 from。
只输出 JSON，不要其他文字：
{"speakers":[{"id":"A","gender":"male|female|unknown","age":"青年","role":"主持人","voice":"声音描述"}],
 "sentences":[{"sid":1,"speaker":"A","emotion":"平静","instruction":"语气平静，语速适中","fixes":[{"from":"在","to":"再"}]}]}

ASR 转写稿（#句号 [ASR 说话人] 起止时间 文本）：
"""

TRANSLATE_SYSTEM = """你是影视配音译者，把中文台词译成{lang}，译文会用原说话人的声音配音、放回原时间轴。要求：
- 口语化、自然，像母语者在这个场景里会说的话；保留语气、情绪和人物关系，不要书面腔
- 每句给了音节预算：译文音节数尽量落在 budget 的 80%–100%，绝不超过 budget_max。宁可意译、删掉口头禅和重复，也不要超
- 人名、品牌、术语前后一致；不加注释、括号说明或引号
- 一句对一句，id 不变，不合并、不拆分；不要输出中文
只输出 JSON：{{"segments":[{{"id":1,"text":"译文"}}]}}"""

SHORTEN_USER = """下面这些译文超出了音节预算，读出来会比原句长、对不上画面。请在保留意思和语气的前提下改短，
syllables 是当前音节数，必须降到 budget 以内。只输出 JSON：{"segments":[{"id":1,"text":"新译文"}]}
"""

QA_PROMPT = """这是一段 AI 配音成片的对白轨（不含背景音）。请只凭听感盲测，不需要知道原文。
下面列出每句的起止时间和说话人标签。请打分（1–5 分，5 分最好）：
- timbre：同一说话人的音色前后是否一致，不同说话人是否听得出区别
- pace：语速是否自然，有没有明显赶、拖或忽快忽慢
- overlap：有没有两句叠在一起、句子被截断或爆音
- naturalness：整体像不像真人配音，有没有机器腔、怪异重音或念错
再列出有问题的句子。只输出 JSON：
{"scores":{"timbre":4,"pace":4,"overlap":5,"naturalness":4},"issues":[{"id":3,"type":"语速过快","note":"一句话说明"}],"summary":"一句话总评"}

时间轴（id 起止 说话人）：
"""


# ───────────────────────── 小工具 ─────────────────────────

def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else None


def save(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def mmss(ms: int) -> str:
    return f"{ms // 60000:02d}:{ms % 60000 / 1000:04.1f}"


def has_cjk(text: str) -> int:
    return len(pause_plan._CJK.findall(text))


# ───────────────────────── ①② 转写与校正 ─────────────────────────

def words_from_asr(result: dict) -> list[dict]:
    words = []
    for transcript in result.get("transcripts") or []:
        for i, sentence in enumerate(transcript.get("sentences") or []):
            sid = sentence.get("sentence_id", i + 1)
            speaker = f"S{sentence.get('speaker_id', 0)}"
            for w in sentence.get("words") or []:
                words.append({"start": int(w["begin_time"]), "end": int(w["end_time"]), "text": w.get("text") or "",
                              "punct": w.get("punctuation") or "", "speaker": speaker, "sid": sid})
    return words


def transcript_lines(words: list[dict]) -> str:
    by_sid: dict = {}
    for w in words:
        by_sid.setdefault(w["sid"], []).append(w)
    return "\n".join(f"#{sid} [{ws[0]['speaker']}] {mmss(ws[0]['start'])}–{mmss(ws[-1]['end'])} "
                     f"{''.join(x['text'] + x['punct'] for x in ws).strip()}" for sid, ws in by_sid.items())


def apply_align(words: list[dict], align: dict) -> tuple[list[dict], dict]:
    """omni 的重标注只改说话人标签，时间戳不动。返回新词表和按句号索引的情绪卡 / 同音字建议。"""
    cards = {s.get("sid"): s for s in align.get("sentences") or [] if isinstance(s, dict)}
    relabeled = [dict(w, asr_speaker=w["speaker"], speaker=str(cards.get(w["sid"], {}).get("speaker") or w["speaker"]))
                 for w in words]
    return relabeled, cards


def attach_cards(plan: list[dict], words: list[dict], cards: dict) -> None:
    for seg in plan:
        sids = []
        for w in words:
            if seg["start_ms"] <= w["start"] < seg["end_ms"] + 1 and w["speaker"] == seg["speaker"] and w["sid"] not in sids:
                sids.append(w["sid"])
        card = cards.get(sids[0], {}) if sids else {}
        seg["emotion"] = card.get("emotion") or ""
        seg["instruction"] = bailian.trim_instruction(card.get("instruction") or "")
        fixed, applied = seg["source"], []
        for sid in sids:
            for fix in cards.get(sid, {}).get("fixes") or []:
                src, dst = str(fix.get("from") or ""), str(fix.get("to") or "")
                if src and dst and src != dst and src in fixed:
                    fixed = fixed.replace(src, dst, 1)
                    applied.append({"from": src, "to": dst})
        if applied:
            seg["source_asr"], seg["source"], seg["fixes"] = seg["source"], fixed, applied


# ───────────────────────── ④ 翻译 ─────────────────────────

def translate(client: bailian.Client, plan: list[dict], speakers: dict, target: str) -> dict[int, str]:
    system = TRANSLATE_SYSTEM.format(lang=LANGS.get(target, target))
    out: dict[int, str] = {}
    for i in range(0, len(plan), TRANSLATE_BATCH):
        batch = plan[i:i + TRANSLATE_BATCH]
        context = [{"source": s["source"], "text": out.get(s["id"])} for s in plan[max(0, i - 3):i]]
        rows = [{"id": s["id"], "speaker": speakers.get(s["speaker"], {}).get("role") or s["speaker"],
                 "emotion": s.get("emotion"), "seconds": round((s["end_ms"] - s["start_ms"]) / 1000, 1),
                 "budget": s["budget"], "budget_max": s["budget_max"], "source": s["source"]} for s in batch]
        user = (f"前文（只作参考，不用翻译）：{json.dumps(context, ensure_ascii=False)}\n\n" if context else "") + \
            f"待翻译：{json.dumps(rows, ensure_ascii=False)}"
        kit.say("云端", f"翻译 {client.llm_model}：第 {batch[0]['id']}–{batch[-1]['id']} 句")
        out.update(_segments(client.llm_json(system, user)))
    over = [s for s in plan if s["id"] in out and pause_plan.count_syllables(out[s["id"]], target) > s["budget"] * 1.15]
    if over:
        kit.say("云端", f"{len(over)} 句超出音节预算，要求改短")
        rows = [{"id": s["id"], "source": s["source"], "text": out[s["id"]], "budget": s["budget"],
                 "syllables": pause_plan.count_syllables(out[s["id"]], target)} for s in over]
        out.update(_segments(client.llm_json(system, SHORTEN_USER + json.dumps(rows, ensure_ascii=False))))
    return out


def _segments(data: dict) -> dict[int, str]:
    return {int(s["id"]): str(s.get("text") or "").strip() for s in data.get("segments") or []
            if isinstance(s, dict) and str(s.get("id", "")).isdigit()}


def import_translations(path: Path) -> dict[int, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, dict) and "segments" in data:
        return {int(s["id"]): s.get("target") or s.get("text") or "" for s in data["segments"]}
    return {int(k): str(v) for k, v in data.items()}


# ───────────────────────── ⑥ 参考音频 ─────────────────────────

def reference_spans(plan: list[dict], speaker: str) -> list[tuple[int, int]]:
    """挑这个说话人最长、且不与别人重叠的几段，凑到 10–20 秒。"""
    others = [(s["start_ms"], s["end_ms"]) for s in plan if s["speaker"] != speaker]
    mine = [(s["start_ms"], s["end_ms"]) for s in plan if s["speaker"] == speaker
            and s["end_ms"] - s["start_ms"] >= REF_SPAN_MIN_MS
            and not any(a < s["end_ms"] and s["start_ms"] < b for a, b in others)]
    spans, total = [], 0.0
    for start, end in sorted(mine, key=lambda x: x[0] - x[1]):
        if total >= REF_TARGET_S:
            break
        end = min(end, start + int((REF_MAX_S - total) * 1000))
        spans.append((start, end))
        total += (end - start) / 1000
    return sorted(spans)


# ───────────────────────── ⑨ 质检 ─────────────────────────

def leak_check(words: list[dict], placements: list[dict], target: str) -> list[dict]:
    if target == "zh":
        return []
    flagged = []
    for p in placements:
        heard = "".join(w["text"] for w in words if p["at_ms"] - 100 <= w["start"] < p["at_ms"] + p["dur_ms"] + 100)
        if has_cjk(heard) >= QA_LEAK_CHARS:
            flagged.append({"id": p["id"], "heard": heard.strip()})
    return flagged


def gate(qa: dict, placements: list[dict]) -> dict:
    scores = [v for v in (qa.get("blind", {}).get("scores") or {}).values() if isinstance(v, (int, float))]
    worst_overflow = max([p["overflow_ms"] for p in placements] or [0])
    reasons = []
    if qa.get("leaks"):
        reasons.append(f"{len(qa['leaks'])} 句听到源语言")
    if scores and (min(scores) < QA_MIN_SCORE or statistics.mean(scores) < QA_MIN_MEAN):
        reasons.append(f"盲测分数偏低（最低 {min(scores)}，平均 {statistics.mean(scores):.1f}）")
    if worst_overflow > QA_MAX_OVERFLOW_MS:
        reasons.append(f"最长越界 {worst_overflow} ms")
    return {"passed": not reasons, "reasons": reasons, "max_overflow_ms": worst_overflow}


# ───────────────────────── 主流程 ─────────────────────────

def dub_one(video: Path, args, client: bailian.Client) -> bool:
    name = video.stem
    work = DIR / "work" / name
    out_json, out_mp4 = DIR / "output" / f"{name}.json", DIR / "output" / f"{name}.mp4"
    if args.fresh and work.exists():
        for p in sorted(work.rglob("*"), reverse=True):
            p.unlink() if p.is_file() else p.rmdir()
    work.mkdir(parents=True, exist_ok=True)
    print(f"\n━━ {video.name} ━━", flush=True)
    duration = media.probe_duration_ms(video)
    with_video = media.has_video(video)
    kit.say("设备", f"时长 {duration / 1000:.1f} 秒{'' if with_video else '（纯音频，只交付音轨）'}")

    mono = work / "audio16k.wav"
    if not mono.is_file():
        media.extract_audio(video, mono, 16000, 1)
    mp3 = work / "audio.mp3"
    if not mp3.is_file():
        media.to_mp3(mono, mp3)

    # ① 转写
    asr = load(work / "asr.json")
    if asr is None:
        kit.say("云端", f"① 转写 {bailian.ASR_MODEL}（词级时间戳 + 说话人分离）")
        asr = client.transcribe(client.upload_temp(mono, bailian.ASR_MODEL), args.source, args.speakers)
        save(work / "asr.json", asr)
    words = words_from_asr(asr)
    if not words:
        kit.say("提示", "没有识别到语音，跳过")
        return False
    kit.say("云端", f"① {len(words)} 个词，ASR 分出 {len({w['speaker'] for w in words})} 个说话人")

    # ② omni 校正
    align = load(work / "align.json")
    if align is None and not args.no_align:
        kit.say("云端", f"② 校正 {bailian.OMNI_MODEL}（说话人重标注 + 身份 + 情绪卡 + 同音字）")
        align = client.omni_json(mp3, ALIGN_PROMPT + transcript_lines(words))
        save(work / "align.json", align)
    words, cards = apply_align(words, align or {})
    speakers = {str(s.get("id")): s for s in (align or {}).get("speakers") or [] if isinstance(s, dict)}
    for sp in sorted({w["speaker"] for w in words}):
        info = speakers.get(sp, {})
        kit.say("云端", f"② 说话人 {sp}：{info.get('gender', '?')} · {info.get('age', '?')} · {info.get('role', '?')}")

    # ③ 时间轴骨架
    plan = pause_plan.build_plan(words, args.target, duration, args.rate)
    attach_cards(plan, words, cards)
    save(work / "plan.json", {"target": args.target, "speakers": speakers, "segments": plan})
    fixes = sum(len(s.get("fixes") or []) for s in plan)
    kit.say("设备", f"③ {len(plan)} 个小节，音节预算 {args.rate or pause_plan.RATES.get(args.target, pause_plan.DEFAULT_RATE)}"
                    f" / 秒；采纳同音字建议 {fixes} 处")
    if args.until == "plan":
        kit.say("App", f"已停在③：把 {work / 'plan.json'} 交给 Agent 翻译，写成 {{\"id\": \"译文\"}} 后用 --translations 导入")
        return True

    # ④ 翻译
    if args.translations:
        texts = import_translations(args.translations)
        save(work / "translation.json", texts)
    else:
        texts = {int(k): v for k, v in (load(work / "translation.json") or {}).items()}
        if not texts:
            texts = translate(client, plan, speakers, args.target)
            save(work / "translation.json", texts)
    missing = [s["id"] for s in plan if not texts.get(s["id"])]
    if missing:
        raise SystemExit(f"缺少第 {missing[:10]} 句的译文")
    for s in plan:
        s["target"] = texts[s["id"]]
        s["syllables"] = pause_plan.count_syllables(s["target"], args.target)
    over = sum(1 for s in plan if s["syllables"] > s["budget_max"])
    kit.say("云端", f"④ 译文 {len(plan)} 句，超出可用时长预算 {over} 句")

    # ⑤ 人声分离
    vocals = background = None
    if not args.no_separation:
        stereo = work / "audio44k.wav"
        if not stereo.is_file():
            media.extract_audio(video, stereo, 44100, 2)
        try:
            stem_dir = work / "demucs" / "htdemucs" / stereo.stem
            if (stem_dir / "vocals.wav").is_file():
                vocals, background = stem_dir / "vocals.wav", stem_dir / "no_vocals.wav"
            else:
                kit.say("设备", "⑤ 人声分离 demucs htdemucs（本地 CPU，1 分钟视频约需 1–3 分钟）")
                vocals, background = media.separate(stereo, work / "demucs", not args.no_auto_install)
            kit.say("设备", "⑤ 分离完成：人声用于截参考音频，背景音保留到成片")
        except media.MediaError as exc:
            kit.say("提示", f"⑤ 跳过人声分离：{exc}；成片只有配音，没有背景音")

    # ⑥ 参考音频 + ⑦ 声音
    voices: dict[str, dict] = {}
    source_vocals = work / "vocals24k.wav"
    if not source_vocals.is_file():
        media.to_wav(vocals or mono, source_vocals)
    created: list[str] = []
    for sp in sorted({s["speaker"] for s in plan}):
        info = speakers.get(sp, {})
        preset = dict(v.split("=", 1) for v in args.voice or []).get(sp)
        spans = reference_spans(plan, sp)
        seconds = sum(b - a for a, b in spans) / 1000
        if preset:
            voices[sp] = {"voice": preset, "kind": "system", "ref_seconds": 0}
        elif args.consent and seconds >= REF_MIN_S:
            ref = work / "refs" / f"{sp}.wav"
            seconds = media.cut_and_join(source_vocals, spans, ref)
            cache = load(work / "voices.json") or {}
            voice_id = cache.get(sp, {}).get("voice") if cache.get(sp, {}).get("kind") == "cloned" else None
            if not voice_id:
                kit.say("云端", f"⑥⑦ 复刻 {sp} 的声音（参考音频 {seconds:.1f} 秒）")
                voice_id = client.enroll(client.upload_temp(ref, bailian.TTS_MODEL), f"dub{sp.lower()}"[:10], seconds)
                created.append(voice_id)
            voices[sp] = {"voice": voice_id, "kind": "cloned", "ref_seconds": round(seconds, 1)}
        else:
            why = "未声明已获授权（--consent）" if not args.consent else f"可用原声只有 {seconds:.1f} 秒"
            kit.say("提示", f"⑥ {sp} 用系统音色 {args.fallback_voice}：{why}")
            voices[sp] = {"voice": args.fallback_voice, "kind": "system", "ref_seconds": round(seconds, 1),
                          "describe": info.get("voice") or ""}
        voices[sp].update({k: info.get(k) for k in ("gender", "age", "role") if info.get(k)})
    save(work / "voices.json", voices)

    # ⑦ 配音
    clips, meta = {}, load(work / "tts.json") or {}
    for s in plan:
        v = voices[s["speaker"]]
        instruction = s.get("instruction") or ""
        if v["kind"] == "system" and v.get("describe"):
            instruction = bailian.trim_instruction(f"{v['describe']}；{instruction}" if instruction else v["describe"])
        clip = work / "tts" / f"{s['id']:04d}.wav"
        key = json.dumps([s["target"], v["voice"], instruction], ensure_ascii=False)
        rate = 1.0
        if not clip.is_file() or (meta.get(str(s["id"])) or {}).get("key") != key:
            room = s["slot_ms"] - smooth_dub.GAP_MS
            clip.parent.mkdir(parents=True, exist_ok=True)
            clip.write_bytes(client.synthesize(s["target"], v["voice"], args.target, instruction or None, rate))
            if media.wav_ms(clip) > room * smooth_dub.MAX_SPEED:
                rate = min(TTS_RETRY_RATE_MAX, media.wav_ms(clip) / (room * 1.1))
                clip.write_bytes(client.synthesize(s["target"], v["voice"], args.target, instruction or None, rate))
            meta[str(s["id"])] = {"key": key, "rate": round(rate, 2)}
            save(work / "tts.json", meta)
        clips[s["id"]] = clip
        s["tts_rate"] = meta[str(s["id"])]["rate"]
    kit.say("云端", f"⑦ 合成 {len(clips)} 句（{bailian.TTS_MODEL}，音频内嵌 AIGC 隐性标识）")

    # ⑧ 对齐混音
    placements = smooth_dub.place(plan, {i: media.wav_ms(c) for i, c in clips.items()}, duration)
    sped = sum(1 for p in placements if p["speed"] > 1.0)
    kit.say("设备", f"⑧ 放置 {len(placements)} 句，零重叠；{sped} 句轻度加速（≤{smooth_dub.MAX_SPEED}×）")
    mix = work / "mix.wav"
    loudness = smooth_dub.render(placements, clips, duration, work, background, video if with_video else None,
                                 out_mp4 if with_video else None, mix)

    # ⑨ 质检
    qa: dict = {}
    if not args.skip_qa:
        kit.say("云端", "⑨ 质检：ASR 回查语言泄漏")
        dialog = work / "dialog.wav"
        back = client.transcribe(client.upload_temp(dialog, bailian.ASR_MODEL), None, None)
        qa["leaks"] = leak_check(words_from_asr(back), placements, args.target)
        dialog_mp3 = media.to_mp3(dialog, work / "dialog.mp3")
        by_id = {s["id"]: s for s in plan}
        timeline = "\n".join(f"{p['id']} {mmss(p['at_ms'])}–{mmss(p['at_ms'] + p['dur_ms'])} {by_id[p['id']]['speaker']}"
                             for p in placements)
        kit.say("云端", f"⑨ 质检：{bailian.OMNI_MODEL} 盲测")
        qa["blind"] = client.omni_json(dialog_mp3, QA_PROMPT + timeline)
        qa.update(gate(qa, placements))
        kit.say("App", f"⑨ 质检{'通过' if qa['passed'] else '未通过：' + '；'.join(qa['reasons'])}")

    # 交付
    by_place = {p["id"]: p for p in placements}
    result = {
        "schema": "aihw/dub@0.1",
        "source": video.name, "source_lang": args.source or "zh", "target_lang": args.target,
        "duration_ms": duration,
        "models": {"asr": bailian.ASR_MODEL, "align": None if args.no_align else bailian.OMNI_MODEL,
                   "translate": "imported" if args.translations else client.llm_model, "tts": bailian.TTS_MODEL},
        "speakers": [{"id": sp, **v} for sp, v in voices.items()],
        "segments": [{
            "id": s["id"], "speaker": s["speaker"], "start_ms": s["start_ms"], "end_ms": s["end_ms"],
            "source": s["source"], **({"source_asr": s["source_asr"], "fixes": s["fixes"]} if s.get("fixes") else {}),
            "target": s["target"], "emotion": s.get("emotion"), "budget": s["budget"], "syllables": s["syllables"],
            "dub": {k: by_place[s["id"]][k] for k in ("at_ms", "dur_ms", "speed", "overflow_ms")} | {"tts_rate": s["tts_rate"]}
            if s["id"] in by_place else None,
        } for s in plan],
        "loudness": {k: {"input_i": v.get("input_i"), "target_i": smooth_dub.DIALOG_LUFS if k == "dialog"
                         else smooth_dub.BACKGROUND_LUFS} for k, v in loudness.items()},
        "qa": qa or None,
        "aigc": {"implicit_tag": True, "note": "配音音频由 AI 生成；对外发布须按《人工智能生成合成内容标识办法》添加显式标识"},
    }
    save(out_json, result)
    if not with_video:
        out_audio = DIR / "output" / f"{name}.wav"
        out_audio.write_bytes(mix.read_bytes())
    kit.say("App", f"交付 {out_json.relative_to(DIR)}" + (f" + {out_mp4.relative_to(DIR)}" if with_video else
                                                       f" + output/{name}.wav"))
    if created and not args.keep_voices:
        for voice_id in created:
            client.delete_voice(voice_id)
        save(work / "voices.json", {sp: dict(v, voice=None) if v["kind"] == "cloned" else v for sp, v in voices.items()})
        kit.say("云端", f"已删除本次创建的 {len(created)} 个复刻音色（--keep-voices 可保留）")
    return not qa or qa.get("passed", True)


def main() -> None:
    parser = argparse.ArgumentParser(description="AI 视频翻译配音：中文视频 → 目标语言配音成片 + 字幕 JSON")
    parser.add_argument("videos", nargs="+", type=Path, help="输入视频（或音频）文件")
    parser.add_argument("--target", default="en", help=f"目标语言：{' / '.join(LANGS)}（默认 en）")
    parser.add_argument("--source", default="zh", help="源语言提示，传给转写（默认 zh）")
    parser.add_argument("--speakers", type=int, help="说话人数量参考值（2–100），不填自动判断")
    parser.add_argument("--consent", action="store_true",
                        help="声明已取得视频中每位说话人对声音复刻的授权；不加时一律用系统音色")
    parser.add_argument("--voice", action="append", metavar="说话人=音色",
                        help="给某个说话人指定系统音色，如 --voice A=longanhuan_v3.6，可重复")
    parser.add_argument("--fallback-voice", default=bailian.FALLBACK_VOICE, help="不复刻时用的系统音色")
    parser.add_argument("--keep-voices", action="store_true", help="保留本次创建的复刻音色（默认用完即删）")
    parser.add_argument("--translations", type=Path, help="导入译文 JSON：{\"1\": \"译文\", ...}，跳过模型翻译")
    parser.add_argument("--until", choices=["plan"], help="跑到③为止，导出 plan.json 交给 Agent 翻译")
    parser.add_argument("--rate", type=float, help="覆盖目标语言的每秒音节数")
    parser.add_argument("--cheap", action="store_true", help=f"翻译改用 {bailian.TRANSLATE_MODEL_CHEAP}")
    parser.add_argument("--no-align", action="store_true", help="跳过② omni 校正（说话人以 ASR 为准）")
    parser.add_argument("--no-separation", action="store_true", help="跳过⑤人声分离：参考音频取原声，成片不带背景音")
    parser.add_argument("--no-auto-install", action="store_true", help="缺 demucs 时不自动安装")
    parser.add_argument("--skip-qa", action="store_true", help="跳过⑨质检")
    parser.add_argument("--strict", action="store_true", help="质检未通过时退出码为 1")
    parser.add_argument("--fresh", action="store_true", help="清空 work/<视频名>/，全部重算")
    parser.add_argument("--region", choices=sorted(kit.REGIONS), help="临时覆盖 DASHSCOPE_API_REGION")
    args = parser.parse_args()

    cfg = kit.resolve(argparse.Namespace(mock=False, record=False, trace=None, region=args.region), DIR)
    if not cfg.live:
        sys.exit("需要百炼 Key：复制 .env.example 为 .env 填好 DASHSCOPE_API_KEY。离线自检请运行 python3 selftest.py")
    if cfg.region != "cn-beijing":
        sys.exit(f"{bailian.TTS_MODEL} 的非实时合成接口只在华北2（北京）提供，请使用北京地域的 Key")
    if args.target not in LANGS:
        sys.exit(f"--target 可选：{' / '.join(LANGS)}")
    media.require_ffmpeg()
    llm = bailian.TRANSLATE_MODEL_CHEAP if args.cheap else bailian.TRANSLATE_MODEL
    client = bailian.Client(cfg, llm)
    kit.banner("AI 视频翻译配音 · 百炼", cfg, [bailian.ASR_MODEL, bailian.OMNI_MODEL, llm, bailian.TTS_MODEL])

    ok = True
    for video in args.videos:
        try:
            ok = dub_one(video, args, client) and ok
        except (kit.HttpError, media.MediaError) as exc:
            kit.say("提示", f"{video.name} 失败：{exc}")
            ok = False
    cost = client.usage.cost(cfg.region, llm)
    kit.say("统计", f"转写 {client.usage.asr_seconds:.0f} 秒 · omni {sum(client.usage.omni_tokens)} Token · "
                    f"翻译 {sum(client.usage.llm_tokens)} Token · 合成 {client.usage.tts_chars} 字符 · "
                    f"复刻 {client.usage.voices} 个音色")
    kit.say("统计", f"约 ¥{kit.fmt_cny(cost['total'])}（转写 ¥{kit.fmt_cny(cost['asr'])} · omni ¥{kit.fmt_cny(cost['omni'])}"
                    f" · 翻译 ¥{kit.fmt_cny(cost['translate'])} · 合成 ¥{kit.fmt_cny(cost['tts'])}；复刻费用未计入）")
    if args.strict and not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
