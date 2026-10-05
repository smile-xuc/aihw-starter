"""One BYOK ASR task per connection; no media/key persistence or generic proxy."""
from __future__ import annotations
import argparse
import asyncio
import json
import math
import re
import uuid
from aiohttp import web, ClientSession, WSMsgType, ClientTimeout

MODEL = "qwen-audio-3.1-asr-flash-streaming"
MAX_BYTES = 180 * 16000 * 2
ORIGINS = web.AppKey("origins", frozenset)
STATE = web.AppKey("state", dict)
SESSION = web.AppKey("session", ClientSession)
CONNECTOR = web.AppKey("test_connector", object)

def endpoint(region, workspace):
    if region not in ("cn-beijing", "ap-southeast-1") or not isinstance(workspace, str) or (workspace and not re.fullmatch(r"[A-Za-z0-9-]{1,80}", workspace)):
        raise ValueError("地域或业务空间格式无效")
    host = f"{workspace}.{region}.maas.aliyuncs.com" if workspace else ("dashscope.aliyuncs.com" if region == "cn-beijing" else "dashscope-intl.aliyuncs.com")
    return f"wss://{host}/api-ws/v1/inference"

def start_task(task_id):
    return {"header": {"action": "run-task", "task_id": task_id, "streaming": "duplex"},
            "payload": {"task_group": "audio", "task": "asr", "function": "recognition", "model": MODEL,
                        "parameters": {"format": "pcm", "sample_rate": 16000}, "input": {}}}

def finish_task(task_id):
    return {"header": {"action": "finish-task", "task_id": task_id, "streaming": "duplex"}, "payload": {"input": {}}}

async def health(request):
    return web.json_response({"service": "aihw-byok-asr", "protocol": 1, "model": MODEL, "max_seconds": 180})

async def asr(request):
    if request.query_string or request.headers.get("Origin") not in request.app[ORIGINS]:
        raise web.HTTPForbidden(text="来源未允许，或地址含查询参数")
    if request.app[STATE]["active"] >= 4:
        raise web.HTTPServiceUnavailable(text="实时会话已满")
    request.app[STATE]["active"] += 1
    client = web.WebSocketResponse(max_msg_size=65536, heartbeat=20)
    upstream = None
    submitted = False; ready = False; finishing = False
    try:
        await client.prepare(request)
        message = await asyncio.wait_for(client.receive(), 10)
        if message.type != WSMsgType.TEXT:
            raise ValueError("缺少会话配置")
        config = json.loads(message.data)
        key = config.get("key")
        if config.get("type") != "start" or not isinstance(key, str) or not key.strip() or len(key) > 512 or any(c in key for c in "\r\n"):
            raise ValueError("会话凭证无效")
        target = endpoint(config.get("region"), config.get("workspace", ""))
        task_id = uuid.uuid4().hex
        # The test connector is installed only by tests; CLI accepts no target override.
        connector = request.app.get(CONNECTOR)
        if connector:
            upstream = await connector(target, {"Authorization": "Bearer " + key})
        else:
            upstream = await request.app[SESSION].ws_connect(target, headers={"Authorization": "Bearer " + key}, heartbeat=20, max_msg_size=1_048_576)
        key = None; config.clear()
        await upstream.send_json(start_task(task_id)); submitted = True
        await client.send_json({"type": "submitted", "task_id": task_id})
        received = 0; duration = None
        async def receive_provider():
            nonlocal ready, duration
            async for msg in upstream:
                if msg.type != WSMsgType.TEXT:
                    raise ValueError("模型连接异常关闭")
                value = json.loads(msg.data); header = value.get("header", {})
                if header.get("task_id") != task_id:
                    raise ValueError("模型任务编号不匹配")
                event = header.get("event"); payload = value.get("payload", {})
                if event == "task-started":
                    if ready: raise ValueError("模型重复开始任务")
                    ready = True; await client.send_json({"type": "ready", "task_id": task_id})
                elif event == "result-generated":
                    if not ready: raise ValueError("模型任务未就绪")
                    sentence = payload.get("output", {}).get("sentence")
                    if sentence is not None:
                        await client.send_json({"type": "sentence", "text": sentence.get("text"), "begin_ms": sentence.get("begin_time"), "end_ms": sentence.get("end_time"), "final": sentence.get("sentence_end")})
                    raw_duration = payload.get("usage", {}).get("duration")
                    if isinstance(raw_duration, (int, float)) and not isinstance(raw_duration, bool) and math.isfinite(raw_duration) and raw_duration >= 0: duration = raw_duration
                elif event == "task-finished":
                    if not finishing: raise ValueError("模型任务提前结束")
                    await client.send_json({"type": "finished", "duration": duration}); return
                elif event == "task-failed":
                    # Do not echo provider errors, which may contain request inputs.
                    raise ValueError("模型任务失败，请检查 Key、地域、权限和额度")
                else:
                    raise ValueError("模型返回未知事件")
            raise ValueError("模型连接中断")

        async def receive_browser():
            nonlocal finishing, received
            async for msg in client:
                if msg.type == WSMsgType.BINARY:
                    if not ready or finishing or not msg.data or len(msg.data) % 2:
                        raise ValueError("音频顺序或格式无效")
                    received += len(msg.data)
                    if received > MAX_BYTES: raise ValueError("录音超过 180 秒")
                    await upstream.send_bytes(msg.data)
                elif msg.type == WSMsgType.TEXT:
                    value = json.loads(msg.data)
                    if value != {"type": "finish"} or not ready or finishing:
                        raise ValueError("结束指令无效")
                    finishing = True; await upstream.send_json(finish_task(task_id))
                else:
                    break
            raise ValueError("浏览器连接中断")

        tasks = [asyncio.create_task(receive_provider()), asyncio.create_task(receive_browser())]
        try:
            completed, _ = await asyncio.wait(tasks, timeout=300, return_when=asyncio.FIRST_COMPLETED)
            if not completed: raise ValueError("会话超时")
            for task in completed: task.result()
        finally:
            for task in tasks: task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
    except (asyncio.TimeoutError, json.JSONDecodeError, ValueError) as exc:
        if not client.closed and client.prepared:
            message = str(exc) if isinstance(exc, ValueError) and not isinstance(exc, json.JSONDecodeError) else "实时会话超时或格式无效"
            await client.send_json({"type": "error", "message": message})
    except Exception:
        if not client.closed and client.prepared:
            await client.send_json({"type": "error", "message": "无法完成实时转写；请核对网关网络、Key、地域和权限。不会自动重连。"})
    finally:
        if upstream and not upstream.closed:
            if submitted and ready and not finishing:
                try: await asyncio.wait_for(upstream.send_json(finish_task(task_id)),2)
                except Exception: pass
            await upstream.close()
        if client.prepared: await client.close()
        request.app[STATE]["active"] -= 1
    return client

def create_app(origins, *, test_connector=None):
    app = web.Application(); app[ORIGINS] = frozenset(origins); app[STATE] = {"active":0}
    if test_connector: app[CONNECTOR] = test_connector
    async def resources(app):
        app[SESSION] = ClientSession(timeout=ClientTimeout(total=20))
        yield
        await app[SESSION].close()
    app.cleanup_ctx.append(resources); app.router.add_get("/health", health); app.router.add_get("/asr", asr)
    return app

if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--host", default="127.0.0.1"); parser.add_argument("--port", type=int, default=8766)
    parser.add_argument("--origin", action="append", required=True, help="浏览器页面 Origin（不含路径），可重复")
    args = parser.parse_args()
    web.run_app(create_app(args.origin), host=args.host, port=args.port, access_log=None)
