from __future__ import annotations

import json
import re
from collections.abc import Callable

from app.worker.design_spec import STYLE_ART_DIRECTION
from app.worker.llm_client import chat_completion, visual_model
from app.worker.svg_builder import SlidePlan, build_slide_svg
from app.worker.svg_sanitize import sanitize_svg

SVG_SYSTEM_PROMPT = """你是 PPT Master Executor，为单页 16:9 幻灯片生成完整 SVG。

硬性要求：
1. 只输出一个完整 SVG 文档，不要 markdown 说明
2. 根元素：width="1280" height="720" viewBox="0 0 1280 720"
3. 使用绝对坐标布局（canvas 思维），所有文字可读、不重叠
4. 中文正文用 font-family="Microsoft YaHei, PingFang SC, sans-serif"
5. XML 合法：& 写 &amp;；禁止 HTML 实体如 &nbsp; &mdash;
6. 禁止：mask, filter, drop-shadow, <style>, class, foreignObject, symbol/use, textPath, script, animate, <span>
7. 文字富文本样式只能用 <tspan>（禁止 <span>）

视觉要求：
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
) -> str:
    bullets = slide.bullets or []
    user = (
        f"Deck: {deck_title}\n"
        f"Slide {slide_index}/{slide_total}\n"
        f"Layout: {slide.layout}\n"
        f"Title: {slide.title}\n"
        f"Subtitle: {slide.subtitle or ''}\n"
        f"Bullets: {json.dumps(bullets, ensure_ascii=False)}\n"
        f"Style preset: {style} — {STYLE_ART_DIRECTION.get(style, '')}\n"
        f"Design spec: {json.dumps(design_spec, ensure_ascii=False)}\n\n"
        "Generate one polished SVG slide matching the design spec."
    )

    raw = await chat_completion(
        messages=[
            {"role": "system", "content": SVG_SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ],
        temperature=0.55,
        use_visual_endpoint=True,
    )

    try:
        return sanitize_svg(raw)
    except ValueError:
        return build_slide_svg(slide, style, slide_index, slide_total)


async def generate_all_slide_svgs(
    *,
    slides: list[SlidePlan],
    style: str,
    design_spec: dict,
    deck_title: str,
    on_progress: Callable[[int, int, str], None] | None = None,
) -> list[str]:
    results: list[str] = []
    total = len(slides)
    for index, slide in enumerate(slides, start=1):
        if on_progress:
            on_progress(index, total, visual_model())
        svg = await generate_slide_svg(
            slide=slide,
            slide_index=index,
            slide_total=total,
            style=style,
            design_spec=design_spec,
            deck_title=deck_title,
        )
        results.append(svg)
    return results
