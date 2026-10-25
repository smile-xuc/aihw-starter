# bailian-cli — 百炼 CLI 安装、鉴权与一次调用冒烟

本目录交付：**开发者参考实现**，用于学习和验证对应能力。该标签仅描述本仓代码；品类的商业化方向与上游项目的产品状态独立判断。商业集成时，按所选模型服务、素材／组件许可和具体产品的交付要求分别评估。

用官方 [百炼 CLI](https://github.com/modelstudioai/cli)（`bl`）走一遍「装好 → 鉴权 → 调一次模型 → 本地拿到产物」，确认这台开发机、这把 Key、这个地域能跑通，再去接盒子或宿主机脚本。导读见 [09 百炼 CLI](../../../../by-solution/09-bailian-cli.md)。

> **状态：待真 Key 验证**。2026-10-25 在 Linux、Node 22、`bl 2.5.1` 上跑通无 Key、mock 和无效 Key 三条路径；真 Key 记录见 [VERIFY.md](./VERIFY.md)。

## 最短路径

```bash
npm i -g bailian-cli@2.5.1          # Node.js 18.17+；官方要求 npm
bl --version                        # 期望 bl 2.5.1
bl auth login --api-key "$DASHSCOPE_API_KEY"   # 先校验再保存到 ~/.bailian/config.json
bl auth status --output json        # api_key.masked 为脱敏 Key，source 为 config 或 env
mkdir -p out
bl text chat --model qwen3.7-flash --message "用一句话介绍 AI 硬件，不超过 40 字。" --output json > out/chat.json
```

`DASHSCOPE_API_KEY` 只放在本机环境变量或密钥管理里（`export DASHSCOPE_API_KEY=sk-xxxx`），不写进脚本和仓库。Windows PowerShell 用 `$env:DASHSCOPE_API_KEY="sk-xxxx"`，命令相同。

## 一键脚本

```bash
bash run.sh                 # 有 Key：版本 → 鉴权状态 → 一次文本调用；没有 Key：停在鉴权
bash run.sh --image         # 再生成一张 1:1 图片（qwen-image-3.0，按张计费）
bash run.sh --region intl   # 新加坡地域，用国际站 Key
bash run.sh --mock          # 不发请求：只跑 --version、auth status 和 --dry-run 请求体
```

- 找 `bl` 的顺序：环境变量 `BL`，否则 `PATH` 里的 `bl`
- 脚本默认设 `DO_NOT_TRACK=1`（关遥测）和 `NO_UPDATE_NOTIFIER=1`（关启动时的 npm 版本检查）
- 产物都在 `out/`（已在 `.gitignore`）：`version.txt`、`auth-status.json`、`config.json`、`chat.json`；`--image` 另有 `aihw.png` 和 `image.json`；无 Key 或 `--mock` 时是 `dry-run-text.json`
- 最后一行 `[VERIFY]` 是可以直接贴进 [VERIFY.md](./VERIFY.md) 的表格行，补上验证人和单次成本即可

## 预期输出

没有 Key（退出码 0，不发请求、不计费）：

```text
[1/3] 版本
bl 2.5.1
[2/3] 鉴权状态（bl auth status --output json → out/auth-status.json）
      未鉴权 · 接入地址 北京 https://dashscope.aliyuncs.com
[3/3] 请求体预览（--dry-run，不发请求 → out/dry-run-text.json）
      POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions · model=qwen3.7-flash
停在鉴权：没有找到 Key，未发请求、未计费。
```

有 Key 时第 2、3 步变成（回复、用量和耗时以实际为准）：

```text
      已鉴权：Key sk-a...b1c2 · 来源 config · 北京 https://dashscope.aliyuncs.com
[3/3] 文本调用 bl text chat --model qwen3.7-flash（→ out/chat.json）
      回复：……
      用量：输入 … / 输出 … Token · 整次 … 秒（含 CLI 启动）
[VERIFY] | 2026-10-25 | 北京 | qwen3.7-flash | 整次 … 秒 | 按 out/chat.json 的 usage 计算 | 文本 1 条 | Linux · Node v22… · bl 2.5.1 | 待补 | |
```

## 验收

- [ ] `bl --version` 输出 `bl 2.5.1`
- [ ] `bl auth status --output json` 里 `authenticated` 为 `true`，`api_key.masked` 是脱敏 Key
- [ ] 几分钟内 `out/` 出现至少 1 个真实产物：`chat.json` 里有 `choices[0].message.content` 和 `usage`（`--image` 时另有 `aihw.png`）
- [ ] [VERIFY.md](./VERIFY.md) 追加一行，写明日期和地域（北京／国际）

## 失败态

| 现象 | 原因与处理 |
|---|---|
| `[bl] 没找到 bl`，退出码 2 | 没装或不在 `PATH`；`npm i -g bailian-cli@2.5.1`，或用 `BL=/路径/bl bash run.sh` |
| `停在鉴权`，退出码 0 | 没有 Key；`bl auth login --api-key …` 或设 `DASHSCOPE_API_KEY` 后重跑 |
| `auth status` 显示已鉴权，调用返回 `HTTP 401 · Incorrect API key provided`（退出码 1） | 环境变量里的 Key 不会预先校验；换成有效 Key，或用 `bl auth login --api-key` 先校验 |
| `bl auth login` 报 `API key validation failed`（退出码 3） | Key 无效或不属于默认地域；国际站 Key 加 `--region intl`（脚本）或 `--base-url https://dashscope-intl.aliyuncs.com`（手动） |
| `sk-sp-` 开头的 Key 调用被拒 | Token Plan Key 只能用于编程工具，换成模型 API Key |
| `Network request failed`（退出码 6） | 网络或代理问题；检查 `HTTPS_PROXY`，以及 `bl config show` 里的 `base_url` |

## 关键点

- **CI 只跑 mock**：`bash run.sh --mock` 不读 Key、不发请求；本仓 CI 装固定版本 `bailian-cli@2.5.1` 后只跑这一档
- **思考模式**：`bl text chat` 只有 `--enable-thinking` 开关，不会发 `enable_thinking=false`；`qwen3.7-flash` 这类混合思考模型按模型默认值决定是否思考，`usage` 以实际返回为准
- **地域**：北京和新加坡的 Key 不能混用；业务空间专属域名用 `--base-url` 指定（脚本里设 `DASHSCOPE_BASE_URL`）
- **计费**：CLI 本身免费，每次调用按所选模型的百炼目录价计费，以[模型价格](https://help.aliyun.com/zh/model-studio/model-pricing)和控制台为准

> ⚠️ AI 生成代码，仅作接入参考。
