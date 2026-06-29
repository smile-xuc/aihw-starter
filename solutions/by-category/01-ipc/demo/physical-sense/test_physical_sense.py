"""
物理世界感知智能体 · IPC 摄像头画面洞察 Demo
================================================

基于阿里云百炼「多模态交互开发套件」 + 「物理世界感知 Agent · IPC 场景」，
对摄像头事件帧 / 图片进行结构化描述（object / action / event / description / title）。

> ⚠️ 本脚本由 AI 生成（aihw-starter 项目示例代码）。
> 在百炼控制台创建多模态交互套件应用，并完成 `02-solution.md` 中的 7 步可视化配置后，
> 填入下方的 API_KEY / APP_ID / WORKSPACE_ID 三项即可运行。

依赖：
    pip install requests python-dotenv

运行：
    # 1. 在脚本目录或上级目录放置 .env 文件，写入：
    #    DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxx
    # 2. 填好下方的 APP_ID / WORKSPACE_ID
    # 3. 执行：
    python test_physical_sense.py                       # 用默认在线测试图片
    python test_physical_sense.py /path/to/local.jpg    # 传入本地图片
"""

import os
import sys
import json
import requests
from dotenv import load_dotenv

# 加载环境变量（override=True 确保 .env 文件优先）
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'), override=True)

# ============================================================
# 配置区 —— 运行前请填好以下三项
# ============================================================
API_KEY = os.getenv("DASHSCOPE_API_KEY")  # 建议放到 .env，sk- 前缀
APP_ID = ""        # 百炼控制台「我的应用」中复制，形如 mm_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
WORKSPACE_ID = ""  # 百炼控制台「业务空间」中复制，形如 llm-xxxxxxxxxxxxxxxx
USER_ID = "test_user_001"
DEVICE_UUID = "test_device_001"

# API 端点
API_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"

# IPC 场景默认 prompt
DEFAULT_PROMPT = """#角色
你是一个敏锐的摄像头画面观察者，专注于分析监控画面中的环境、人物、行为和事件。

#任务
请仔细观察画面内容，识别并描述：
1. 画面中的人物或物体
2. 正在发生的行为或动作
3. 可能的事件或异常情况
4. 环境描述

#输出要求
请以结构化的方式输出分析结果，包含以下字段：
- object: 识别到的对象列表
- action: 识别到的行为列表
- event: 识别到的事件列表
- description: 画面整体描述
- title: 简短标题"""


def call_physical_sense(image_url: str, prompt: str = None) -> dict:
    """
    调用物理世界感知接口

    Args:
        image_url: 图片URL（必须是https开头）或本地文件路径
        prompt: 自定义prompt，为None时使用默认prompt

    Returns:
        解析后的响应结果
    """
    if not API_KEY:
        print("错误: 未找到 DASHSCOPE_API_KEY，请检查 .env 文件")
        sys.exit(1)
    if not APP_ID or not WORKSPACE_ID:
        print("错误: 请先在脚本中填写 APP_ID 和 WORKSPACE_ID（从百炼控制台获取）")
        sys.exit(1)

    if prompt is None:
        prompt = DEFAULT_PROMPT

    # 构建图片参数
    images = []
    if image_url.startswith("http"):
        images.append({"type": "url", "value": image_url})
    else:
        # 如果是本地文件路径，读取为base64
        import base64
        with open(image_url, "rb") as f:
            img_base64 = base64.b64encode(f.read()).decode("utf-8")
        images.append({"type": "base64", "value": img_base64})

    # 构建请求体
    payload = {
        "model": "multimodal-dialog",
        "input": {
            "directive": "Request",
            "app_id": APP_ID,
            "text": ""
        },
        "parameters": {
            "client_info": {
                "user_id": USER_ID,
                "device": {
                    "uuid": DEVICE_UUID
                }
            },
            "biz_params": {
                "commands": [{
                    "name": "agent_command",
                    "exec_params": {
                        "app_id": "physical_sense",
                        "intent": "open_physical_sense",
                        "slots": [{
                            "name": "scene",
                            "norm_value": "ipc"
                        }]
                    }
                }],
                "user_defined_params": {
                    "physical_sense": {
                        "user_prompt_params": {
                            "param": {
                                "format": "image",
                                "prompt": prompt,
                                "images": images
                            }
                        }
                    }
                }
            }
        }
    }

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "X-DashScope-SSE": "enable",
        "Accept": "*/*"
    }

    # 如果有 workspace id，加上对应 header
    if WORKSPACE_ID:
        headers["X-DashScope-WorkSpace"] = WORKSPACE_ID

    print(f"\n{'='*60}")
    print(f"正在调用物理世界感知接口...")
    print(f"图片: {image_url[:80]}{'...' if len(image_url) > 80 else ''}")
    print(f"{'='*60}\n")

    try:
        response = requests.post(
            API_URL,
            headers=headers,
            json=payload,
            stream=True,
            timeout=60
        )

        if response.status_code != 200:
            print(f"请求失败，状态码: {response.status_code}")
            print(f"响应: {response.text}")
            return None

        # 解析 SSE 响应
        # 格式: id:N / event:xxx / :HTTP_STATUS/xxx / data:{json}
        final_result = None
        all_data_events = []

        for line in response.iter_lines(decode_unicode=True):
            if not line:
                continue
            if line.startswith("data:"):
                data_str = line[5:].strip()
                if not data_str:
                    continue
                try:
                    data = json.loads(data_str)
                    all_data_events.append(data)
                    output = data.get("output", {})
                    if output.get("finished"):
                        final_result = data
                        break
                    # 检查是否是错误响应
                    if "code" in data and "message" in data:
                        print(f"\n[错误] code={data['code']}, message={data['message']}")
                        print(f"  request_id={data.get('request_id', 'N/A')}")
                except json.JSONDecodeError:
                    continue

        if not final_result and all_data_events:
            print("[DEBUG] 未找到 finished=true 的响应包")
            print(f"[DEBUG] 共收到 {len(all_data_events)} 个 data 事件:")
            for i, evt in enumerate(all_data_events):
                print(f"  事件{i+1}: {json.dumps(evt, ensure_ascii=False)[:500]}")

        return final_result

    except requests.exceptions.Timeout:
        print("请求超时（60秒）")
        return None
    except requests.exceptions.RequestException as e:
        print(f"请求异常: {e}")
        return None


