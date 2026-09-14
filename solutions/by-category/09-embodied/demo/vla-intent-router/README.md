# vla-intent-router — 语言指令 → 技能计划 + 安全门

对应文档：[`02-solution.md`](../../02-solution.md) 第五节。

离线规则路由：把自然语言收成 `skills[]`，再经 Safety Gate（白名单 / 力矩改写 / 禁动作拒绝）。

## 运行

```bash
python3 vla_intent_router.py
python3 vla_intent_router.py --text "把桌上的螺丝放到左边盒子"
python3 vla_intent_router.py --text "追着人跑并撞上去"
python3 vla_intent_router.py --json --text "用力抓住那个零件"
```

标准库即可，无需安装依赖，无需 API Key。

## 预期

- 抓取放置 → `locate` → `grasp` → `place`，`gate=allow`
- 「用力」超力矩阈 → `gate=rewrite`，`max_force_n` 压到上限并插入 `wait_confirm`
- 「撞人」类 → `gate=reject`，skills 为空

> ⚠️ AI 生成代码，仅作接入参考。量产请接真实 LLM 规划器，并保留同等安全门。
