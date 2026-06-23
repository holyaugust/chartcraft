from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

import httpx

from app.config import settings

QIANFAN_BASE = "https://qianfan.baidubce.com"
OUTLINE_PATH = "/v2/tools/ai_ppt/generate_outline"
GENERATE_PATH = "/v2/tools/ai_ppt/generate_ppt_by_outline"
THEME_PATH = "/v2/tools/ai_ppt/get_ppt_theme"


class QianfanPptError(RuntimeError):
    pass


def _api_key() -> str:
    key = settings.qianfan_api_key.strip()
    if not key:
        raise QianfanPptError("未配置 QIANFAN_API_KEY")
    return key


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_api_key()}",
        "Content-Type": "application/json",
    }


def _base_url() -> str:
    raw = settings.qianfan_api_base.strip().rstrip("/")
    return raw or QIANFAN_BASE


def _parse_sse_payload(line: str) -> dict[str, Any] | None:
    stripped = line.strip()
    if not stripped.startswith("data:"):
        return None
    raw = stripped[5:].strip()
    if not raw or raw == "[DONE]":
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _iter_sse_events(response: httpx.Response) -> Iterator[dict[str, Any]]:
    for line in response.iter_lines():
        if isinstance(line, bytes):
            line = line.decode("utf-8", errors="ignore")
        payload = _parse_sse_payload(line)
        if payload is not None:
            yield payload


def _unwrap_data(payload: dict[str, Any]) -> dict[str, Any]:
    nested = payload.get("data")
    if isinstance(nested, dict):
        return {**payload, **nested}
    return payload


def _extract_pptx_url(payload: dict[str, Any]) -> str | None:
    flat = _unwrap_data(payload)
    url = flat.get("pptx_url") or flat.get("ppt_url")
    if isinstance(url, str) and url.strip():
        return url.strip()
    return None


def get_ppt_themes(*, timeout: float = 60.0) -> list[dict[str, Any]]:
    url = f"{_base_url()}{THEME_PATH}"
    with httpx.Client(timeout=timeout) as client:
        response = client.post(url, headers=_headers(), json={})
        if response.status_code >= 400:
            raise QianfanPptError(f"获取模板失败（{response.status_code}）：{response.text[:500]}")
        data = response.json()
    if not isinstance(data, dict):
        raise QianfanPptError("模板接口返回格式异常")
    errno = data.get("errno", 0)
    if errno not in (0, None):
        raise QianfanPptError(str(data.get("error") or data.get("show_msg") or f"errno={errno}"))
    inner = data.get("data") if isinstance(data.get("data"), dict) else data
    themes = inner.get("ppt_themes") if isinstance(inner, dict) else None
    if not isinstance(themes, list):
        return []
    return [item for item in themes if isinstance(item, dict)]


def stream_generate_outline(body: dict[str, Any], *, timeout: float = 600.0) -> dict[str, Any]:
    url = f"{_base_url()}{OUTLINE_PATH}"
    outline_parts: list[str] = []
    result: dict[str, Any] = {
        "chat_id": None,
        "query_id": None,
        "title": "",
        "outline": "",
        "query": body.get("query", ""),
    }

    with httpx.Client(timeout=timeout) as client:
        with client.stream("POST", url, headers=_headers(), json=body) as response:
            if response.status_code >= 400:
                detail = response.read().decode("utf-8", errors="ignore")
                raise QianfanPptError(f"大纲生成失败（{response.status_code}）：{detail[:500]}")
            content_type = (response.headers.get("content-type") or "").lower()
            if "text/event-stream" in content_type or "stream" in content_type:
                for event in _iter_sse_events(response):
                    _merge_outline_event(result, outline_parts, event)
                    if _outline_finished(event):
                        break
            else:
                payload = response.json()
                if isinstance(payload, dict):
                    _merge_outline_event(result, outline_parts, payload)
                    if payload.get("is_end") or _outline_finished(payload):
                        pass

    if outline_parts:
        result["outline"] = "".join(outline_parts)
    if not result.get("chat_id") or not result.get("query_id"):
        raise QianfanPptError("大纲生成未返回 chat_id / query_id")
    if not str(result.get("outline", "")).strip():
        raise QianfanPptError("大纲生成为空")
    return result


def _merge_outline_event(
    result: dict[str, Any],
    outline_parts: list[str],
    event: dict[str, Any],
) -> None:
    errno = event.get("errno", 0)
    if errno not in (0, None):
        raise QianfanPptError(str(event.get("error") or event.get("show_msg") or f"errno={errno}"))

    if event.get("chat_id") not in (None, ""):
        result["chat_id"] = event["chat_id"]
    if event.get("query_id") not in (None, ""):
        result["query_id"] = event["query_id"]
    if event.get("title"):
        result["title"] = str(event["title"]).strip()
    if event.get("query"):
        result["query"] = str(event["query"]).strip()

    fragment = event.get("outline")
    if isinstance(fragment, str) and fragment:
        outline_parts.append(fragment)


def _outline_finished(event: dict[str, Any]) -> bool:
    if event.get("is_end") is True:
        return True
    status = str(event.get("status") or "")
    return "大纲生成结束" in status


def stream_generate_ppt(body: dict[str, Any], *, timeout: float = 900.0) -> dict[str, Any]:
    url = f"{_base_url()}{GENERATE_PATH}"
    last_status = ""
    page_count = 0
    pptx_url: str | None = None

    with httpx.Client(timeout=timeout) as client:
        with client.stream("POST", url, headers=_headers(), json=body) as response:
            if response.status_code >= 400:
                detail = response.read().decode("utf-8", errors="ignore")
                raise QianfanPptError(f"PPT 生成失败（{response.status_code}）：{detail[:500]}")
            content_type = (response.headers.get("content-type") or "").lower()
            if "text/event-stream" in content_type or "stream" in content_type:
                for event in _iter_sse_events(response):
                    errno = event.get("errno", 0)
                    if errno not in (0, None):
                        raise QianfanPptError(str(event.get("error") or f"errno={errno}"))
                    flat = _unwrap_data(event)
                    if flat.get("page_count"):
                        page_count = int(flat["page_count"])
                    if flat.get("status"):
                        last_status = str(flat["status"])
                    found = _extract_pptx_url(event)
                    if found:
                        pptx_url = found
                    if event.get("is_end") and pptx_url:
                        break
            else:
                payload = response.json()
                if isinstance(payload, dict):
                    flat = _unwrap_data(payload)
                    pptx_url = _extract_pptx_url(payload)
                    if flat.get("page_count"):
                        page_count = int(flat["page_count"])
                    last_status = str(flat.get("status") or "")

    if not pptx_url:
        hint = last_status or "未返回 pptx_url"
        raise QianfanPptError(f"PPT 导出未完成：{hint}")
    return {"pptx_url": pptx_url, "page_count": page_count, "status": last_status}


def download_pptx(url: str, dest: str, *, timeout: float = 300.0) -> None:
    with httpx.Client(timeout=timeout, follow_redirects=True) as client:
        response = client.get(url)
        if response.status_code >= 400:
            raise QianfanPptError(f"下载 PPT 失败（{response.status_code}）")
        content = response.content
        if len(content) < 512:
            raise QianfanPptError("下载的文件过小，可能已失效")
        with open(dest, "wb") as handle:
            handle.write(content)
