from __future__ import annotations

import json
import re

from app.config import settings
from app.style_presets import (
    STYLE_ART_DIRECTION,
    apply_primary_to_spec,
    build_style_context,
)
from app.worker.llm_client import chat_completion


def _extract_json(text: str) -> dict:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


async def create_design_spec(
    *,
    markdown: str,
    prompt: str,
    style: str,
    deck_title: str,
    style_note: str = "",
    primary_color: str = "",
) -> dict:
    art_direction = build_style_context(
        style=style,
        style_note=style_note,
        primary_color=primary_color,
    )
    system = (
        "你是 PPT Master 的视觉策划（Strategist）。根据材料输出 JSON 设计规范，不要其它文字。"
        '格式：{"palette":{"primary":"#","secondary":"#","background":"#","surface":"#","text":"#","muted":"#"},'
        '"typography":"Microsoft YaHei, PingFang SC, sans-serif","motif":"…","tone":"…","layout_notes":"…"}'
    )
    user = (
        f"Deck title: {deck_title}\n"
        f"Art direction: {art_direction}\n"
        f"User brief: {prompt}\n\n"
        f"Source excerpt:\n{markdown[:8000]}"
    )
    content = await chat_completion(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.35,
    )
    spec = _extract_json(content)
    spec.setdefault("palette", {})
    spec.setdefault("typography", "Microsoft YaHei, PingFang SC, sans-serif")
    spec.setdefault("motif", STYLE_ART_DIRECTION.get(style, ""))
    if style_note.strip():
        spec["custom_style_note"] = style_note.strip()
    return apply_primary_to_spec(spec, primary_color)
