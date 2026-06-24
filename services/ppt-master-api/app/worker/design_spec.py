from __future__ import annotations

import json
import re

from app.style_presets import (
    STYLE_ART_DIRECTION,
    apply_primary_to_spec,
    build_style_context,
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
    '{"palette":{"primary":"#","secondary":"#","background":"#","surface":"#","text":"#","muted":"#"},'
    '"typography":"Microsoft YaHei, PingFang SC, sans-serif","motif":"…","tone":"…","layout_notes":"…"}'
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
    art_direction = build_style_context(
        style=style,
        style_note=style_note,
        primary_color=primary_color,
    )
    reference_url = reference_image_url.strip()
    use_vision = vision_enabled() and bool(reference_url)

    if use_vision:
        system = (
            "你是 PPT Master 的视觉策划（Strategist）。用户会提供一张 PPT 封面/模板参考图。"
            "请分析其配色、版式气质、装饰元素与排版风格，并结合文字 brief 输出 JSON 设计规范，不要其它文字。"
            f"格式：{_DESIGN_SPEC_SCHEMA}"
        )
        user = (
            f"Deck title: {deck_title}\n"
            f"Art direction preset ({style}): {art_direction}\n"
            f"User brief: {prompt}\n\n"
            "请优先从参考图中提取可复用的视觉语言（主色、辅色、背景、装饰 motif、标题区布局），"
            "再与上述 preset 融合。\n\n"
            f"Source excerpt:\n{markdown[:6000]}"
        )
        content = await chat_completion(
            messages=[
                {"role": "system", "content": system},
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
        system = (
            "你是 PPT Master 的视觉策划（Strategist）。根据材料输出 JSON 设计规范，不要其它文字。"
            f"格式：{_DESIGN_SPEC_SCHEMA}"
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
            use_executor_endpoint=True,
        )
        spec = _extract_json(content)
        spec["strategist_model"] = vision_model()

    spec.setdefault("palette", {})
    spec.setdefault("typography", "Microsoft YaHei, PingFang SC, sans-serif")
    spec.setdefault("motif", STYLE_ART_DIRECTION.get(style, ""))
    if style_note.strip():
        spec["custom_style_note"] = style_note.strip()
    return apply_primary_to_spec(spec, primary_color)
