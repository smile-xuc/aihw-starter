# 验证记录 · 02 AI 眼镜 · Qwen-MM-Plugins `core` 读 PDF

状态：**待 Harness 实测**。2026-10-25 在 Linux（Python 3.12.3、uv 0.13.5）上完成不经 Harness 的部分，尚无经 Harness 提问的记录：

- `python3 verify_core.py`：`core` 1.3.0 经 MCP stdio 连接 0.6–0.8 秒（依赖已缓存），`visualize` 读出第 1 页标题、校验码、物料表并返回 1 张 JPEG 页面图，`pages=2` 读出 `MMP-2B8`；子进程环境里已剔除 `DASHSCOPE_*` / `QWEN_MM_*` / `OPENAI_*`
- `install.sh install --plugin core --harness <name> --dry-run`：7 个内置 Harness 都直接打印安装命令，不进交互菜单
- `install.sh verify --plugin core`：退出码 0；提示 `DASHSCOPE_API_KEY not set` 和若干可选系统工具缺失，不影响读 PDF

口径：

- **地域**：`core` 在本机运行，写「本机」；Harness 主模型的服务地域写进「备注」
- **模型**：Harness 主模型（如 Qwen Code 配的模型），注明是否支持图片输入
- **首字延迟**：在 Harness 里发出提问 → 回答出现首字，含 `visualize` 调用时间
- **单次成本**：`core` 不调云端，记 0；主模型的 Token 费用按 Harness 自己的计费另计，能拿到用量时写进「备注」
- **新增记录**：在「输入」写提问原文，在「备注」写 Harness 名称与版本、是否在工具调用记录里看到 `visualize`、回答是否命中 `AIHW Fixture Sheet 01` / `MMP-7Q4` / Microphone 2

待实测（逐项写进「备注」，有结论后更新 README）：

- [ ] **Harness 调用**：Qwen Code、Claude Code、Codex 至少各一个，确认走的是 `visualize`，而不是 Harness 自带的 PDF 读取或 `@` 引用附件
- [ ] **看图与只看文字**：同一问题换一个不支持图片的主模型，回答是否仍命中标题和表格（只靠文字层）
- [ ] **图片 Token**：`budget` 默认 `large` 时第 1 页图片在主模型侧占多少输入 Token，与 `small` 对比
- [ ] **macOS / WSL2**：在 macOS 和 WSL2 上各跑一次 `verify_core.py`，记首次依赖下载耗时

| 日期 | 地域 | 模型 | 首字延迟 | 单次成本（元） | 输入 | 环境 | 验证人 | 备注 |
|---|---|---|---|---|---|---|---|---|
