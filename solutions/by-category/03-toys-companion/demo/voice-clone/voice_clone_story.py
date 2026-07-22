"""
voice_clone_story.py — 「爸妈声音陪伴」最小闭环 demo

流程：
  ① 用一段 20 秒左右的家长录音（公网可访问的 URL，如 OSS）克隆音色
  ② 用克隆出的音色合成一段睡前故事
  ③ 保存为 mp3，即可在设备/手机上播放试听

用法：
  # 首次：克隆音色并合成故事
  python voice_clone_story.py --audio-url https://your-oss/parent_25s.wav

  # 已有 voice_id：跳过克隆直接合成
  python voice_clone_story.py --voice-id cosyvoice-v3-5-flash-parent-xxxx

  # 自定义故事文本
  python voice_clone_story.py --voice-id xxx --text "从前有一只小兔子……"

⚠️ AI 生成代码，仅作接入参考。商用前请务必获得录音者的书面授权。
"""

import argparse
import os
import sys

import dashscope
from dashscope.audio.tts_v2 import AudioFormat, SpeechSynthesizer, VoiceEnrollmentService

# 默认播报模型：走量路线主流选择。注意音色与 target_model 强绑定，
# 用 flash 克隆的音色不能切到 plus 上播放（详见 02-solution.md 第五节）。
DEFAULT_TARGET_MODEL = "cosyvoice-v3.5-flash"

DEFAULT_STORY = (
    "宝贝，今天也辛苦啦。现在闭上眼睛，听我给你讲个故事。"
    "从前，有一只叫团团的小熊，它最喜欢在月亮升起的时候，"
    "坐在山坡上数星星。数着数着，一颗流星滑过，团团许了个愿望："
    "希望明天也能和最好的朋友一起玩。"
    "好了，故事讲完了，晚安，做个好梦。"
)


def enroll_voice(audio_url: str, target_model: str, prompt_audio_len: int) -> str:
    """用家长录音克隆音色，返回 voice_id（一次克隆可永久使用同 target_model）。"""
    service = VoiceEnrollmentService()
    result = service.create_voice(
        target_model=target_model,
        prefix="parent",
        url=audio_url,
        # 必须显式设为与录音时长一致，否则默认 10 秒会被 VAD 截断
        max_prompt_audio_length=prompt_audio_len,
    )
    voice_id = result["voice_id"]
    print(f"[1/2] 音色克隆完成，voice_id = {voice_id}")
    print("      （请妥善保存，下次可用 --voice-id 直接复用）")
    return voice_id


def synthesize_story(voice_id: str, target_model: str, text: str, output: str) -> None:
    """用克隆音色合成故事音频并保存。"""
    synthesizer = SpeechSynthesizer(
        model=target_model,
        voice=voice_id,
        format=AudioFormat.MP3_22050HZ_MONO_256KBPS,
    )
    audio = synthesizer.call(text)
    if audio is None:
        print("合成失败：", synthesizer.get_last_request_id(), file=sys.stderr)
        sys.exit(1)
    with open(output, "wb") as f:
        f.write(audio)
    print(f"[2/2] 故事合成完成 → {output}")
    print(f"      request_id = {synthesizer.get_last_request_id()}")


def main() -> None:
    parser = argparse.ArgumentParser(description="爸妈声音陪伴最小闭环 demo")
    parser.add_argument("--audio-url", help="家长录音的公网 URL（wav/mp3，建议 ≥20 秒）")
    parser.add_argument("--voice-id", help="已克隆的音色 ID，提供则跳过克隆步骤")
    parser.add_argument("--text", default=DEFAULT_STORY, help="要合成的故事文本")
    parser.add_argument("--target-model", default=DEFAULT_TARGET_MODEL, help="TTS 播报模型")
    parser.add_argument("--prompt-audio-len", type=int, default=25, help="录音时长（秒），需与实际一致")
    parser.add_argument("--output", default="story_by_parent.mp3", help="输出音频文件名")
    args = parser.parse_args()

    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        print("请先设置环境变量 DASHSCOPE_API_KEY（见 .env.example）", file=sys.stderr)
        sys.exit(1)
    dashscope.api_key = api_key

    if args.voice_id:
        voice_id = args.voice_id
        print(f"[1/2] 复用已有音色 voice_id = {voice_id}")
    elif args.audio_url:
        voice_id = enroll_voice(args.audio_url, args.target_model, args.prompt_audio_len)
    else:
        parser.error("--audio-url 与 --voice-id 至少提供一个")
        return

    synthesize_story(voice_id, args.target_model, args.text, args.output)


if __name__ == "__main__":
    main()
