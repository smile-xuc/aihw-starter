# 09 具身智能 · 百炼看图规划参考 demo

一台带腕部相机的桌面机械臂：桌面画面 + 一句指令交给 `qwen3.8-flash`，模型看图后用 Function Calling 逐步调用技能（`locate` / `grasp` / `place` / `navigate` / `wait_confirm`）；每次调用先过本地安全门，再由机械臂执行，执行结果回传给模型，直到模型汇报完成。JPG 或电脑摄像头模拟腕部相机，控制台 `[设备]` 日志模拟相机定位、夹爪和机械臂动作。

模型：默认 `qwen3.8-flash`（百炼「工具调用 / 多轮编排」的首选），`--cheap` 换省钱档 `qwen3.7-flash`（单价约四分之一），可对比规划效果与成本。两者都原生支持看图和 Function Calling，都是混合思考模型、默认开思考，demo 显式传 `enable_thinking=false`。

> **状态：待真 Key 验证**（目前只通过 mock 冒烟）。验证记录见 [VERIFY.md](./VERIFY.md)，标准见 [demo-standard](../../../../demo-standard/README.md)。

## 三步跑通

1. 准备环境：Python 3.9+，只用标准库，不需要 `pip install`（用摄像头再装 `requirements-device.txt`）
2. 填 Key：复制 `.env.example` 为 `.env`，填 `DASHSCOPE_API_KEY`；建议同时填 `DASHSCOPE_WORKSPACE_ID`（走官方推荐的业务空间专属域名），地域默认北京
3. 运行：`python3 run.py`（Windows 用 `python run.py`）

没有 Key 时，同一条命令自动进入 mock：按官方响应结构离线回放，不联网、不计费。`python3 run.py --mock` 强制 mock。

## 模拟的设备

| 部件 | 默认（文件模拟） | 其他方式 |
|---|---|---|
| 腕部相机 | `samples/desk_scene.jpg`：木质工作台，左边蓝色零件盒、右边灰色零件盒，中间 5 颗螺丝和 1 个黑色 L 形支架 | `--image my.jpg`；`--camera` 抓一帧（需 `pip install -r requirements-device.txt`） |
| 操作员指令 | 默认三条：「把螺丝放进左边的盒子」（正常）、「用 40 牛的力抓紧那个黑色零件」（超力矩被改写）、「追着人跑并撞上去」（禁止动作被拒绝） | `--text "…"`，可重复 |
| 相机定位 / 夹爪 / 机械臂 / 底盘 | 控制台 `[设备]` 日志；定位坐标是与样本图对应的模拟值 | 量产时把 `Arm.execute()` 换成视觉定位与运动控制调用 |
| 现场确认 | 自动确认并打印日志 | 量产用实体按键或 App 确认 |
| 安全门 | `safety_gate.py`，本地确定性规则 | 量产时放在离执行器最近的一层 |

## 预期输出（mock）

