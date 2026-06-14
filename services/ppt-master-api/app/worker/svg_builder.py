from __future__ import annotations

import re
import xml.sax.saxutils as saxutils
from dataclasses import dataclass


@dataclass
class SlidePlan:
    index: int
    layout: str
    title: str
    subtitle: str = ""
    bullets: list[str] | None = None


PALETTES = {
    "business": {
        "bg": ("#0f766e", "#134e4a"),
        "accent": "#14b8a6",
        "title": "#ffffff",
        "body": "#1e293b",
        "muted": "#64748b",
        "card": "#ffffff",
        "header": "#0f766e",
    },
    "editorial": {
        "bg": ("#1c1917", "#44403c"),
        "accent": "#f97316",
        "title": "#fafaf9",
        "body": "#292524",
        "muted": "#78716c",
        "card": "#fafaf9",
        "header": "#292524",
    },
    "minimal": {
        "bg": ("#f8fafc", "#e2e8f0"),
        "accent": "#334155",
        "title": "#0f172a",
        "body": "#334155",
        "muted": "#64748b",
        "card": "#ffffff",
        "header": "#ffffff",
    },
    "dark": {
        "bg": ("#0b1220", "#111827"),
        "accent": "#38bdf8",
        "title": "#f8fafc",
        "body": "#e2e8f0",
        "muted": "#94a3b8",
        "card": "#111827",
        "header": "#0f172a",
    },
}


def _esc(text: str) -> str:
    return saxutils.escape(text or "")


def _wrap_lines(text: str, max_chars: int = 28) -> list[str]:
    text = re.sub(r"\s+", " ", text.strip())
    if not text:
        return []
    lines: list[str] = []
    while len(text) > max_chars:
        split_at = text.rfind(" ", 0, max_chars)
        if split_at <= 0:
            split_at = max_chars
        lines.append(text[:split_at].strip())
        text = text[split_at:].strip()
    if text:
        lines.append(text)
    return lines


def _gradient_defs(palette: dict[str, str], grad_id: str) -> str:
    c1, c2 = palette["bg"]
    return (
        f'<defs><linearGradient id="{grad_id}" x1="0%" y1="0%" x2="100%" y2="100%">'
        f'<stop offset="0%" stop-color="{c1}"/>'
        f'<stop offset="100%" stop-color="{c2}"/>'
        f"</linearGradient></defs>"
    )


def build_slide_svg(slide: SlidePlan, style: str, page_number: int, total: int) -> str:
    palette = PALETTES.get(style, PALETTES["business"])
    grad_id = f"bg-{slide.index}"
    defs = _gradient_defs(palette, grad_id)
    bg = f'<rect width="1280" height="720" fill="url(#{grad_id})"/>'

    if slide.layout == "title":
        title_lines = _wrap_lines(slide.title, 18)
        subtitle = slide.subtitle.strip()
        title_y = 250 - (len(title_lines) - 1) * 24
        title_nodes = "".join(
            f'<text x="120" y="{title_y + i * 58}" fill="{palette["title"]}" '
            f'font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="46" font-weight="700">'
            f"{_esc(line)}</text>"
            for i, line in enumerate(title_lines)
        )
        subtitle_node = (
            f'<text x="120" y="{title_y + len(title_lines) * 58 + 24}" fill="{palette["title"]}" '
            f'opacity="0.82" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="24">'
            f"{_esc(subtitle)}</text>"
            if subtitle
            else ""
        )
        accent = f'<rect x="120" y="190" width="72" height="6" rx="3" fill="{palette["accent"]}"/>'
        body = accent + title_nodes + subtitle_node

    elif slide.layout == "section":
        accent = f'<rect x="560" y="250" width="160" height="8" rx="4" fill="{palette["accent"]}"/>'
        title = (
            f'<text x="640" y="340" text-anchor="middle" fill="{palette["title"]}" '
            f'font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="52" font-weight="700">'
            f"{_esc(slide.title)}</text>"
        )
        body = accent + title

    elif slide.layout == "closing":
        title = (
            f'<text x="640" y="340" text-anchor="middle" fill="{palette["title"]}" '
            f'font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="48" font-weight="700">'
            f"{_esc(slide.title or '谢谢聆听')}</text>"
        )
        subtitle = (
            f'<text x="640" y="400" text-anchor="middle" fill="{palette["title"]}" opacity="0.75" '
            f'font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="22">'
            f"{_esc(slide.subtitle)}</text>"
            if slide.subtitle
            else ""
        )
        body = title + subtitle

    else:
        header = (
            f'<rect x="0" y="0" width="1280" height="120" fill="{palette["header"]}"/>'
            f'<text x="110" y="78" fill="#ffffff" font-family="Microsoft YaHei, PingFang SC, sans-serif" '
            f'font-size="34" font-weight="700">{_esc(slide.title)}</text>'
        )
        card = (
            f'<rect x="90" y="150" width="1100" height="500" rx="18" fill="{palette["card"]}" '
            f'stroke="{palette["accent"]}" stroke-width="2" opacity="0.98"/>'
        )
        bullets = slide.bullets or []
        bullet_nodes = []
        for i, bullet in enumerate(bullets[:5]):
            y = 220 + i * 78
            badge = (
                f'<circle cx="130" cy="{y - 8}" r="18" fill="{palette["accent"]}"/>'
                f'<text x="130" y="{y - 2}" text-anchor="middle" fill="#ffffff" '
                f'font-family="Arial, sans-serif" font-size="16" font-weight="700">{i + 1}</text>'
            )
            lines = _wrap_lines(bullet, 42)
            text_nodes = "".join(
                f'<text x="170" y="{y + li * 28}" fill="{palette["body"]}" '
                f'font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="24">'
                f"{_esc(line)}</text>"
                for li, line in enumerate(lines[:2])
            )
            bullet_nodes.append(badge + text_nodes)
        body = header + card + "".join(bullet_nodes)

    page = (
        f'<text x="1210" y="690" text-anchor="end" fill="{palette["title"]}" opacity="0.55" '
        f'font-family="Arial, sans-serif" font-size="16">{page_number}</text>'
        if slide.layout != "title"
        else ""
    )

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">'
        f"{defs}{bg}{body}{page}</svg>"
    )
