"""公用工具：加载 .env、脱敏 key、计时装饰器。"""
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


def get_api_key() -> str:
    load_env()
    key = os.environ.get("DASHSCOPE_API_KEY", "")
    if not key:
        raise RuntimeError("DASHSCOPE_API_KEY 未设置，请参考 benchmark/.env.example 配置")
    return key


def mask_key(key: str) -> str:
    """脱敏 API Key 用于日志输出。"""
    if not key or len(key) < 8:
        return "***"
    return f"{key[:4]}...{key[-4:]}"


def now_ms() -> float:
    return time.perf_counter() * 1000


SAMPLES = [
    {"id": "q1_light", "text": "今天天气怎么样", "level": "轻度"},
    {"id": "q2_medium", "text": "帮我讲一个关于恐龙的小故事", "level": "中度"},
    {"id": "q3_complex", "text": "如果我在河边发现了一只受伤的小鸟应该怎么办我需要考虑哪些方面", "level": "复杂"},
]
