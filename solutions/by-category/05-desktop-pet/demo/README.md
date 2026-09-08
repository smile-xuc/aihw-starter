<!-- HERO:START -->
<div align="center">

<sub><a href="../../../../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="../README.md">🪴 桌宠</a> &nbsp;›&nbsp; <b>🧪 Demo</b></sub>

# 🧪 Demo · 桌宠 / 毛绒

`🪴 桌宠` · `Demo`

</div>

---
<!-- HERO:END -->

> 本目录存放桌宠品类可运行示例。对应技术方案：[`02-solution.md`](../02-solution.md) 方案 C（标签嵌入式）与第八节硬约束。

## 已提供

### [`stream-tag-parser/`](./stream-tag-parser/) — 流式标签解析（离线可跑）

把模型输出

```text
<M>happy</M>[emoji-01][action-04]太棒啦！一起去玩吧～
```

按小切片喂给解析器，验证：跨 token 标签不提前触发、去标签文本可送 TTS、每轮标签数量可检查。

```bash
cd stream-tag-parser
python3 stream_tag_parser.py
python3 stream_tag_parser.py --chunk-size 1
python3 stream_tag_parser.py --text '<M>sad</M>[emoji-04]今天有点累～'
```

无需 API Key。嵌入式移植时复用同一套「缓冲 + 只消费完整标签」逻辑。

## 计划中（欢迎 PR）

- [ ] **`emoji-action-mapping/`** — 标签到端侧动作映射表示例
- [ ] **`emotion-sync/`** — 接 CosyVoice emotion 参数的最小播报
- [ ] **`servo-driver/`** — ESP32 LEDC 舵机驱动
- [ ] **`safety-fallback/`** — 自伤话题强制 neutral

## 贡献指引

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
