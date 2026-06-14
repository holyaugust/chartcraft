from __future__ import annotations

from typing import Any

import httpx

from app.config import settings


def visual_api_url() -> str:
    return settings.ppt_master_visual_api_url.strip() or settings.ppt_master_llm_api_url


def visual_api_key() -> str:
    return settings.ppt_master_visual_api_key.strip() or settings.ppt_master_llm_api_key


def visual_model() -> str:
    return settings.ppt_master_visual_model.strip() or settings.ppt_master_llm_model


async def chat_completion(
    *,
    messages: list[dict[str, str]],
    model: str | None = None,
    temperature: float = 0.5,
    timeout: float | None = None,
    use_visual_endpoint: bool = False,
) -> str:
    api_key = visual_api_key() if use_visual_endpoint else settings.ppt_master_llm_api_key
    if not api_key.strip():
        raise RuntimeError("未配置 LLM API Key")

    url = visual_api_url() if use_visual_endpoint else settings.ppt_master_llm_api_url
    payload: dict[str, Any] = {
        "model": model or (visual_model() if use_visual_endpoint else settings.ppt_master_llm_model),
        "messages": messages,
        "temperature": temperature,
    }

    async with httpx.AsyncClient(timeout=timeout or settings.ppt_master_llm_timeout) as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        response.raise_for_status()
        data = response.json()

    content = data["choices"][0]["message"]["content"]
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("LLM 返回空内容")
    return content
