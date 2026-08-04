<!-- HERO:START -->
<div align="center">

<sub><a href="../../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="../README.md">👓 AI 眼镜</a> &nbsp;›&nbsp; <b>🧪 Demo</b></sub>

# 🧪 Demo · AI 眼镜

`👓 AI 眼镜` · `Demo`

</div>

---
<!-- HERO:END -->

> 本目录存放 AI 眼镜品类的可运行示例代码，与 [`02-solution.md`](../02-solution.md) 的两条路线对应。

## 已有 demo

| Demo | 路线 | 说明 |
|---|---|---|
| ✅ [**`kit-chat/`**](./kit-chat/) | 性价比路线，成熟可用 | 「一看即懂」最小闭环：照片 + 问题 → Qwen-VL → CosyVoice 播报，对应套件链路（拍照单帧 + 按次调用） |
| ✅ [**`omni-realtime/`**](./omni-realtime/) | 高性能路线，极致体验 | 「给 AI 打电话」：音频流 + 视频帧 → qwen3.5-omni-flash-realtime 全双工实时对话（按时长计费） |

两条路线按产品档位选用：全档位日常问答走 kit-chat 链路；旗舰档主打交互走 omni-realtime。

## 量产 SDK

端侧集成（Android / iOS / Linux / RTOS，含 VAD/唤醒/回声消除）使用多模态交互开发套件 SDK：

- 官方 Demo 仓库：https://github.com/aliyun/alibabacloud-bailian-speech-demo

## 计划包含的 demo（欢迎贡献）

- [ ] **`livetranslate/`** — 同声传译链路（音频流 → 译文文本 + 语音双通道输出）
- [ ] **`tingwu-notes/`** — 会议听记链路（录音上传 → 听悟离线转写 → 结构化纪要）
- [ ] **`image-uplink/`** — 图片上行链路优化对照实验（压缩/裁剪前后的延迟与 token 对比）

## 贡献指引

每个 demo 子目录建议包含：
- `README.md`：说明 demo 用途、运行方式、依赖
- `requirements.txt`：依赖清单
- 主程序文件（< 500 行，易于阅读）
- 测试图片/音频（小尺寸）

详见根目录 [`CONTRIBUTING.md`](../../../../CONTRIBUTING.md)。

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%">

<a href="../05-faq.md">← ❓ 常见问答</a>

</td>
<td align="center" width="34%">

<a href="../README.md">↑ 返回品类首页</a> · <a href="../../../../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<sub>（末篇）</sub>

</td>
</tr>
</table>
<!-- FOOTER:END -->
