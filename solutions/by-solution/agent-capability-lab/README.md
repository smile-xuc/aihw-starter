# Agent 能力本地演练

无依赖 Node.js runner，与[浏览器实验室](https://smile-xuc.github.io/aihw-starter/app/#/lab)共用状态逻辑。这里的后台结果都是人工样本；不是上游协议适配器。

```bash
node solutions/by-solution/agent-capability-lab/run.mjs voice
node solutions/by-solution/agent-capability-lab/run.mjs visual
node solutions/by-solution/agent-capability-lab/run.mjs cli
node solutions/by-solution/agent-capability-lab/run.mjs media
```

四组能力的真实本地运行路径、源码固定版本与付费边界见[完整开发指南](../09-agent-capabilities.md)。

## 真实本地媒体工具

`inspect_media.py` 在固定 Qwen-MM-Plugins checkout 的 core 虚拟环境中运行，调用 MCP 的 `read_image` / `crop`，可选 `media_info` / `read_video`，生成裁图和 JSON 报告。它实际处理文件，但不接宿主模型、不做语义推理；输出模式为 `local-tools`、模型调用为 0。精确安装和调用命令见[媒体开发步骤](../09-agent-capabilities.md#media)。
