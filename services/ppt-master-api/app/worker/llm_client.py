from __future__ import annotations

import asyncio
import ssl
from typing import Any

import httpx

from app.config import settings
from app.worker.vision import attach_image_urls, vision_api_key, vision_api_url, vision_model

ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages"
DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-20250514"
MAX_LLM_RETRIES = 6


def _is_rate_limit_error(exc: BaseException) -> bool:
    message = str(exc).lower()
    return (
        "429" in str(exc)
        or "负载已饱和" in str(exc)
        or "rate limit" in message
        or "too many requests" in message
    )


def _is_anthropic_url(url: str) -> bool:
    return "anthropic.com" in url.lower()


def normalize_chat_completions_url(url: str) -> str:
    """Ensure OpenAI-compatible gateways use /v1/chat/completions."""
    raw = url.strip().rstrip("/")
    if not raw:
        return "https://openrouter.ai/api/v1/chat/completions"
    if _is_anthropic_url(raw):
        if raw.endswith("/v1/messages") or raw.endswith("/messages"):
            return raw
        return ANTHROPIC_MESSAGES_URL
    if raw.endswith("/v1/chat/completions") or raw.endswith("/chat/completions"):
        return raw
    return f"{raw}/v1/chat/completions"


def executor_api_url() -> str:
    configured = settings.ppt_master_executor_api_url.strip()
    if configured:
        return normalize_chat_completions_url(configured)
    configured = settings.ppt_master_visual_api_url.strip()
    if configured:
        return normalize_chat_completions_url(configured)
    return normalize_chat_completions_url(settings.ppt_master_llm_api_url.strip())


def executor_api_key() -> str:
    if settings.ppt_master_executor_api_key.strip():
        return settings.ppt_master_executor_api_key.strip()
    if settings.ppt_master_visual_api_key.strip():
        return settings.ppt_master_visual_api_key.strip()
    if settings.ppt_master_executor_api_url.strip() or settings.ppt_master_visual_api_url.strip():
        return ""
    return settings.ppt_master_llm_api_key


def executor_model() -> str:
    """Executor 逐页 SVG 统一使用视觉模型（默认 deepseek-v4-flash）。"""
    return vision_model()


def visual_api_url() -> str:
    return executor_api_url()


def visual_api_key() -> str:
    return executor_api_key()


def visual_model() -> str:
    return executor_model()


def _resolve_url(url: str, *, use_visual: bool) -> str:
    return normalize_chat_completions_url(url)


def _httpx_client(timeout: float) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=httpx.Timeout(timeout, connect=min(60.0, timeout)),
        http2=False,
        follow_redirects=True,
    )


def _is_retryable_error(exc: BaseException) -> bool:
    if isinstance(exc, (httpx.TransportError, httpx.TimeoutException, ssl.SSLError)):
        return True
    message = str(exc).lower()
    return any(
        token in message
        for token in (
            "ssl",
            "decryption failed",
            "bad record mac",
            "connection reset",
            "connection aborted",
            "timed out",
            "temporarily unavailable",
        )
    )


async def _retry_async(label: str, action):
    last_exc: BaseException | None = None
    for attempt in range(1, MAX_LLM_RETRIES + 1):
        try:
            return await action()
        except RuntimeError as exc:
            if (
                _is_retryable_error(exc)
                or _is_rate_limit_error(exc)
                or "503" in str(exc)
                or "502" in str(exc)
            ):
                last_exc = exc
            else:
                raise
        except (httpx.TransportError, httpx.TimeoutException, ssl.SSLError) as exc:
            last_exc = exc
        if attempt >= MAX_LLM_RETRIES:
            break
        if last_exc is not None and _is_rate_limit_error(last_exc):
            wait_s = min(20 * attempt, 90)
        else:
            wait_s = min(2 ** attempt, 16)
        await asyncio.sleep(wait_s)
    if last_exc is not None:
        hint = "（网关限流，请稍后再试或更换 API 分组）" if _is_rate_limit_error(last_exc) else ""
        raise RuntimeError(f"{label} 失败（已重试 {MAX_LLM_RETRIES} 次）{hint}：{last_exc}") from last_exc
    raise RuntimeError(f"{label} 失败")


async def _openai_chat_completion(
    *,
    url: str,
    api_key: str,
    payload: dict[str, Any],
    timeout: float,
) -> str:
    headers: dict[str, str] = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    if "openrouter.ai" in url.lower():
        headers["HTTP-Referer"] = "https://github.com/holyaugust/chartcraft"
        headers["X-Title"] = "ChartCraft PPT Master"

    async def _call() -> str:
        async with _httpx_client(timeout) as client:
            response = await client.post(
                url,
                headers=headers,
                json=payload,
            )
            body = response.text.strip()
            if response.status_code >= 500:
                raise RuntimeError(f"LLM API 错误（{response.status_code}）：{body[:500]}")
            if response.status_code >= 400:
                raise RuntimeError(f"LLM API 错误（{response.status_code}）：{body[:500]}")
            try:
                data = response.json()
            except ValueError as exc:
                preview = body[:200].replace("\n", " ")
                raise RuntimeError(
                    f"LLM 返回非 JSON（可能 API 地址错误）：{preview}"
                ) from exc

        if "error" in data:
            err = data["error"]
            message = err.get("message") if isinstance(err, dict) else str(err)
            raise RuntimeError(f"LLM API 错误：{message}")

        content = data["choices"][0]["message"]["content"]
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("LLM 返回空内容")
        return content

    return await _retry_async("LLM 请求", _call)