def parse_result(result: dict) -> dict:
    """解析返回结果"""
    if not result:
        return None

    output = result.get("output", {})
    request_id = result.get("request_id", "N/A")
    text = output.get("text", "")

    print(f"Request ID: {request_id}")
    print(f"Dialog ID: {output.get('dialog_id', 'N/A')}")
    print(f"Finish Reason: {output.get('finish_reason', 'N/A')}")
    print(f"\n--- 原始返回文本 ---")
    print(text)

    # 尝试解析 text 字段为 JSON
    try:
        parsed = json.loads(text)
        print(f"\n--- 结构化解析结果 ---")
        print(f"标题: {parsed.get('title', 'N/A')}")
        print(f"对象: {parsed.get('object', [])}")
        print(f"行为: {parsed.get('action', [])}")
        print(f"事件: {parsed.get('event', [])}")
        print(f"描述: {parsed.get('description', 'N/A')}")
        return parsed
    except (json.JSONDecodeError, TypeError):
        # 尝试提取 markdown 列表格式的结果
        print("\n--- 解析结果（非JSON格式） ---")
        print(text)
        return {"raw_text": text}


def main():
    """主函数 - 使用示例图片进行测试"""
    print("=" * 60)
    print("  物理世界感知智能体 - 摄像头画面洞察 Demo")
    print("=" * 60)
    print(f"\nApp ID: {APP_ID or '(未填写)'}")
    print(f"Workspace ID: {WORKSPACE_ID or '(未填写)'}")
    print(f"API Key: {API_KEY[:10]}...{API_KEY[-4:]}" if API_KEY else "未设置")

    # 测试图片 - 使用公开可访问的示例图片
    test_images = [
        {
            "name": "室内办公场景",
            "url": "https://dashscope.oss-cn-beijing.aliyuncs.com/images/dog_and_girl.jpeg"
        }
    ]

    # 如果命令行传入了本地图片路径
    if len(sys.argv) > 1:
        local_path = sys.argv[1]
        if os.path.exists(local_path):
            test_images = [{"name": "本地图片", "url": local_path}]
            print(f"\n使用本地图片: {local_path}")
        else:
            print(f"\n警告: 文件不存在 {local_path}，使用默认测试图片")

    for i, img in enumerate(test_images, 1):
        print(f"\n{'#'*60}")
        print(f"# 测试 {i}: {img['name']}")
        print(f"{'#'*60}")

        result = call_physical_sense(img["url"])
        parsed = parse_result(result)

        if parsed:
            print("\n✅ 测试完成")
        else:
            print("\n❌ 测试失败，未获取到有效结果")

    print(f"\n{'='*60}")
    print("所有测试完成")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
