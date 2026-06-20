"""One-off probe: verify Executor endpoint and sample SVG output."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from app.worker.llm_client import chat_completion, executor_api_url, executor_model
from app.worker.llm_svg import SVG_SYSTEM_PROMPT, sanitize_svg
from app.worker.svg_builder import SlidePlan, build_slide_svg

slide = SlidePlan(
    index=2,
    layout="content",
    title="报告背景与核心结论",
    bullets=[
        "国能集团推进非主业资产剥离，大金源公司拟转让特发能服49%股权",
        "我司作为控股股东，拟行使优先认购权，实现全资控股",
        "收购后有利于提升管控效能、深化协同、增厚收益、巩固客户关系",
        "整体风险可控，建议推进立项审批",
    ],
)
design_spec = {
    "palette": {
        "primary": "#0f766e",
        "secondary": "#14b8a6",
        "background": "#f8fafc",
        "surface": "#ffffff",
        "text": "#1e293b",
        "muted": "#64748b",
    },
    "typography": "Microsoft YaHei, PingFang SC, sans-serif",
    "motif": "corporate teal cards",
    "tone": "professional",
}


async def main() -> None:
    print("URL=", executor_api_url())
    print("MODEL=", executor_model())
    user = (
        "Deck: test\nSlide 2/13\nLayout: content\n"
        f"Title: {slide.title}\n"
        f"Bullets: {json.dumps(slide.bullets, ensure_ascii=False)}\n"
        f"Design spec: {json.dumps(design_spec, ensure_ascii=False)}\n"
        "Generate one polished SVG slide matching the design spec."
    )
    raw = await chat_completion(
        messages=[
            {"role": "system", "content": SVG_SYSTEM_PROMPT},
            {"role": "user", "content": user},
        ],
        temperature=0.55,
        use_executor_endpoint=True,
        timeout=120,
    )
    svg = sanitize_svg(raw)
    out = Path(__file__).resolve().parents[1] / "data" / "probe_slide.svg"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(svg, encoding="utf-8")
    print("saved", out)
    print("len", len(svg))
    print("has_grid", "grid" in svg.lower() or "pattern" in svg.lower())
    print("has_gradient", "linearGradient" in svg or "radialGradient" in svg)
    print("circle_count", svg.count("<circle"))

    tpl = build_slide_svg(slide, "business", 2, 13)
    print("template_header_bar", 'height="120"' in tpl)
    print("template_gradient", "linearGradient" in tpl)


if __name__ == "__main__":
    asyncio.run(main())
