"""公用工具：加载 .env、时间戳、测试样本。

设计原则：脚本本身不持有 key 变量，只保证环境变量已就位，交给 SDK 从环境读取。
"""
import os
import time
from pathlib import Path


def load_env():
    """读取 benchmark/.env，注入到 os.environ。不覆盖已有变量。"""
    env_path = Path(__file__).parent.parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def ensure_env():
    """确保 DASHSCOPE_API_KEY 已就位（只做校验，不返回值）。

    同时把值同步到 OPENAI_API_KEY，让走 OpenAI 兼容协议的 client 可以直接免参初始化。
    """
    load_env()
    key = os.environ.get("DASHSCOPE_API_KEY")
    if not key:
        raise RuntimeError("DASHSCOPE_API_KEY 未设置，请参考 benchmark/.env.example 配置")
    # OpenAI 兼容协议下，SDK 默认读 OPENAI_API_KEY
    os.environ.setdefault("OPENAI_API_KEY", key)


def now_ms() -> float:
    return time.perf_counter() * 1000


SAMPLES = [
    {"id": "q1_light", "text": "今天天气怎么样", "level": "轻度"},
    {"id": "q3_complex", "text": "如果我在河边发现了一只受伤的小鸟应该怎么办我需要考虑哪些方面", "level": "复杂"},
    {"id": "q4_search", "text": "杭州今天天气怎么样，气温多少度", "level": "搜索"},
]
