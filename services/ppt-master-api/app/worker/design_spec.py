from __future__ import annotations

import json
import re

from app.style_presets import (
    STYLE_ART_DIRECTION,
    build_style_context,
    format_locked_palette_prompt,
    lock_design_spec_palette,
)
from app.worker.llm_client import chat_completion
from app.worker.vision import vision_enabled, vision_model


def _extract_json(text: str) -> dict:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


_DESIGN_SPEC_SCHEMA = (
    '{"typography":"Microsoft YaHei, PingFang SC, sans-serif","motif":"…","tone":"…","layout_notes":"…"}'
)

_STRATEGIST_SYSTEM = (
    "你是 PPT Master 的视觉策划（Strategist）。"
    "配色已由用户选择的风格预设锁定，你只需输出版式气质相关的 JSON，不要输出 palette 字段，不要其它文字。"
    f"格式：{_DESIGN_SPEC_SCHEMA}"
)


async def create_design_spec(
    *,
    markdown: str,
    prompt: str,
    style: str,
    deck_title: str,
    style_note: str = "",
    primary_color: str = "",
    reference_image_url: str = "",
) -> dict:
    locked_palette_hint = format_locked_palette_prompt(style, primary_color)
    art_direction = build_style_context(
        style=style,
        style_note=style_note,
        primary_color=primary_color,
    )
    reference_url = reference_image_url.strip()
    use_vision = vision_enabled() and bool(reference_url)

    if use_vision:
        user = (
            f"Deck title: {deck_title}\n"
            f"Art direction preset ({style}): {art_direction}\n"
            f"{locked_palette_hint}\n"
            f"User brief: {prompt}\n\n"
            "参考图仅用于提取版式、装饰 motif、标题区布局；配色必须严格使用上方 LOCKED PALETTE，"
            "不要从参考图中取色覆盖预设。\n\n"
            f"Source excerpt:\n{markdown[:6000]}"
        )
        content = await chat_completion(
            messages=[
                {"role": "system", "content": _STRATEGIST_SYSTEM},
                {"role": "user", "content": user},
            ],
            temperature=0.35,
            use_vision_model=True,
            image_urls=[reference_url],
        )
        spec = _extract_json(content)
        spec["vision_reference"] = reference_url
        spec["vision_model"] = vision_model()
    else:
        user = (
            f"Deck title: {deck_title}\n"
            f"Art direction: {art_direction}\n"
            f"{locked_palette_hint}\n"
            f"User brief: {prompt}\n\n"
            f"Source excerpt:\n{markdown[:8000]}"
        )
        content = await chat_completion(
            messages=[
                {"role": "system", "content": _STRATEGIST_SYSTEM},
                {"role": "user", "content": user},
            ],
            temperature=0.35,
            use_executor_endpoint=True,
        )
        spec = _extract_json(content)
        spec["strategist_model"] = vision_model()

    spec.setdefault("typography", "Microsoft YaHei, PingFang SC, sans-serif")
    spec.setdefault("motif", STYLE_ART_DIRECTION.get(style, ""))
    spec.setdefault("tone", STYLE_ART_DIRECTION.get(style, ""))
    spec.setdefault("layout_notes", "")
    if style_note.strip():
        spec["custom_style_note"] = style_note.strip()
    return lock_design_spec_palette(spec, style, primary_color)
