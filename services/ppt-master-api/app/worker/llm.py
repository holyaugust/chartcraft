from __future__ import annotations

import json
import re

from app.config import settings
from app.worker.llm_client import chat_completion
from app.worker.svg_builder import SlidePlan


def _extract_json(text: str) -> dict:
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fence:
        text = fence.group(1).strip()
    return json.loads(text)


async def plan_slides_from_markdown(
    *,
    markdown: str,
    prompt: str,
    style: str,
    deck_title: str,
) -> tuple[str, list[SlidePlan]]:
    if not settings.ppt_master_llm_api_key.strip():
        raise RuntimeError("未配置 PPT_MASTER_LLM_API_KEY，无法规划幻灯片结构")

    system = (
        "你是专业汇报 PPT 策划。根据源材料输出 JSON，不要输出其它文字。"
        "JSON 格式："
        '{"deck_title":"...","slides":[{"layout":"title|section|content|closing",'
        '"title":"...","subtitle":"","bullets":["..."]}]}'
        "规则：第一页 layout=title；中间可用 section 分隔章节；正文用 content 且 bullets 1-5 条；"
        "最后一页 layout=closing；总页数 6-12 页；语言与源材料一致。"
    )
    user = (
        f"视觉风格：{style}\n"
        f"用户要求：{prompt}\n"
        f"建议标题：{deck_title}\n\n"
        f"源材料：\n{markdown[:12000]}"
    )

    content = await chat_completion(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        model=settings.ppt_master_llm_model,
        temperature=0.4,
    )
    data = _extract_json(content)
    title = str(data.get("deck_title") or deck_title).strip() or deck_title
    slides_raw = data.get("slides") or []
    slides: list[SlidePlan] = []
    for index, item in enumerate(slides_raw):
        layout = str(item.get("layout") or "content")
        if layout not in {"title", "section", "content", "closing"}:
            layout = "content"
        bullets = item.get("bullets")
        if isinstance(bullets, list):
            bullet_lines = [str(b).strip() for b in bullets if str(b).strip()]
        else:
            bullet_lines = []
        slides.append(
            SlidePlan(
                index=index + 1,
                layout=layout,
                title=str(item.get("title") or "").strip() or f"第 {index + 1} 页",
                subtitle=str(item.get("subtitle") or "").strip(),
                bullets=bullet_lines,
            )
        )

    if not slides:
        raise RuntimeError("LLM 未返回有效幻灯片结构")

    if slides[0].layout != "title":
        slides.insert(0, SlidePlan(index=1, layout="title", title=title, subtitle=prompt[:80]))
        for i, slide in enumerate(slides):
            slide.index = i + 1

    return title, slides


def plan_slides_fallback(*, markdown: str, deck_title: str) -> tuple[str, list[SlidePlan]]:
    """无 LLM 时的兜底结构（仅用于本地调试）。"""
    chunks = [line.strip() for line in markdown.splitlines() if line.strip()]
    body = chunks[:12] if chunks else ["要点一", "要点二", "要点三"]
    slides: list[SlidePlan] = [
        SlidePlan(index=1, layout="title", title=deck_title, subtitle="ChartCraft · PPT Master"),
    ]
    for i in range(0, len(body), 4):
        group = body[i : i + 4]
        slides.append(
            SlidePlan(
                index=len(slides) + 1,
                layout="content",
                title=f"核心内容 {len(slides)}",
                bullets=group,
            )
        )
    slides.append(SlidePlan(index=len(slides) + 1, layout="closing", title="谢谢聆听", subtitle=deck_title))
    for i, slide in enumerate(slides):
        slide.index = i + 1
    return deck_title, slides
