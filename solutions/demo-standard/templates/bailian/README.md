# 品类名 · 百炼参考 demo（模板）

一句话：模拟什么设备、走哪条链路、输出什么。

> **状态：待真 Key 验证**。验证记录见 [VERIFY.md](./VERIFY.md)，标准见 [demo-standard](../../README.md)。

## 三步跑通

1. 准备环境：Python 3.9+；有依赖时 `pip install -r requirements.txt`
2. 填 Key：复制 `.env.example` 为 `.env`，填 `DASHSCOPE_API_KEY`；建议同时填 `DASHSCOPE_WORKSPACE_ID`（全部接口走业务空间专属域名，部分模型必填），地域默认北京
3. 运行：`python3 run.py`（Windows 用 `python run.py`）

没有 Key 时，同一条命令自动进入 mock，不联网、不计费。`python3 run.py --mock` 强制 mock。

## 模拟的设备

| 设备部件 | 默认（文件模拟） | 真设备（可选） |
|---|---|---|
| 麦克风 / 摄像头 / 传感器 | `samples/…` | `--mic` / `--camera` |
| 扬声器 / 屏幕 / 执行器 | `out/…` 或控制台 `[设备]` 日志 | — |

## 预期输出（mock）

```text
（粘贴一次 mock 运行的关键输出）
```

## 链路

```text
设备 → 接口 / 模型 → 设备
```

## 常用参数

| 参数 | 作用 |
|---|---|
| `--mock` | 强制离线 mock |
| `--region ap-southeast-1` | 临时切到新加坡 |
| `--record` | 真跑成功后把一行验证记录追加到 `VERIFY.md` |
| `--trace out/trace.json` | 把这次运行写成回放轨迹（`aihw/trace@0.1`），可在配套 APP 里打开 |

## 计费与延迟口径

单价表（北京 / 新加坡，附官方链接与查证日期）、首字延迟的起止点、免费额度。

## 常见问题

## 合规提示

## 文件

| 文件 | 说明 |
|---|---|
| `run.py` | 入口 |
| `demo_kit.py` | 百炼 demo 公共件（与模板逐字一致，勿单独修改） |
| `solution.yaml` | 方案清单 |
| `VERIFY.md` | 验证记录 |
