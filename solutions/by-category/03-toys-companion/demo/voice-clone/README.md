# 🧪 voice-clone — 爸妈声音陪伴最小闭环

「亲情包」核心功能的可运行示例：**20 秒家长录音 → 克隆音色 → 用爸妈的声音讲睡前故事**。

对应文档：[`02-solution.md` 4.1 节 · 亲情包](../../02-solution.md)

## 运行前准备

1. 开通千问大模型服务并创建 API-KEY（[获取方式](https://help.aliyun.com/zh/model-studio/get-api-key)）
2. 准备一段 **20 秒以上**的清晰录音（wav/mp3），上传到公网可访问的地址（如 OSS）
3. 安装依赖并配置环境变量：

```bash
pip install -r requirements.txt
export DASHSCOPE_API_KEY=sk-xxxx   # 或复制 .env.example 为 .env
```

## 运行

```bash
# 首次：克隆音色 + 合成故事（输出 story_by_parent.mp3）
python voice_clone_story.py --audio-url https://your-oss/parent_25s.wav

# 复用已克隆的音色（克隆一次永久可用，无需重复付费）
python voice_clone_story.py --voice-id cosyvoice-v3-5-flash-parent-xxxx

# 自定义故事文本
python voice_clone_story.py --voice-id xxx --text "从前有一只小兔子……"
```

## 关键坑位（详见 [02-solution.md 第五节](../../02-solution.md)）

- **音色与播报模型强绑定**：用 `cosyvoice-v3.5-flash` 克隆的音色不能切到 `-plus` 播放
- **`max_prompt_audio_length` 必须显式设置**：默认 10 秒，录音更长会被 VAD 截断
- **商用前必须拿到录音者的书面授权**

> ⚠️ AI 生成代码，仅作接入参考。
