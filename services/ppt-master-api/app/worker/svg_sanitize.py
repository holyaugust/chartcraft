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

# PPT Master svg_to_pptx 原生 DrawingML 不支持的标签
_UNSUPPORTED_TAGS = frozenset(
    {
        "use",
        "symbol",
        "textPath",
        "animate",
        "animateTransform",
        "animateMotion",
        "set",
        "foreignObject",
        "script",
    }
)


def _local_tag(tag: str) -> str:
    if isinstance(tag, str) and "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return str(tag)


def _promote_orphan_tspan_to_text(tspan: ET.Element) -> ET.Element:
    text = ET.Element("text")
    for key, value in tspan.attrib.items():
        text.set(key, value)
    text.text = tspan.text
    text.tail = tspan.tail
    for child in list(tspan):
        text.append(child)
    return text


def _strip_unsupported_elements(root: ET.Element) -> None:
    """Remove tags that break PPT Master native SVG → DrawingML conversion."""
    to_remove: list[tuple[ET.Element, ET.Element]] = []
    for parent in root.iter():
        for child in list(parent):
            if _local_tag(child.tag) in _UNSUPPORTED_TAGS:
                to_remove.append((parent, child))
    for parent, child in to_remove:
        parent.remove(child)


def _flatten_nested_svgs(root: ET.Element) -> None:
    """Unwrap nested <svg> wrappers so shapes stay convertible."""
    changed = True
    while changed:
        changed = False
        for parent in root.iter():
            for child in list(parent):
                if _local_tag(child.tag) != "svg" or child is root:
                    continue
                index = list(parent).index(child)
                for grandchild in list(child):
                    parent.insert(index, grandchild)
                    index += 1
                parent.remove(child)
                changed = True
                break
            if changed:
                break


def _fix_orphan_tspans(root: ET.Element) -> None:
    """PPT Master only allows <tspan> inside <text>, never as top-level shapes."""
    changed = True
    while changed:
        changed = False
        for parent in root.iter():
            if _local_tag(parent.tag) == "text":
                continue
            for child in list(parent):
                if _local_tag(child.tag) != "tspan":
                    continue
                promoted = _promote_orphan_tspan_to_text(child)
                index = list(parent).index(child)
                parent.remove(child)
                parent.insert(index, promoted)
                changed = True
                break
            if changed:
                break


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
            if _local_tag(child.tag) in {"filter", "symbol"}:
                defs.remove(child)

    _strip_unsupported_elements(root)
    _flatten_nested_svgs(root)
    _fix_orphan_tspans(root)


def normalize_svg_file(path: Path) -> None:
    try:
        tree = ET.parse(path)
    except ET.ParseError:
        return
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
    svg = re.sub(r"<symbol[\s\S]*?</symbol>", "", svg, flags=re.IGNORECASE)
    svg = re.sub(r"<use\b[^>]*/>", "", svg, flags=re.IGNORECASE)
    svg = re.sub(r"<use[\s\S]*?</use>", "", svg, flags=re.IGNORECASE)
    svg = re.sub(r'\sfilter="[^"]*"', "", svg, flags=re.IGNORECASE)

    if 'viewBox="0 0 1280 720"' not in svg and "viewBox='0 0 1280 720'" not in svg:
        svg = re.sub(
            r"<svg\b",
            '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"',
            svg,
            count=1,
            flags=re.IGNORECASE,
        )

    try:
        root = ET.fromstring(svg)
    except ET.ParseError as exc:
        raise ValueError(f"SVG XML 无效：{exc}") from exc
    normalize_svg_tree(root)
    svg = ET.tostring(root, encoding="unicode")

    try:
        ET.fromstring(svg)
    except ET.ParseError as exc:
        raise ValueError(f"SVG XML 无效：{exc}") from exc

    return svg
