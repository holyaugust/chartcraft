from __future__ import annotations

import asyncio
import json
import re
from collections.abc import Callable

from app.style_presets import build_style_context, format_locked_palette_prompt
from app.worker.llm_client import chat_completion, executor_model
from app.worker.svg_builder import SlidePlan, build_slide_svg
from app.worker.svg_sanitize import sanitize_svg

SVG_SYSTEM_PROMPT = """你是 PPT Master Executor，为单页 16:9 幻灯片生成完整 SVG。

硬性要求：
1. 只输出一个完整 SVG 文档，不要 markdown 说明
2. 根元素：width="1280" height="720" viewBox="0 0 1280 720"
3. 使用绝对坐标布局（canvas 思维），所有文字可读、不重叠
4. 中文正文用 font-family="Microsoft YaHei, PingFang SC, sans-serif"
5. XML 合法：& 写 &amp;；禁止 HTML 实体如 &nbsp; &mdash;；所有标签必须闭合，必须以 </svg> 结束
6. 禁止：mask, filter, drop-shadow, <style>, class, foreignObject, symbol/use, textPath, script, animate, <span>
7. 文字富文本样式只能用 <tspan>，且 <tspan> 必须放在 <text> 内部，禁止独立顶层 <tspan>
8. 若用户提供 LOCKED PALETTE，背景必须用指定 linearGradient 起止色，禁止改用其它灰/金/蓝替代

视觉要求：
- 严格使用 LOCKED PALETTE 中的 hex 色值
- 渐变背景、卡片、徽章、装饰几何，接近专业 Keynote 水准
- 页码放右下（非封面）
- 内容页用卡片承载要点，每点有编号或图标
"""


async def generate_slide_svg(
    *,
    slide: SlidePlan,
    slide_index: int,
    slide_total: int,
    style: str,
    design_spec: dict,
    deck_title: str,
    style_note: str = "",
    primary_color: str = "",
) -> str:
    bullets = slide.bullets or []
    style_context = build_style_context(
        style=style,
        style_note=style_note,
        primary_color=primary_color,
    )
    locked_palette = format_locked_palette_prompt(style, primary_color)
    user = (
        f"Deck: {deck_title}\n"
        f"Slide {slide_index}/{slide_total}\n"
        f"Layout: {slide.layout}\n"
        f"Title: {slide.title}\n"
        f"Subtitle: {slide.subtitle or ''}\n"
        f"Bullets: {json.dumps(bullets, ensure_ascii=False)}\n"
        f"Style preset ({style}): {style_context}\n"
        f"{locked_palette}\n"
        f"Design spec (layout/motif): {json.dumps({k: v for k, v in design_spec.items() if k != 'palette'}, ensure_ascii=False)}\n"
        f"Design spec palette (authoritative): {json.dumps(design_spec.get('palette', {}), ensure_ascii=False)}\n\n"
        "Generate one polished SVG slide. Colors MUST match LOCKED PALETTE / design spec palette exactly."
    )

    for attempt in range(2):
        try:
            raw = await chat_completion(
                messages=[
                    {"role": "system", "content": SVG_SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": user
                        + (
                            "\n\nIMPORTANT: Output complete well-formed SVG only. Every tag must be closed; end with </svg>."
                            if attempt > 0
                            else ""
                        ),
                    },
                ],
                temperature=0.55,
                use_executor_endpoint=True,
            )
            return sanitize_svg(raw)
        except Exception:  # noqa: BLE001
            if attempt == 0:
                await asyncio.sleep(2.0)
                continue
            break

    return build_slide_svg(slide, style, slide_index, slide_total, primary_color)


async def generate_all_slide_svgs(
    *,
    slides: list[SlidePlan],
    style: str,
    design_spec: dict,
    deck_title: str,
    style_note: str = "",
    primary_color: str = "",
    on_progress: Callable[[int, int, str], None] | None = None,
) -> list[str]:
    results: list[str] = []
    total = len(slides)
    for index, slide in enumerate(slides, start=1):
        if on_progress:
            on_progress(index, total, executor_model())
        svg = await generate_slide_svg(
            slide=slide,
            slide_index=index,
            slide_total=total,
            style=style,
            design_spec=design_spec,
            deck_title=deck_title,
            style_note=style_note,
            primary_color=primary_color,
        )
        results.append(svg)
        if index < total:
            await asyncio.sleep(3.0)
    return results
