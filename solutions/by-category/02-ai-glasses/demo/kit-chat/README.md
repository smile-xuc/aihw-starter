# 🧪 kit-chat — 「一看即懂」最小闭环（性价比路线）

定位：**社区验证 demo**。用于学习和验证该能力；模型服务、素材／组件权利及产品交付条件须另行核对，当前不标作已完成商业化产品。

模拟眼镜端到云端的套件链路：**照片 + 问题 → Qwen3.7 视觉理解 → CosyVoice 语音回答**。

- **定位**：性价比路线，成熟可用——对应量产中的百炼硬件 Agent 开发平台（Agent Studio for Hardware，原多模态交互开发套件）链路（拍照单帧 + 秒级响应）
- **对应文档**：[`02-solution.md` 第一节 · 底座](../../02-solution.md)
- **与量产的差异**：量产使用套件 SDK（含端侧 VAD/唤醒/全双工与 RTOS 支持），本脚本用于快速体验链路效果、评估回答质量与延迟

## 运行

```bash
pip install -r requirements.txt
export DASHSCOPE_API_KEY=sk-xxxx   # 或复制 .env.example 为 .env

# 拍菜单问菜
python glasses_kit_chat.py --image menu.jpg --question "这是什么菜？帮我推荐一个"

# 看招牌翻译
python glasses_kit_chat.py --image sign.jpg --question "这个招牌写的什么？翻译成中文"
```

输出：终端打印 AI 回答文本 + 生成 `glasses_reply.mp3`（模拟眼镜播报）。

离线体验：`python glasses_kit_chat.py --mock`（不联网、不需要 Key；未设置 `DASHSCOPE_API_KEY` 时自动进入），只演示流程，不生成音频。

## 要点

- 提示词约束了「3 句话以内、口语化、无 markdown」——语音播报场景的回答风格与屏幕问答不同
- 图片走 base64 data URI（注意 `data:image/...;base64,` 前缀不可省略）；量产链路建议 App 直传 OSS 后传 URL，见 [`02-solution.md` 第六节](../../02-solution.md)
- 模型可按档位替换：`qwen3.7-flash`（性价比）/ `qwen3.7-plus`（效果优先）；`qwen-vl-plus` / `qwen-vl-max` 于 2026-10-10 下线（[阿里云公告 118177](https://www.aliyun.com/notice/118177)）。Qwen3.7 默认开思考，脚本已传 `enable_thinking: false`
- 播报用 `cosyvoice-v3-flash` + 系统音色 `longanyang`：`cosyvoice-v3.5-*` 没有系统音色，只能配复刻音色

量产 SDK demo：https://github.com/aliyun/alibabacloud-bailian-speech-demo

> ⚠️ AI 生成代码，仅作接入参考。
