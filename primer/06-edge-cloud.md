<!-- HERO:START -->
<div align="center">

<sub><a href="../README.md">🏠 aihw-starter</a> &nbsp;›&nbsp; <a href="README.md">📚 AI 通识</a> &nbsp;›&nbsp; <b>06 端云协同基础</b></sub>

# 06 · 端云协同基础：什么任务适合端、什么必须上云

`AI 通识` · `Edge–Cloud Split`

</div>

---
<!-- HERO:END -->

> **本篇回答**：端侧该干什么、云端该干什么？延迟 / 隐私 / 成本 / 能力四维怎么切？为什么很多「端侧大模型」其实是端侧预筛 + 云推理？
>
> **建议先读**：[02 · 模型规格与芯片载体](./02-model-size-chips.md)（端上物理现实）。弱依赖：[01 · 开放权重与授权](./01-open-weights.md)、[04 · Token 与计费](./04-token-billing.md)。

## 〇、先建立直觉：大脑在云，反射在端

智能门铃：有人按铃——**本地立刻响**（反射）；要不要推送「陌生访客」、要不要云端人脸库比对——可以慢半拍上云（大脑）。

AI 硬件同理：用户可感知的「马上有反应」（灯效、打断、急停、UI）必须在端；吃内存、吃电、吃授权与计费的「真理解」大多在云。市面上大量宣传的「端侧大模型」，拆开看往往是 **端侧预筛 / 小模型路由 + 云端旗舰推理**，而不是把 70B 塞进眼镜镜腿。

## 一、四维权衡（再加两维约束）

| 维度 | 偏端 | 偏云 | 硬件题 |
|---|---|---|---|
| **延迟** | 唤醒、VAD、本地 UI &lt; 几十 ms | 往返 RTT + 排队；弱网抖动 | 体感「跟不跟手」 |
| **带宽 / 流量** | 只上传事件、压缩帧、文本 | 持续音视频流 | 蜂窝套餐与热点场景 |
| **隐私 / 合规** | 原始音视频不出门 | 云侧留存与跨境 | 儿童、家居、企业会议 |
| **能力天花板** | 受 [02](./02-model-size-chips.md) 内存带宽限制 | 旗舰、长上下文、工具与联网 | 「能不能答对」 |
| **离线 / 断电** | 兜底话术、安全停机 | 无网即不可用 | 卖点是否承诺离线 |
| **BOM / 功耗** | 更大 SoC、更大电池 | 更便宜主控 + 天线 | 玩具 30 元 BOM vs Agent 盒子 |

没有绝对正确的切分，只有**产品承诺**下的可接受组合。

## 二、任务分级

### 必须端

- 唤醒词、VAD、按键/触摸反馈、打断与清队
- 安全急停、限位、儿童锁类硬约束
- 本地 UI / 灯效 / 舵机「先动起来」的闭环

### 适合端

- 意图路由（闲聊 vs 同传 vs 拍照问）、技能开关
- 事件预筛（IPC 运动检测后再决定是否 Caption）
- 抽帧、降分辨率、音频压缩
- 小模型离线短答 / 兜底（常来自 [05 · 蒸馏](./05-distillation.md) 或采购的端侧模型）

### 必须云（或自建等价中心）

- 大上下文理解、多步推理、复杂多模态
- 联网搜索、账号级长记忆检索服务（见 [07](./07-context-memory.md)）
- 需要频繁换代、评测与风控统一升级的能力

## 三、三种典型拓扑

```
① 纯云
  端：采集 + 传输 + 播放
  云：ASR/LLM/TTS 或 Realtime 全家桶
  失败模式：凡事上云 → 弱网不可用、静默/空闲也烧钱、隐私面过大

② 端预筛 + 云（最常见）
  端：VAD / 唤醒 / 事件 / 压缩 / 可选小模型路由
  云：理解与生成
  失败模式：预筛阈值乱设 → 漏报或仍接近纯云账单

③ 端主力 + 云增强
  端：本地 LLM/VLA 扛主对话或控制（盒子 / 高配 SoC）
  云：难例、长文档、联网、同步与备份
  失败模式：凡事端侧 → BOM/功耗爆表，或「端侧大模型」名不副实
```

社区参照：小智一类 **ESP32 + 端云结合** 语音栈，见 [02-xiaozhi](../solutions/by-solution/02-xiaozhi.md)。**原则在 primer，具体栈在方案页**：[by-solution/06 端侧混合](../solutions/by-solution/06-edge-hybrid.md)。

## 四、与授权、成本的关系

- **授权**（[01](./01-open-weights.md)）：端上跑明文权重难按台约束 → 常见是 SDK 黑盒，或「端只做轻量、复杂走云用量」。
- **成本**（[04](./04-token-billing.md)）：端预筛的价值 = **少上传的 token / 音频秒数 × 单价** − 端侧 BOM 与电量；算不清上传节约，就谈不清「要不要上 NPU」。

## 五、对本仓库各品类意味着什么

| 品类 | 常见切分 | 详见 |
|---|---|---|
| 📷 IPC | 本地事件预筛；Caption / 复杂理解上云；常关长期记忆 | [01-ipc/02-solution](../solutions/by-category/01-ipc/02-solution.md) |
| 👓 AI 眼镜 | 算力与功耗紧 → 推理多在云；端做采集与传输优化 | [02-ai-glasses](../solutions/by-category/02-ai-glasses/) |
| 🧸 玩具 / ⌚ 手表 | 极低 BOM → 几乎纯云 + 端 VAD/按键 | [03-toys](../solutions/by-category/03-toys-companion/) · [08-smart-watch](../solutions/by-category/08-smart-watch/) |
| 🎧 AI 耳机 | 端：ENC/VAD/按需联网；云：同传或助手 | [06-ai-earphone](../solutions/by-category/06-ai-earphone/) |
| 🤖 Agent 盒子 | 可端跑 MoE / 本地主力；云增强难例 | [04-agent-hardware](../solutions/by-category/04-agent-hardware/) · [02](./02-model-size-chips.md) |
| 🦾 具身 | 安全与伺服在端；重感知/规划可云或边车 | [09-embodied](../solutions/by-category/09-embodied/) · [Qwen-Robot](../solutions/by-solution/05-qwen-robot.md) |

## 六、给 AI 硬件从业者的检查清单

问方案商（或自研评审）：

1. **离线能做什么**：无网时哪些功能仍可用，哪些明确降级
2. **弱网策略**：超时、重试、是否本地排队；会不会重复计费（回扣 04）
3. **端模型交付**：有无端模型；明文还是 SDK；谁适配下一颗 SoC
4. **预筛指标**：误报/漏报如何验收；IPC 抽帧策略谁拍板
5. **承诺话术**：对外「端侧 AI」是否与真实拓扑一致，避免合规与口碑风险

---

**更新日期**：2026-09
**贡献欢迎**：品类切分案例补充，请提 PR，详见 [`CONTRIBUTING.md`](../CONTRIBUTING.md)

<!-- FOOTER:START -->

---

<table width="100%">
<tr>
<td align="left" width="33%">

<a href="./05-distillation.md">← 05 蒸馏</a>

</td>
<td align="center" width="34%">

<a href="README.md">↑ 返回板块首页</a> · <a href="../README.md">🏠 仓库首页</a>

</td>
<td align="right" width="33%">

<a href="./07-context-memory.md">07 上下文与记忆 →</a>

</td>
</tr>
</table>
<!-- FOOTER:END -->
