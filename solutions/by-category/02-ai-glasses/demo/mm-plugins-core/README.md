# mm-plugins-core — 编程 Agent 用 Qwen-MM-Plugins core 插件读本地 PDF

本目录交付：**开发者参考实现**，用于学习和验证对应能力。该标签仅描述本仓代码；品类的商业化方向与上游项目的产品状态独立判断。商业集成时，按所选模型服务、素材／组件许可和具体产品的交付要求分别评估。

给已经在用编程 Agent（Qwen Code、Claude Code、Codex 等）的开发者：装上 [Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins) 的 `core` 插件后，Agent 能在本机把 PDF 渲染成页面图片和文字层再回答，**不需要 DashScope Key**。眼镜、IPC 团队可以用同样的方式让 Agent 读规格书、看样张，再把提示词落到设备侧 VL 链路。导读见 [10 Qwen-MM-Plugins](../../../../by-solution/10-qwen-mm-plugins.md)。

> **状态：待 Harness 实测**。2026-10-25 在 Linux（Python 3.12、uv 0.13.5）上以 MCP 直连 `core` 1.3.0 跑通 `verify_core.py`；经 Harness 提问的记录见 [VERIFY.md](./VERIFY.md)。

版本针脚：`core` 发布 tag [`qwen-mm-plugins-core-v1.3.0`](https://github.com/QwenLM/Qwen-MM-Plugins/tree/qwen-mm-plugins-core-v1.3.0/src/capabilities/core)（提交 `33a5469`，2026-10-23），查证 2026-10-25。

## fixture

[`fixtures/sample.pdf`](./fixtures/sample.pdf) 两页，由 [`make_fixture.py`](./make_fixture.py) 只用标准库生成，逐字节可复现（`python3 make_fixture.py --check`）：

| 页 | 内容 | 用来检查 |
|---|---|---|
| 1 | 标题 **AIHW Fixture Sheet 01**；`Check code: MMP-7Q4`；物料表 Camera module 1 pcs / Microphone 2 pcs / Battery 410 mAh | 标题、表格单元格 |
| 2 | 标题 Appendix；`Check code on this page: MMP-2B8` | 是否读对页 |

页面文字写成 PDF 十六进制字符串，`grep "AIHW" fixtures/sample.pdf` 搜不到。Agent 答对说明确实做了渲染或文本抽取，不是把原始字节当文本读。

## 第 1 步：不经 Harness 自检（可自动化）

前置：Python 3.10+，装有 [uv](https://docs.astral.sh/uv/getting-started/installation/)（提供 `uvx`）。

```bash
cd solutions/by-category/02-ai-glasses/demo/mm-plugins-core
python3 verify_core.py
```

脚本只用标准库，按上游 `core/.mcp.json` 的同一条命令拉起 MCP server（`uvx --from "qwen-mm-plugins[core] @ git+…@qwen-mm-plugins-core-v1.3.0" qwen-mm-plugins-core`），子进程环境里剔除 `DASHSCOPE_*`、`QWEN_MM_*`、`OPENAI_*`。首次运行由 uv 下载约 250 MB 依赖（pypdfium2、matplotlib、playwright 等，`core` 的 `viz` 全套）。

预期输出（耗时以实际为准）：

```text
[MCP] 启动 qwen-mm-plugins-core（uvx，固定 qwen-mm-plugins-core-v1.3.0）；首次会下载依赖，约几分钟
[MCP] 子进程已剔除 DASHSCOPE_* / QWEN_MM_* / OPENAI_*，不带任何云端 Key
[MCP] 已连接（0.7 秒）：qwen_mm_plugins_core 1.3.0 · 协议 2025-06-18 · 工具 7 个
[MCP] visualize sample.pdf pages=1 → 文本块 5 · 图片 1
[检查] 第 1 页标题「AIHW Fixture Sheet 01」：通过
[检查] 第 1 页校验码「MMP-7Q4」：通过
[检查] 第 1 页物料表「Microphone」：通过
[检查] 第 1 页渲染图：image/jpeg → out/page1.jpeg
[检查] 第 2 页校验码「MMP-2B8」：通过
通过：core 在本地读出 fixture 的标题、校验码和表格，未用任何云端 Key。产物在 out/
```

`out/` 里有 `visualize-page1.json`（工具原始返回，图片数据已省略）、`page1.jpeg`（`core` 渲染的第 1 页）和 `server.stderr.log`。用本地源码调试时加 `--server-cmd "python3 -m qwen_mm_plugins_core"`。

## 第 2 步：装进 Harness 提问

前置：本机已装好并登录一个 Harness，主模型**要能看图**（只看文字层也能答出标题和表格，但看不到版面）。

```bash
git clone https://github.com/QwenLM/Qwen-MM-Plugins.git && cd Qwen-MM-Plugins
bash install.sh install --plugin core --harness qwen-code --dry-run   # 只打印将执行的命令
bash install.sh install --plugin core --harness qwen-code             # 按已发布 tag 安装
bash install.sh verify --plugin core                                  # 依赖与 MCP 启动检查
```

显式给出 `--plugin` 和 `--harness` 时安装器不进交互菜单。2026-10-25 用 `--dry-run` 核对的各 Harness 实际命令：

| `--harness` | 安装器执行的命令（`core` v1.3.0） |
|---|---|
| `qwen-code` | `qwen extensions install https://github.com/QwenLM/Qwen-MM-Plugins.git:qwen-mm-plugins-core --ref=qwen-mm-plugins-core-v1.3.0 --consent` |
| `claude` | `claude plugin marketplace add https://github.com/QwenLM/Qwen-MM-Plugins.git` → `claude plugin install qwen-mm-plugins-core@qwen-mm-plugins` |
| `codex` | `codex plugin marketplace add …` → `codex plugin marketplace upgrade qwen-mm-plugins` → `codex plugin add qwen-mm-plugins-core@qwen-mm-plugins` |
| `gemini` | `gemini mcp add -s user qwen-mm-plugins-core uvx --from … qwen-mm-plugins-core`，再从同一 tag 拉取 Skill |
| `codebuddy` / `qoder` / `openclaw` | 各自的 plugin marketplace 命令，以 `--dry-run` 输出为准 |

`verify` 在没有配置 Key 时会提示 `DASHSCOPE_API_KEY not set`，Office、LaTeX、Blender、Playwright 浏览器等系统工具也会标 ✗；这些只影响云端插件和其他格式，`core` 读 PDF 不需要。

装好后，在**本目录**打开 Harness，提问：

```text
用 qwen-mm-plugins-core 的 visualize 工具查看 fixtures/sample.pdf 第 1 页，列出页面标题、校验码和物料表。
```

也可以按 Harness 习惯写成 `@fixtures/sample.pdf 列出第 1 页标题`。部分 Harness 会把 `@` 引用的文件直接附进上下文，或者用自带的 PDF 读取能力，所以验收时要看工具调用记录，确认调用的是 `visualize`。

## 验收

- [ ] `verify_core.py` 输出「通过」，退出码 0
- [ ] `install.sh verify --plugin core` 退出码 0
- [ ] Harness 的工具调用记录里出现 `qwen-mm-plugins-core` 的 `visualize`，`file_path` 指向 `fixtures/sample.pdf`
- [ ] 回答包含标题 `AIHW Fixture Sheet 01`、校验码 `MMP-7Q4`，物料表里 Microphone 数量为 2；没有把第 2 页的 `MMP-2B8` 当成第 1 页内容
- [ ] 全程没有配置 `DASHSCOPE_API_KEY`（Harness 主模型用它自己的凭证）

## 失败态

| 现象 | 原因与处理 |
|---|---|
| `[MCP] 找不到 uvx`，退出码 2 | 没装 uv；按 [uv 安装文档](https://docs.astral.sh/uv/getting-started/installation/)装好后重开终端 |
| `initialize 超过 900 秒没有响应` | 首次下载依赖太慢；看 `out/server.stderr.log`，配好 PyPI 镜像或代理后重跑，或加 `--timeout 1800` |
| `服务进程已退出` | `uvx` 拉取 GitHub tag 失败或依赖编译失败；原因见 `out/server.stderr.log` |
| Harness 里看不到 `visualize` | 插件未启用或 Harness 没重启；重跑 `install.sh verify --plugin core --harness <name>`，按提示重启 Harness |
| 回答只有文字、说看不到图 | 主模型不支持图片输入；换能看图的主模型，或接受只用文字层 |
| Windows 原生终端装不上 | 上游只支持 WSL2；在 WSL 用户目录里克隆，不要放在 `/mnt/c` |

## 关键点

- **不需要 Key**：`core` 默认 native 模式，工具只返回图片和文字，由 Harness 主模型自己看；设 `QWEN_MM_NATIVE_MODE=0` 才会改调云端 VL 接口并计费
- **固定版本**：自检脚本和安装器都用发布 tag，不跟 main；升级时同时改 `verify_core.py` 的 `CORE_TAG` 和本页版本针脚
- **不进本仓 CI**：自检要从 GitHub 拉上游 tag、从 PyPI 下约 250 MB 依赖，只在本机或手动流水线跑

> ⚠️ AI 生成代码，仅作接入参考。
