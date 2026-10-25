# 验证记录 · 04 Agent 硬件 · 百炼 CLI 冒烟

状态：**待真 Key 验证**。2026-10-25 在 Linux（Node v22.23.4、`bl 2.5.1`）上跑通三条不计费路径，尚无真实调用记录：

- 无 Key：`bash run.sh` 停在鉴权，输出 `--dry-run` 请求体，退出码 0
- `--mock`（含 `--image --region intl`）：不发请求，请求地址切到 `https://dashscope-intl.aliyuncs.com`
- 无效占位 Key：`auth status` 显示 `source: env` 且已鉴权，真调用北京端点返回 HTTP 401「Incorrect API key provided」，脚本透传退出码 1；`bl auth login --api-key` 校验失败，退出码 3，不写配置

口径：

- **首字延迟**：本 demo 不开流式，记录 `bash run.sh` 打印的「整次 X 秒」，即 `bl text chat` 进程从启动到返回的时间，含 Node 和 CLI 启动
- **单次成本**：`out/chat.json` 的 `usage` × 表中地域 `qwen3.7-flash` 的目录价；`--image` 另加 1 张 `qwen-image-3.0` 的单价；价格以控制台为准
- **新增记录**：真跑成功后，把脚本最后一行 `[VERIFY]` 贴到下表末尾，补「验证人」和「单次成本」，在「备注」写网络环境

待实测（真 Key 时逐项写进「备注」，有结论后更新 README 与 `run.sh`）：

- [ ] **整次耗时**：北京、新加坡各跑一次，记 CLI 启动之外的网络耗时（`--verbose` 可看请求与响应时间）
- [ ] **思考 Token**：`qwen3.7-flash` 经 `bl text chat` 调用（不发 `enable_thinking`）时是否思考，`usage` 是否带 `completion_tokens_details.reasoning_tokens`
- [ ] **图片产物**：`--image` 下 `qwen-image-3.0` 同步返回耗时、`aihw.png` 的实际尺寸，默认是否带水印
- [ ] **接入地址变量**：`BAILIAN_BASE_URL`（安装文档）与 `DASHSCOPE_BASE_URL`（2.5.1 源码）哪个生效，结论写回 [09 导读](../../../../by-solution/09-bailian-cli.md)

| 日期 | 地域 | 模型 | 首字延迟 | 单次成本（元） | 输入 | 环境 | 验证人 | 备注 |
|---|---|---|---|---|---|---|---|---|