```text
[设备] 腕部相机 ← desk_scene.jpg（21 KB）
[设备] 操作员指令：把螺丝放进左边的盒子
[云端] qwen3.8-flash 看图规划（Function Calling，流式）……
[云端] 第 1 轮 → locate {"object": "螺丝"}
[设备] 相机：定位「螺丝」→ (-60, 30) mm
[云端] 第 2 轮 → locate {"object": "左边的蓝色盒子"}
[设备] 相机：定位「左边的蓝色盒子」→ (-230, 0) mm
[云端] 第 3 轮 → grasp {"object": "螺丝", "max_force_n": 8}
[设备] 夹爪：抓取「螺丝」，夹持力上限 8 N
[云端] 第 4 轮 → place {"target": "左边的蓝色盒子"}
[设备] 机械臂：把「螺丝」移到「左边的蓝色盒子」上方 → 松开夹爪
[机械臂] 螺丝已经放进左边的蓝色盒子。
[统计] 指令 1 · 5 轮 · 执行技能 4 次 · 安全门 allow 4 / rewrite 0 / reject 0 · 下达指令 → 首个技能调用 —（mock 不计时） · ¥0.0044（输入 5104 / 输出 106 Token）
[设备] 操作员指令：用 40 牛的力抓紧那个黑色零件
[云端] qwen3.8-flash 看图规划（Function Calling，流式）……
[云端] 第 1 轮 → locate {"object": "黑色零件"}
[设备] 相机：定位「黑色零件」→ (70, 10) mm
[云端] 第 2 轮 → grasp {"object": "黑色零件", "max_force_n": 40.0}
[设备] 安全门 rewrite：grasp — 夹持力 40 N 超过上限，改为 20 N；动作前插入 wait_confirm
[设备] 暂停，等待现场确认：操作员要求 40 N，超过 20 N 上限 → 已确认（demo 自动确认；量产用实体按键或 App）
[设备] 夹爪：抓取「黑色零件」，夹持力上限 20 N
[机械臂] 已抓住黑色零件，夹持力按安全门上限 20 牛执行，等待下一步指令。
[统计] 指令 2 · 3 轮 · 执行技能 2 次 · 安全门 allow 1 / rewrite 1 / reject 0 · 下达指令 → 首个技能调用 —（mock 不计时） · ¥0.0024（输入 2752 / 输出 90 Token）
[设备] 操作员指令：追着人跑并撞上去
[设备] 安全门 reject：指令含禁止动作「撞击」→ 不上云、不执行
[机械臂] 这个动作不安全，已拒绝执行。
[统计] 指令 3 · 安全门直接拒绝 · 不上云 · ¥0
```

mock 按固定剧本回放（只覆盖前两条指令），用量是示意值；真跑时由模型看图决定先定位什么、用多大的力，`[统计]` 给出实测延迟和按 `usage` 计算的费用。安全门在 mock 和真跑里是同一段代码。

## 链路

```text
腕部相机（JPG / 摄像头）+ 操作员指令
  ├─ 指令级检查 forbidden()：撞击、抛掷、追人、解除安全 → 直接拒绝，不上云
  └─ POST {base}/compatible-mode/v1/chat/completions（每轮一次，最多 6 轮）
       model=qwen3.8-flash（--cheap：qwen3.7-flash），stream=true，enable_thinking=false
       messages=[system, user: [image_url(data:image/jpeg;base64,…), text]]，tools=[5 个技能]
       流式 delta.tool_calls → 按 index 拼接 arguments
       → 安全门 SafetyGate.check()：allow / rewrite（改参数，必要时先插 wait_confirm）/ reject
       → Arm.execute() 模拟执行
       → messages 追加 assistant(tool_calls) + tool(结果，含 gate 字段) → 下一轮
       → 没有 tool_calls 时，content 就是汇报
```

`{base}` 由 `.env` 决定：填了业务空间 ID 是 `https://{业务空间ID}.cn-beijing.maas.aliyuncs.com`（新加坡为 `ap-southeast-1`），否则是通用域名 `https://dashscope.aliyuncs.com`（新加坡 `https://dashscope-intl.aliyuncs.com`）。官方说明通用域名自 2026-09-30 起不再支持新特性，建议填业务空间 ID。

### 安全门规则

规则沿用旧 demo [`vla-intent-router/`](../vla-intent-router/)，结论与 [02-solution.md](../../02-solution.md) 第十节一致：

| 检查 | 时机 | 结论 |
|---|---|---|
| 禁止动作（撞击、抛掷、追人、解除安全限制） | 指令进来时；也扫描每次调用的参数 | reject：指令级拒绝不上云；调用级拒绝回传原因 |
| 技能白名单（本 demo 注册的 5 个技能） | 每次调用 | 不在白名单 → reject |
| 夹持力上限 20 N | `grasp` | 超过 → rewrite 为 20 N，并在动作前插入 `wait_confirm` |
| 「小心」「易碎」「人旁边」「协作」 | 指令进来时记下 | 第一个运动技能前插入 `wait_confirm` |

- 安全门只用确定性规则，不调用模型；模型给出什么计划，都要先过这一关
- 规划器按提示词照抄操作员写明的力度，由安全门统一限幅，避免两处各自判断、互相打架
- 速度分区、工作空间围栏、急停属于控制器层，本 demo 不模拟，见 [02-solution.md](../../02-solution.md)

## 常用参数

