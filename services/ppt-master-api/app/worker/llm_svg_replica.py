from __future__ import annotations

import asyncio
from collections.abc import Callable
from pathlib import Path

from app.worker.llm_client import chat_completion
from app.worker.reference_slides import image_path_to_data_uri
from app.worker.svg_builder import SlidePlan, build_slide_svg
from app.worker.svg_sanitize import sanitize_svg
from app.worker.vision import vision_model

REPLICA_SYSTEM_PROMPT = """你是 PPT 幻灯片高保真还原专家。用户会提供一张 PPT 页面截图（16:9）。
请输出与参考图在版式、配色、层级上高度一致的完整 SVG 文档。

硬性要求：
1. 只输出一个完整 SVG，不要 markdown 或解释
2. 根元素：width="1280" height="720" viewBox="0 0 1280 720"
3. 参考图中的所有可见文字必须转为可编辑的 <text>/<tspan>，不要用 <image> 替代整页
4. 中文用 font-family="Microsoft YaHei, PingFang SC, sans-serif"
5. XML 合法：& 写 &amp;；禁止 &nbsp; 等 HTML 实体；必须以 </svg> 结束
6. 禁止：mask, filter, drop-shadow, <style>, class, foreignObject, script, animate, symbol, use, textPath
7. 装饰形状、色块、线条、渐变背景尽量用 SVG 矢量复现；Logo/照片区域可用简化为色块并标注

还原要求：
- 标题、副标题、正文、页码、页眉页脚的位置与字号层级尽量与参考图一致
- 配色从参考图中取样，不要擅自换成另一套主题
- 列表项、卡片分区、图标占位尽量保留原有结构
"""


async def generate_replica_svg_from_image(
    *,
    image_path: Path,
    slide_index: int,
    slide_total: int,
    user_hint: str = "",
) -> str:
    data_uri = image_path_to_data_uri(image_path)
    hint = user_hint.strip()
    user_text = (
        f"Slide {slide_index}/{slide_total}\n"
        "请根据附件中的 PPT 页面截图，输出高保真可编辑 SVG。\n"
        "务必保留图中所有文字内容与大致排版位置。"
    )
    if hint:
        user_text += f"\n\n额外要求：{hint}"

    for attempt in range(2):
        try:
            raw = await chat_completion(
                messages=[
                    {"role": "system", "content": REPLICA_SYSTEM_PROMPT},
                    {"role": "user", "content": user_text},
                ],
                temperature=0.2 if attempt == 0 else 0.15,
                use_vision_model=True,
                image_urls=[data_uri],
            )
            return sanitize_svg(raw)
        except Exception:  # noqa: BLE001
            if attempt == 0:
                await asyncio.sleep(2.5)
                continue
            break

    fallback = SlidePlan(
        layout="content",
        title=f"第 {slide_index} 页",
        subtitle="参照页还原失败，已使用简化模板",
        bullets=["请检查参照图清晰度或重试"],
    )
    return build_slide_svg(fallback, "business", slide_index, slide_total, "")


async def generate_all_replica_svgs(
    *,
    image_paths: list[Path],
    user_hint: str = "",
    on_progress: Callable[[int, int, str], None] | None = None,
) -> list[str]:
    results: list[str] = []
    total = len(image_paths)
    model = vision_model()
    for index, image_path in enumerate(image_paths, start=1):
        if on_progress:
            on_progress(index, total, model)
        svg = await generate_replica_svg_from_image(
            image_path=image_path,
            slide_index=index,
            slide_total=total,
            user_hint=user_hint,
        )
        results.append(svg)
        if index < total:
            await asyncio.sleep(3.0)
    return results
