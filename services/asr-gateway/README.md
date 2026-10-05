# BYOK 实时转写网关

网页会议纪要的可选接入组件：麦克风 PCM → `qwen-audio-3.1-asr-flash-streaming` → 确认转写。摘要仍由浏览器直连 `qwen3.8-flash`，复用原句回溯和人工修正。文件识别继续使用原来的 48 小时临时上传方案。

**仓库没有提供公共托管网关。** [公开体验页面](https://smile-xuc.github.io/aihw-starter/app/#/s/07-recorder.bailian/default)需要填写你自己可用的 `wss://主机/asr`；仅有百炼 Key 不能让浏览器直接设置官方 WebSocket 的鉴权头。

## 本机启动

Python 3.9+。网关独立依赖不改变原 demo 的标准库运行方式。

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r services/asr-gateway/requirements.txt
.venv/bin/python services/asr-gateway/server.py \
  --origin http://127.0.0.1:8789
```

另一个终端运行前端：

```bash
python3 -m http.server 8789 --bind 127.0.0.1 --directory docs
```

本机打开 `http://127.0.0.1:8789/app/#/s/07-recorder.bailian/default`，在「我的」填写相同地域的百炼 Key／业务空间。展开「实时录音纪要」，网关填 `ws://127.0.0.1:8766/asr`，确认网关地址和计费说明后开始。录音最多 180 秒，暂停不发送音频，较长暂停可能使模型断线。

健康检查不会调用模型：`curl http://127.0.0.1:8766/health`。本机地址是内部调试方法，不是云端公开预览链接。

## 录音前连接检查

展开录音面板，先核对浏览器、百炼凭证、网关地址三项配置。页面显示的当前 Origin 应在网关 `--origin` 白名单内；它不包含 `/app/` 路径。「设置我的 Key」保存后返回原体验，网关地址仍保留，由你手动开始录音。

填写你自己信任的地址后，点击「检查网关连接（不调用模型）」并确认目标。无需填写 Key，不申请麦克风，也不发送凭证、地域、业务空间或音频。检查使用与录音相同的 `/asr` WebSocket Upgrade 和来源校验：第一条消息必须严格为 `{"type":"probe"}`，本版网关只返回服务、协议、模型、180 秒上限，然后关闭连接；不会连接百炼，也不能在此连接上追加录音任务。

通过只说明此时网关连接和协议可用，不能证明 Key、模型权限、网关到百炼的网络、识别音质或计费可用。协议检查也不证明网关运营者可信。旧网关未支持 `probe` 时请更新网关；旧录音协议保持兼容，不强制检查通过才能录音。

失败时依次核对服务是否启动、TLS 证书、反向代理 `/asr` 与 WebSocket Upgrade、当前页面 Origin 白名单、并发容量及网络。取消检查或离开页面会关闭检查连接；修改地址后检查结果失效，需手动重试。公开页面只能使用 `wss://`，不要把 Key 放入网关 URL。

## 用于公开前端

把网关部署到你控制的服务器，在反向代理上启用 TLS 和 WebSocket Upgrade，转发 `/asr` 到网关的 `127.0.0.1:8766/asr`。启动时允许公开前端的 **Origin**，不含路径：

```bash
.venv/bin/python services/asr-gateway/server.py \
  --origin https://smile-xuc.github.io
```

`--origin` 可重复，不能用 `*`。公开前端只接受 `wss://`，`ws://` 仅用于本机前端。网关最多同时处理 4 个会话，每个连接只启动一个固定模型任务；不会自动重连，也没有任意目的地址代理接口。进一步的账号管理、生产并发和配额策略由部署方配置，本组件仍待真 Key／手机实机验证。

## Key、媒体和协议

- 用户 Key 在确认后通过 WebSocket 的第一条 JSON 消息传给**用户信任的网关**；网关用 `Authorization: Bearer …` 建连固定的百炼域名。Key 不放在地址、查询参数或日志里，不采用 URL `api_key` 绕行。
- 浏览器只保留发送所需的小段 PCM，不生成或保存录音文件；网关转发音频，不写文件和请求日志。字幕和摘要仍会发送给百炼处理，百炼侧按服务条款处理数据。
- 确认原句、纪要与请求 ID 可进入浏览器文字历史；临时字幕、PCM、Key、请求头及网关地址不写入历史／导出。
- 结束时发送 `finish-task`，收到最后一段 `result-generated` 与 `task-finished` 后才总结。超时／断线保留已确认文字，可由用户单独确认摘要重试，不重开 ASR。只停止本机等待不保证取消已提交请求或计费。
- 接口没有说话人标签时不推造身份。原句时间戳是已发送音频的时间，不包含暂停；暂停后的「我来做」不能归给一个假设的同一人。结构合法、事实正确分别核对。
- ASR 用量和账单尚未实测，页面总费用保持未知，不以 PCM 时长推成实际收费。

官方依据：[实时识别](https://help.aliyun.com/zh/model-studio/real-time-speech-recognition-user-guide)、[WebSocket 接入](https://help.aliyun.com/zh/model-studio/qwen-audio-asr-streaming-websocket-api)、[Python SDK](https://help.aliyun.com/zh/model-studio/qwen-audio-asr-streaming-python-sdk)。

## 无付费验证

```bash
.venv/bin/python -m unittest discover -s services/asr-gateway -p 'test_*.py'
node --test docs/app/tools/realtime.test.mjs
PLAYWRIGHT_CORE=/path/to/playwright-core/index.mjs CHROME=/path/to/chromium \
  node docs/app/tools/realtime-smoke.mjs
```

网关测试连接本机假提供方；浏览器测试使用模拟麦克风、实际 AudioWorklet 与本机模拟协议／摘要响应，不需要 Key，不产生云端调用。这些测试不表示真实接口、音质、计费和物理手机验收已完成。

浏览器回归另启动本机网关，实际验证 `/asr` Upgrade 与 `probe`；该测试网关禁止连接提供方。覆盖未配置、配置返回、旧协议、失败／取消、重复点击、连接／尾句／摘要阶段停止、麦克风中断与权限迟到后的释放，以及 320／390／768／1440 px 布局。CI 安装本服务的锁定依赖并运行网关回归。
