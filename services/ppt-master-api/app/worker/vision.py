from __future__ import annotations

from typing import Any, TypedDict

from app.config import settings

QIANFAN_VISION_URL = "https://qianfan.baidubce.com/v2/chat/completions"
DEFAULT_QIANFAN_VISION_MODEL = "qianfan-vl-1.5-flash"
DEEPSEEK_TEXT_ONLY_PREFIX = "deepseek-"

_QIANFAN_CHAT_PROBE: bool | None = None


class VisionEndpoint(TypedDict):
    url: str
    api_key: str
    model: str
    provider: str


def vision_enabled() -> bool:
    return bool(settings.ppt_master_vision_enabled)


def qianfan_vision_available() -> bool:
    return bool(settings.qianfan_api_key.strip())


def qianfan_chat_available() -> bool:
    """千帆 Key 可能仅开通文库 PPT 工具，未开通 /v2/chat/completions。"""
    global _QIANFAN_CHAT_PROBE
    if _QIANFAN_CHAT_PROBE is not None:
        return _QIANFAN_CHAT_PROBE
    if not qianfan_vision_available():
        _QIANFAN_CHAT_PROBE = False
        return False

    import httpx

    try:
        with httpx.Client(timeout=20) as client:
            response = client.post(
                QIANFAN_VISION_URL,
                headers={
                    "Authorization": f"Bearer {settings.qianfan_api_key.strip()}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": DEFAULT_QIANFAN_VISION_MODEL,
                    "messages": [{"role": "user", "content": "ok"}],
                    "max_tokens": 1,
                },
            )
        _QIANFAN_CHAT_PROBE = response.status_code == 200
    except Exception:
        _QIANFAN_CHAT_PROBE = False
    return _QIANFAN_CHAT_PROBE


def _vision_endpoint_url() -> str:
    explicit = settings.ppt_master_vision_api_url.strip()
    if explicit:
        return explicit
    return settings.ppt_master_llm_api_url.strip()


def _configured_vision_model() -> str:
    return settings.ppt_master_vision_model.strip() or "deepseek-v4-flash"


def _is_deepseek_endpoint(url: str) -> bool:
    return "deepseek.com" in url.lower()


def _is_deepseek_text_only_model(model: str) -> bool:
    normalized = model.strip().lower()
    return not normalized or normalized.startswith(DEEPSEEK_TEXT_ONLY_PREFIX)


def should_auto_route_qianfan_vision() -> bool:
    """DeepSeek 官方 API 仅支持文本；若已配置千帆 Key 且未指定独立视觉端点，则自动走千帆 VL。"""
    if settings.ppt_master_vision_api_url.strip():
        return False
    if not qianfan_vision_available():
        return False
    if not qianfan_chat_available():
        return False
    endpoint = _vision_endpoint_url()
    model = _configured_vision_model()
    return _is_deepseek_endpoint(endpoint) and _is_deepseek_text_only_model(model)


def using_qianfan_vision() -> bool:
    explicit = settings.ppt_master_vision_api_url.strip().lower()
    if explicit:
        return "qianfan.baidubce.com" in explicit
    return should_auto_route_qianfan_vision()


def vision_model() -> str:
    configured = _configured_vision_model()
    if should_auto_route_qianfan_vision() and _is_deepseek_text_only_model(configured):
        return DEFAULT_QIANFAN_VISION_MODEL
    return configured


def vision_api_url() -> str:
    from app.worker.llm_client import normalize_chat_completions_url

    explicit = settings.ppt_master_vision_api_url.strip()
    if explicit:
        return normalize_chat_completions_url(explicit)
    if should_auto_route_qianfan_vision():
        return normalize_chat_completions_url(QIANFAN_VISION_URL)
    return normalize_chat_completions_url(settings.ppt_master_llm_api_url.strip())


def vision_api_key() -> str:
    if settings.ppt_master_vision_api_key.strip():
        return settings.ppt_master_vision_api_key.strip()
    if using_qianfan_vision():
        return settings.qianfan_api_key.strip()
    return settings.ppt_master_llm_api_key


def vision_provider_label() -> str:
    if using_qianfan_vision():
        return "qianfan-vl"
    if settings.ppt_master_vision_api_url.strip():
        return "custom"
    return "llm-default"


def qianfan_vision_endpoint() -> VisionEndpoint:
    from app.worker.llm_client import normalize_chat_completions_url

    return {
        "url": normalize_chat_completions_url(QIANFAN_VISION_URL),
        "api_key": settings.qianfan_api_key.strip(),
        "model": DEFAULT_QIANFAN_VISION_MODEL,
        "provider": "qianfan-vl",
    }


def vision_endpoint_chain() -> list[VisionEndpoint]:
    primary: VisionEndpoint = {
        "url": vision_api_url(),
        "api_key": vision_api_key(),
        "model": vision_model(),
        "provider": vision_provider_label(),
    }
    chain = [primary]
    if (
        qianfan_vision_available()
        and qianfan_chat_available()
        and not using_qianfan_vision()
        and _is_deepseek_endpoint(primary["url"])
    ):
        chain.append(qianfan_vision_endpoint())
    return chain


def attach_image_urls(messages: list[dict[str, Any]], image_urls: list[str]) -> list[dict[str, Any]]:
    if not image_urls:
        return messages

    result: list[dict[str, Any]] = [dict(message) for message in messages]
    for index in range(len(result) - 1, -1, -1):
        if result[index].get("role") != "user":
            continue
        content = result[index].get("content", "")
        parts: list[dict[str, Any]] = []
        if isinstance(content, str) and content.strip():
            parts.append({"type": "text", "text": content})
        elif isinstance(content, list):
            parts.extend(content)
        for url in image_urls:
            parts.append({"type": "image_url", "image_url": {"url": url}})
        result[index]["content"] = parts
        return result

    result.append(
        {
            "role": "user",
            "content": [{"type": "image_url", "image_url": {"url": url}} for url in image_urls],
        }
    )
    return result
