from __future__ import annotations

DEFAULT_REPLICA_PROMPT = (
    "严格按上传的 PPT 页面截图还原：保留截图中的全部文字、配色、版式与图表结构，"
    "不要替换为其他主题或示例内容。"
)

_CREATIVE_MARKERS = (
    "请根据上传材料生成",
    "请根据材料生成",
    "突出核心结论",
)


def resolve_replica_prompt(prompt: str) -> str:
    trimmed = (prompt or "").strip()
    if not trimmed or any(marker in trimmed for marker in _CREATIVE_MARKERS):
        return DEFAULT_REPLICA_PROMPT
    return f"在严格还原截图的前提下：{trimmed}"
