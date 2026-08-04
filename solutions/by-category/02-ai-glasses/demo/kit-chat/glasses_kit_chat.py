"""
glasses_kit_chat.py — AI 眼镜「一看即懂」最小闭环（性价比路线）

模拟眼镜端到云端的套件链路：
  ① 输入一张「眼镜拍到的照片」+ 一句语音化的问题
  ② Qwen-VL 视觉理解（等价于套件的视觉问答模块）
  ③ CosyVoice 合成回答语音，保存为 mp3（等价于眼镜端 TTS 回播）

量产接入请使用多模态交互开发套件 SDK（含端侧 VAD/唤醒/全双工），
本脚本用于快速体验链路效果与评估回答质量。
Demo 仓库：https://github.com/aliyun/alibabacloud-bailian-speech-demo

用法：
  python glasses_kit_chat.py --image menu.jpg --question "这是什么菜？帮我推荐一个"
  python glasses_kit_chat.py --image sign.jpg --question "这个招牌写的什么？翻译成中文"

⚠️ AI 生成代码，仅作接入参考。
"""

import argparse
import base64
import os
import sys

import dashscope
from dashscope.audio.tts_v2 import AudioFormat, SpeechSynthesizer
from openai import OpenAI

VL_MODEL = "qwen-vl-plus"           # 性价比档；追求效果可换 qwen-vl-max
TTS_MODEL = "cosyvoice-v3.5-flash"
TTS_VOICE = "longanyang"            # 阳光男声，可按产品人设更换

SYSTEM_PROMPT = (
    "你是一副 AI 眼镜的语音助手。用户会拍下眼前的画面并提问。"
    "用口语化中文回答，直接给结论，控制在 3 句话以内，适合语音播报。"
    "不要使用列表、markdown 或特殊符号。"
)


def encode_image(path: str) -> str:
    """本地图片转 data URI（模拟眼镜压缩后经手机上传的图片）。"""
    suffix = path.rsplit(".", 1)[-1].lower()
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    return f"data:image/{suffix};base64,{data}"


def ask_vl(image_uri: str, question: str, api_key: str) -> str:
    """视觉问答：等价于套件的拍照问答模块。"""
    client = OpenAI(
        api_key=api_key,
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    )
    response = client.chat.completions.create(
        model=VL_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_uri}},
                    {"type": "text", "text": question},
                ],
            },
        ],
    )
    return response.choices[0].message.content.strip()


def speak(text: str, output: str) -> None:
    """TTS 合成：等价于眼镜端的语音回播。"""
    synthesizer = SpeechSynthesizer(
        model=TTS_MODEL,
        voice=TTS_VOICE,
        format=AudioFormat.MP3_22050HZ_MONO_256KBPS,
    )
    audio = synthesizer.call(text)
    if audio is None:
        print("TTS 合成失败：", synthesizer.get_last_request_id(), file=sys.stderr)
        sys.exit(1)
    with open(output, "wb") as f:
        f.write(audio)


def main() -> None:
    parser = argparse.ArgumentParser(description="AI 眼镜「一看即懂」最小闭环")
    parser.add_argument("--image", required=True, help="眼镜拍到的照片路径")
    parser.add_argument("--question", default="我看到的是什么？", help="用户的语音问题")
    parser.add_argument("--output", default="glasses_reply.mp3", help="回答语音输出文件")
    args = parser.parse_args()

    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        print("请先设置环境变量 DASHSCOPE_API_KEY（见 .env.example）", file=sys.stderr)
        sys.exit(1)
    dashscope.api_key = api_key

    print(f"[1/3] 上传图片并提问：{args.question}")
    answer = ask_vl(encode_image(args.image), args.question, api_key)
    print(f"[2/3] AI 回答：{answer}")

    speak(answer, args.output)
    print(f"[3/3] 回答语音已保存 → {args.output}")


if __name__ == "__main__":
    main()