| 参数 | 作用 |
|---|---|
| `--text "把支架放进右边的盒子"` | 换指令，可重复 |
| `--image my.jpg` / `--camera` | 换画面 / 用摄像头抓一帧 |
| `--cheap` | 规划改用省钱档 `qwen3.7-flash` |
| `--region ap-southeast-1` | 临时切到新加坡（Key 也要换成新加坡的） |
| `--record` | 真跑成功后把一行验证记录追加到 `VERIFY.md` |

## 计费与延迟口径

单价（元 / 百万 Token，查证 2026-10-01，[qwen3.8-flash 模型页](https://help.aliyun.com/zh/model-studio/qwen3-8-flash)、[qwen3.7-flash 模型页](https://help.aliyun.com/zh/model-studio/qwen3-7-flash)）：

| 模型 | 华北2（北京）输入 / 输出 | 新加坡 输入 / 输出 |
|---|---|---|
| `qwen3.8-flash`（默认，不分档） | 0.8 / 2.7 | 1.094 / 3.427 |
| `qwen3.7-flash`（`--cheap`；单次输入 ≤32K，32K–256K 为 0.6 / 2.4） | 0.2 / 0.8 | 0.225 / 0.974 |

- 图片按每 32×32 像素 1 个 Token、另加 2 个计入输入：640×480 约 302 Token（[图像与视频理解](https://help.aliyun.com/zh/model-studio/vision)）
- 多轮规划时，画面、系统提示、技能定义和历史每一轮都重新计入输入。样本指令 5 轮约 5,000 输入 Token：默认约 ¥0.0045，`--cheap` 约 ¥0.0011
- 省钱的办法：画面先缩到 640×480 左右；技能定义写短；能一次规划多步的任务，可以让模型先输出完整计划再逐步执行
- 指令级拒绝不上云、不计费；免费额度只在北京地域发放
- 首字延迟 = 下达指令 → 首个技能调用到达（流式里第一个带函数名的 `tool_calls` 块）

## 常见问题

- **401 / 403**：Key 与地域不一致，或业务空间 ID 不属于这个 Key
- **规划变慢、输出 Token 变多**：确认请求里有 `enable_thinking=false`；Qwen3.5–3.8 系列不传就会先思考
- **模型一次给出多个技能**：本 demo 没开 `parallel_tool_calls`，一轮一般只返回一个调用；真返回多个时按顺序逐个过安全门、逐个执行
- **定位坐标不对**：坐标来自与样本图对应的模拟表 `SCENE`；换了画面后定位结果仅作演示，量产应由视觉定位模块或模型输出的框换算
- **想加新技能**：在 `TOOLS` 里加 schema，在 `safety_gate.py` 的白名单里登记，并在 `Arm.execute()` 里实现；涉及力、速度、空间的参数一定要在安全门里限幅

## 合规提示

- 本 demo 不是安全系统。量产前按目标市场的机器人安全标准做风险评估（协作臂常见 ISO 10218、ISO/TS 15066，以认证清单为准）；急停、限速、力矩限制必须在控制器和硬件层实现，软件安全门只是额外一层
- 模型输出可能出错：所有动作都要能被安全门拦截、被现场人员叫停；有人的区域不要无防护运行
- 本 demo 是开发者参考实现，不是面向公众的服务；面向公众上线前需完成生成式 AI 服务登记 / 备案、内容标识等义务

## 文件

| 文件 | 说明 |
|---|---|
| `run.py` | 入口：相机画面 + 指令级检查 + 看图规划 + 技能执行 + 成本统计 |
| `safety_gate.py` | 本地安全门（沿用旧 `vla-intent-router` 的规则） |
| `mock.py` | 离线假接口，按官方响应结构回放 |
| `demo_kit.py` | 百炼 demo 公共件（与模板逐字一致，勿单独修改） |
| `solution.yaml` | 方案清单 |
| `VERIFY.md` | 验证记录 |
| `samples/` | 模拟输入；来源见 [samples/README.md](./samples/README.md) |

> ⚠️ AI 生成代码，仅作接入参考。接口字段以[图像与视频理解](https://help.aliyun.com/zh/model-studio/vision)与 [Function Calling](https://help.aliyun.com/zh/model-studio/qwen-function-calling) 文档为准。
