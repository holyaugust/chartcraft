from __future__ import annotations

import asyncio
from collections.abc import Callable
from pathlib import Path

from app.config import settings
from app.worker.llm_client import chat_completion
from app.worker.reference_slides import image_path_to_data_uri
from app.worker.replica_fallback import build_replica_background_svg
from app.worker.replica_prompt import resolve_replica_prompt
from app.worker.svg_sanitize import sanitize_svg
from app.worker.vision import vision_endpoint_chain, vision_model

REPLICA_SYSTEM_PROMPT = """你是 PPT 幻灯片高保真还原专家。用户会提供一张 PPT 页面截图（16:9）。
你的唯一任务：把这张截图还原为可编辑 SVG，不是重新设计或换主题。

硬性要求：
1. 只输出一个完整 SVG，不要 markdown 或解释
2. 根元素：width="1280" height="720" viewBox="0 0 1280 720"
3. 截图中所有可见中文/英文/数字必须原样写入 <text>/<tspan>，禁止改写、概括或替换主题
4. 禁止出现截图里没有的标题、副标题、数据卡片或「示例/demo/趋势报告」类内容
5. 中文用 font-family="Microsoft YaHei, PingFang SC, sans-serif"
6. XML 合法：& 写 &amp;；禁止 HTML 实体；必须以 </svg> 结束
7. 禁止：mask, filter, drop-shadow, <style>, class, foreignObject, script, animate, symbol, use, textPath
8. 禁止用整页 <image> 贴图敷衍；装饰形状、色块、线条、圆环分区、渐变背景尽量用 SVG 矢量复现

还原要求：
- 页眉、标题区、环形图/流程图、四角文本框、底部数据条的位置与层级尽量与截图一致
- 配色从截图取样，不要擅自换成深色科技风或其他模板
- 复杂图表按截图中的分区与标签逐块复现，宁可简化几何也不要换成另一套内容
"""


def _vision_failure_hint(exc: BaseException) -> str:
    message = str(exc)
    lower = message.lower()
    if "invalid_model" in lower:
        return (
            "当前视觉模型不可用（invalid_model）。"
            "DeepSeek 官方 API 不支持读图；千帆 Key 若仅开通文库 PPT，也不能用于视觉对话。"
            "请在 .env 配置 PPT_MASTER_VISION_API_URL / PPT_MASTER_VISION_API_KEY / PPT_MASTER_VISION_MODEL"
            "（如阿里百炼 qwen-vl-plus）。"
        )
    if "image_url" in lower or "multimodal" in lower or "vision" in lower:
        return "视觉模型无法读取参照截图，请确认已配置支持 image_url 的多模态端点。"
    return message


async def generate_replica_svg_from_image(
    *,
    image_path: Path,
    slide_index: int,
    slide_total: int,
    user_hint: str = "",
) -> str:
    data_uri = image_path_to_data_uri(image_path)
    replica_hint = resolve_replica_prompt(user_hint)
    user_text = (
        f"Slide {slide_index}/{slide_total}\n"
        "附件是唯一权威来源：请逐字逐块还原该 PPT 页面截图。\n"
        "若截图标题是「生产流程核心环节」，输出必须是该主题，不得改成 AI 趋势、年度总结等其他主题。\n"
        f"还原要求：{replica_hint}"
    )
    messages = [
        {"role": "system", "content": REPLICA_SYSTEM_PROMPT},
        {"role": "user", "content": user_text},
    ]

    endpoints = vision_endpoint_chain()
    last_error: Exception | None = None

    for endpoint in endpoints:
        for attempt in range(2):
            try:
                raw = await chat_completion(
                    messages=messages,
                    model=endpoint["model"],
                    temperature=0.15 if attempt == 0 else 0.1,
                    use_vision_model=True,
                    image_urls=[data_uri],
                    require_vision_images=False,
                    api_url_override=endpoint["url"],
                    api_key_override=endpoint["api_key"],
                )
                return sanitize_svg(raw)
            except Exception as exc:  # noqa: BLE001
                last_error = exc
                if attempt == 0:
                    await asyncio.sleep(2.5)
                    continue
                break

    if settings.ppt_master_replica_image_fallback:
        return sanitize_svg(build_replica_background_svg(image_path))

    hint = _vision_failure_hint(last_error or RuntimeError("视觉模型未返回有效 SVG"))
    raise RuntimeError(f"第 {slide_index} 页截图还原失败：{hint}") from last_error


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
