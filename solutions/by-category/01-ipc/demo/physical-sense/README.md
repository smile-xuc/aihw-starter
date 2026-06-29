# 🧪 Demo · 物理世界感知 Agent（IPC 场景）

> ⚠️ **本目录的代码由 AI 生成，仅作示例参考。生产使用前请务必自测、补全错误处理与重试逻辑。**

最小可运行示例：调用百炼「多模态交互开发套件」 + 「物理世界感知 Agent · IPC 场景」，
对一张图片（URL 或本地文件）输出结构化描述 —— `object` / `action` / `event` / `description` / `title`。

对应方案文档：[`../../02-solution.md` · 一、百炼 — 物理世界感知 Agent 接入](../../02-solution.md#一百炼--物理世界感知-agent-接入)

## 前置条件

1. 在 [百炼控制台](https://bailian.console.aliyun.com/) 创建多模态交互应用，按方案文档 7 步配置完成，发布后获取：
   - `APP_ID`（`mm_xxxxxxxxxxxx...`）
   - `WORKSPACE_ID`（`llm-xxxxxxxxxxxx...`）
   - `DASHSCOPE_API_KEY`（`sk-xxxxxxxxxxxx...`）
2. 已开通「物理世界感知」服务、场景选择 IPC、并已发布。

## 安装

```bash
pip install -r requirements.txt
```

## 配置

```bash
cp .env.example .env
# 编辑 .env，填入 DASHSCOPE_API_KEY
# 然后编辑 test_physical_sense.py，填入 APP_ID 和 WORKSPACE_ID
```

## 运行

```bash
# 默认在线测试图片
python test_physical_sense.py

# 传入本地图片
python test_physical_sense.py /path/to/your/event.jpg
```

## 预期输出

```
============================================================
  物理世界感知智能体 - 摄像头画面洞察 Demo
============================================================

App ID: mm_xxxxxxxx
Workspace ID: llm-xxxxxxxx
...
--- 结构化解析结果 ---
标题: 女子与犬户外合影
对象: ['女性成人', '金毛犬']
行为: ['坐姿合影']
事件: []
描述: 一位年轻女性坐在草地上，与一只金毛犬合影，背景为开阔的户外场景。
```

## 文件清单

| 文件 | 说明 |
|---|---|
| `test_physical_sense.py` | 主脚本，含完整请求构造、SSE 流式解析、结构化结果展示 |
| `requirements.txt` | Python 依赖 |
| `.env.example` | 环境变量示例 |

## 常见问题

- **`401 Unauthorized`**：检查 `DASHSCOPE_API_KEY` 是否正确；检查应用是否已发布。
- **`InvalidParameter` 或返回空**：确认 Agent 场景选了 IPC；图片 URL 必须 HTTPS；base64 累计不超过 10 MB。
- **超时**：网络或大图导致，脚本默认 60s 超时，可在代码中调整。

更多接入细节、计费、能力边界见 [`02-solution.md`](../../02-solution.md)。
