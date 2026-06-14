from __future__ import annotations

import json
import re

from app.config import settings
from app.worker.llm_client import chat_completion

STYLE_ART_DIRECTION: dict[str, str] = {
    "business": (
        "Professional corporate deck: teal/emerald gradients, clean cards, numbered badges, "
        "confident hierarchy, suitable for board reporting."
    ),
    "editorial": (
        "Editorial magazine layout: strong typography, generous whitespace, photography frames, "
        "muted stone palette with orange accent, calm and premium."
    ),
    "minimal": (
        "Swiss minimal: light gray background, thin rules, restrained sans-serif, "
        "high whitespace, subtle accent line, no clutter."
    ),
    "dark": (
        "Data dashboard dark mode: navy background, cyan highlights, chart-friendly blocks, "
        "Bloomberg-inspired information density with clear contrast."
    ),
}


def _extract_json(text: str) -> dict:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


async def create_design_spec(*, markdown: str, prompt: str, style: str, deck_title: str) -> dict:
    system = (
        "你是 PPT Master 的视觉策划（Strategist）。根据材料输出 JSON 设计规范，不要其它文字。"
        '格式：{"palette":{"primary":"#","secondary":"#","background":"#","surface":"#","text":"#","muted":"#"},'
        '"typography":"Microsoft YaHei, PingFang SC, sans-serif","motif":"…","tone":"…","layout_notes":"…"}'
    )
    user = (
        f"Deck title: {deck_title}\n"
        f"Art direction: {STYLE_ART_DIRECTION.get(style, STYLE_ART_DIRECTION['business'])}\n"
        f"User brief: {prompt}\n\n"
        f"Source excerpt:\n{markdown[:8000]}"
    )
    content = await chat_completion(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.35,
        use_visual_endpoint=True,
    )
    spec = _extract_json(content)
    spec.setdefault("palette", {})
    spec.setdefault("typography", "Microsoft YaHei, PingFang SC, sans-serif")
    spec.setdefault("motif", STYLE_ART_DIRECTION.get(style, ""))
    return spec
