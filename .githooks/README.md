# .githooks

本目录托管仓库共享的 Git Hooks，用 `core.hooksPath` 启用，可以随仓库一起提交。

## 启用方式

clone 仓库后**只需执行一次**：

```bash
git config core.hooksPath .githooks
```

启用后，`.git/hooks/` 下的默认 hook 会被忽略，本目录里的脚本会被自动调用。

## 已配置 hook

### `pre-commit` — 公开仓库合规检查

提交前扫描暂存区的新增/修改行，发现以下情况会**阻止提交**：

| 规则 | 适用范围 | 拦截目标 |
|---|---|---|
| 内部黑话 | `solutions/` `awesome/` 根 `README.md` | "我们 / 你 / 咱们 / 咱" 等第一/第二人称 |
| 内部销售口径 | 同上 | "转化率/留存率/续费率/复购率" 后紧跟具体百分比 |
| 敏感金额 | 同上 | "数字 + 万元 / 亿元 / 万人民币 / 亿人民币" |
| 疑似密钥 | 全仓库 | `sk-…` / `AKID…` / `Bearer …` |
| 内部系统名 | 全仓库 | `aone.alibaba` / `odps.aliyun` / `alibaba-inc.com` / `alidocs.dingtalk.com/i/nodes` |

豁免：
- `CHANGELOG.md`、`.githooks/` 自身、`docs/` 与 `CONTRIBUTING.md`（允许出现"你/我们"作为引导语）

如确认是误报，可临时跳过：

```bash
git commit --no-verify -m "…"
```

> 请谨慎使用 `--no-verify`，公开仓库的合规问题一旦提交进入历史就需要 force-push 才能清理。

### `commit-msg` — Conventional Commits

强制提交消息首行符合：

```
<type>(<scope>)?: <subject>
```

支持的 type：`feat / fix / docs / style / refactor / perf / test / build / ci / chore / revert / catalog`

首行长度 ≤ 80 字符（中文按字符数计）。详细说明请写到正文段（空一行后续写）。

示例：

```
feat(solutions): 新增 AI 录音卡品类完整版
fix(docs): 修正商业模式表格列对齐
feat!: v3.0.0 破坏性结构调整
```

## 添加新 hook

1. 在本目录新增可执行脚本，文件名等于 Git 钩子名（`pre-push`、`post-merge` 等）
2. `chmod +x .githooks/<name>`
3. 提交后所有协作者拉到的就是同一份 hook
