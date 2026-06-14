from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from pathlib import Path

SVG_NS = "http://www.w3.org/2000/svg"

HTML_ENTITY_REPLACEMENTS = {
    "&nbsp;": "\u00a0",
    "&mdash;": "—",
    "&ndash;": "–",
    "&copy;": "©",
    "&reg;": "®",
    "&rarr;": "→",
    "&middot;": "·",
    "&hellip;": "…",
    "&bull;": "•",
    "&#160;": "\u00a0",
    "&#xa0;": "\u00a0",
}

_STRIP_ATTRS = ("filter", "class", "mask")


def _local_tag(tag: str) -> str:
    if isinstance(tag, str) and "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return str(tag)


def normalize_svg_tree(root: ET.Element) -> None:
    """Align LLM SVG with PPT Master native DrawingML constraints."""
    for elem in list(root.iter()):
        if _local_tag(elem.tag) == "span":
            elem.tag = "tspan"

        for attr in _STRIP_ATTRS:
            if attr in elem.attrib:
                del elem.attrib[attr]

    for defs in list(root.iter("defs")):
        for child in list(defs):
            if _local_tag(child.tag) == "filter":
                defs.remove(child)


def normalize_svg_file(path: Path) -> None:
    tree = ET.parse(path)
    normalize_svg_tree(tree.getroot())
    tree.write(path, encoding="unicode", xml_declaration=False)


def normalize_svg_directory(svg_dir: Path) -> None:
    for svg_path in sorted(svg_dir.glob("*.svg")):
        normalize_svg_file(svg_path)


def extract_svg(raw: str) -> str:
    text = raw.strip()
    fence = re.search(r"```(?:svg|xml)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()
    start = text.find("<svg")
    end = text.rfind("</svg>")
    if start >= 0 and end > start:
        text = text[start : end + 6]
    return text.strip()


def sanitize_svg(raw: str) -> str:
    svg = extract_svg(raw)
    if not svg.lower().startswith("<svg"):
        raise ValueError("LLM 输出不是有效 SVG")

    for entity, char in HTML_ENTITY_REPLACEMENTS.items():
        svg = svg.replace(entity, char)

    svg = re.sub(r"<style[\s\S]*?</style>", "", svg, flags=re.IGNORECASE)
    svg = re.sub(r"\sclass=\"[^\"]*\"", "", svg, flags=re.IGNORECASE)
    svg = re.sub(r"<foreignObject[\s\S]*?</foreignObject>", "", svg, flags=re.IGNORECASE)
    svg = re.sub(r"<script[\s\S]*?</script>", "", svg, flags=re.IGNORECASE)
    svg = re.sub(r'\sfilter="[^"]*"', "", svg, flags=re.IGNORECASE)

    if 'viewBox="0 0 1280 720"' not in svg and "viewBox='0 0 1280 720'" not in svg:
        svg = re.sub(
            r"<svg\b",
            '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"',
            svg,
            count=1,
            flags=re.IGNORECASE,
        )

    root = ET.fromstring(svg)
    normalize_svg_tree(root)
    svg = ET.tostring(root, encoding="unicode")

    try:
        ET.fromstring(svg)
    except ET.ParseError as exc:
        raise ValueError(f"SVG XML 无效：{exc}") from exc

    return svg
