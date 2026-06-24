from __future__ import annotations

from typing import Any

from app.config import settings


def vision_enabled() -> bool:
    return bool(settings.ppt_master_vision_enabled)


def vision_model() -> str:
    configured = settings.ppt_master_vision_model.strip()
    return configured or "deepseek-v4-flash"


def vision_api_url() -> str:
    from app.worker.llm_client import normalize_chat_completions_url

    configured = settings.ppt_master_vision_api_url.strip()
    if configured:
        return normalize_chat_completions_url(configured)
    return normalize_chat_completions_url(settings.ppt_master_llm_api_url.strip())


def vision_api_key() -> str:
    if settings.ppt_master_vision_api_key.strip():
        return settings.ppt_master_vision_api_key.strip()
    return settings.ppt_master_llm_api_key


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