async def _anthropic_chat_completion(
    *,
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
    temperature: float,
    timeout: float,
) -> str:
    system_parts = [m["content"] for m in messages if m["role"] == "system"]
    chat_messages = [
        {"role": m["role"], "content": m["content"]}
        for m in messages
        if m["role"] in {"user", "assistant"}
    ]
    if not chat_messages:
        raise RuntimeError("Anthropic 请求缺少 user/assistant 消息")

    body: dict[str, Any] = {
        "model": model,
        "max_tokens": 16384,
        "messages": chat_messages,
        "temperature": temperature,
    }
    if system_parts:
        body["system"] = "\n\n".join(system_parts)

    async def _call() -> str:
        async with _httpx_client(timeout) as client:
            response = await client.post(
                ANTHROPIC_MESSAGES_URL,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            if response.status_code >= 400:
                detail = response.text.strip()
                raise RuntimeError(f"Anthropic API 错误（{response.status_code}）：{detail[:500]}")
            data = response.json()

        blocks = data.get("content") or []
        text_parts = [block.get("text", "") for block in blocks if block.get("type") == "text"]
        content = "".join(text_parts).strip()
        if not content:
            raise RuntimeError("Anthropic 返回空内容")
        return content

    return await _retry_async("Anthropic 请求", _call)


def _is_vision_unsupported_error(exc: BaseException) -> bool:
    message = str(exc).lower()
    return any(
        token in message
        for token in (
            "image_url",
            "unknown variant",
            "multimodal",
            "vision",
            "does not support",
        )
    )


async def chat_completion(
    *,
    messages: list[dict[str, Any]],
    model: str | None = None,
    temperature: float = 0.5,
    timeout: float | None = None,
    use_visual_endpoint: bool = False,
    use_executor_endpoint: bool = False,
    use_vision_model: bool = False,
    image_urls: list[str] | None = None,
    require_vision_images: bool = False,
    api_url_override: str | None = None,
    api_key_override: str | None = None,
) -> str:
    resolved_images = [url.strip() for url in (image_urls or []) if url.strip()]
    use_vision = use_vision_model or bool(resolved_images)

    if use_vision:
        api_key = (api_key_override or vision_api_key()).strip()
        if not api_key:
            raise RuntimeError("未配置视觉模型 API Key")
        url = api_url_override or vision_api_url()
        resolved_model = model or vision_model()
        payload_messages = attach_image_urls(messages, resolved_images)
    else:
        use_executor = use_visual_endpoint or use_executor_endpoint
        api_key = executor_api_key() if use_executor else settings.ppt_master_llm_api_key
        if not api_key.strip():
            raise RuntimeError("未配置 LLM API Key")
        raw_url = executor_api_url() if use_executor else settings.ppt_master_llm_api_url
        url = _resolve_url(raw_url, use_visual=use_executor)
        resolved_model = model or (executor_model() if use_executor else settings.ppt_master_llm_model)
        payload_messages = messages

    resolved_timeout = timeout or settings.ppt_master_llm_timeout

    if _is_anthropic_url(url):
        if resolved_images:
            raise RuntimeError("Anthropic 端点暂不支持参考图视觉分析")
        text_messages = [
            {"role": str(m["role"]), "content": str(m["content"])}
            for m in payload_messages
            if isinstance(m.get("content"), str)
        ]
        return await _anthropic_chat_completion(
            api_key=api_key,
            model=resolved_model,
            messages=text_messages,
            temperature=temperature,
            timeout=resolved_timeout,
        )

    payload: dict[str, Any] = {
        "model": resolved_model,
        "messages": payload_messages,
        "temperature": temperature,
    }
    try:
        return await _openai_chat_completion(
            url=url,
            api_key=api_key,
            payload=payload,
            timeout=resolved_timeout,
        )
    except RuntimeError as exc:
        if resolved_images and _is_vision_unsupported_error(exc):
            if require_vision_images:
                raise RuntimeError(
                    "视觉模型无法读取参照截图，截图还原已中止。"
                    "请确认 PPT_MASTER_VISION_MODEL 支持 image_url 多模态。"
                ) from exc
            text_messages = [
                {"role": str(m["role"]), "content": str(m["content"])}
                for m in messages
                if isinstance(m.get("content"), str)
            ]
            return await chat_completion(
                messages=text_messages,
                model=model,
                temperature=temperature,
                timeout=timeout,
                use_visual_endpoint=use_visual_endpoint,
                use_executor_endpoint=use_executor_endpoint,
                use_vision_model=False,
                image_urls=None,
                require_vision_images=False,
            )
        raise
