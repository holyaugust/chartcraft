from __future__ import annotations

import re

STYLE_LABELS: dict[str, str] = {
    "business": "商务汇报",
    "tech": "科技蓝",
    "academic": "学术绿",
    "editorial": "杂志 editorial",
    "minimal": "极简灰白",
    "dark": "深色数据",
    "creative": "创意渐变",
    "warm": "暖色品牌",
    "luxury": "轻奢金",
    "gov": "政务正式",
}

STYLE_ART_DIRECTION: dict[str, str] = {
    "business": (
        "Professional corporate deck: teal/emerald gradients, clean cards, numbered badges, "
        "confident hierarchy, suitable for board reporting."
    ),
    "tech": (
        "Futuristic tech keynote: deep blue gradients, cyan accents, geometric grid lines, "
        "glass-style cards, product launch and innovation briefing tone."
    ),
    "academic": (
        "Academic research deck: forest green palette, scholarly hierarchy, data-friendly blocks, "
        "university report and survey presentation tone."
    ),
    "editorial": (
        "Editorial magazine layout: strong typography, generous whitespace, photography frames, "
        "muted stone palette with orange accent, calm and premium."
    ),
    "minimal": (
        "Swiss minimal: light gray background, thin rules, restrained sans-serif, "
        "high whitespace, subtle accent line, no clutter."
    ),
    "dark": (
        "Data dashboard dark mode: navy background, cyan highlights, chart-friendly blocks, "
        "Bloomberg-inspired information density with clear contrast."
    ),
    "creative": (
        "Bold creative agency: vivid purple-pink-orange gradients, asymmetric layouts, "
        "playful shapes, high-energy brand storytelling."
    ),
    "warm": (
        "Warm brand storytelling: terracotta, coral and amber tones, rounded friendly cards, "
        "consumer marketing and team culture presentation feel."
    ),
    "luxury": (
        "Luxury premium consulting: charcoal and black with gold accents, refined spacing, "
        "subtle elegance, high-end finance or boutique brand pitch."
    ),
    "gov": (
        "Government formal report: authoritative red with navy structure, numbered sections, "
        "column layouts, solemn policy briefing and institutional reporting tone."
    ),
}

PALETTES: dict[str, dict[str, str | tuple[str, str]]] = {
    "business": {
        "bg": ("#0f766e", "#134e4a"),
        "accent": "#14b8a6",
        "title": "#ffffff",
        "body": "#1e293b",
        "muted": "#64748b",
        "card": "#ffffff",
        "header": "#0f766e",
    },
    "tech": {
        "bg": ("#1e3a8a", "#0f172a"),
        "accent": "#06b6d4",
        "title": "#f8fafc",
        "body": "#1e293b",
        "muted": "#64748b",
        "card": "#ffffff",
        "header": "#1e40af",
    },
    "academic": {
        "bg": ("#14532d", "#1f6b4f"),
        "accent": "#fbbf24",
        "title": "#ffffff",
        "body": "#1e293b",
        "muted": "#64748b",
        "card": "#ffffff",
        "header": "#166534",
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
    "creative": {
        "bg": ("#7c3aed", "#db2777"),
        "accent": "#f97316",
        "title": "#ffffff",
        "body": "#1e293b",
        "muted": "#64748b",
        "card": "#ffffff",
        "header": "#6d28d9",
    },
    "warm": {
        "bg": ("#ea580c", "#c2410c"),
        "accent": "#fbbf24",
        "title": "#fff7ed",
        "body": "#431407",
        "muted": "#9a3412",
        "card": "#fff7ed",
        "header": "#c2410c",
    },
    "luxury": {
        "bg": ("#1c1917", "#0a0a0a"),
        "accent": "#d4af37",
        "title": "#fafaf9",
        "body": "#e7e5e4",
        "muted": "#a8a29e",
        "card": "#292524",
        "header": "#171717",
    },
    "gov": {
        "bg": ("#991b1b", "#1e3a5f"),
        "accent": "#dc2626",
        "title": "#ffffff",
        "body": "#1e293b",
        "muted": "#64748b",
        "card": "#ffffff",
        "header": "#1e3a5f",
    },
}

_HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


def valid_hex(color: str) -> bool:
    return bool(_HEX_RE.match(color.strip()))


def _darken_hex(hex_color: str, factor: float = 0.65) -> str:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"#{int(r * factor):02x}{int(g * factor):02x}{int(b * factor):02x}"


def build_style_context(*, style: str, style_note: str = "", primary_color: str = "") -> str:
    parts = [STYLE_ART_DIRECTION.get(style, STYLE_ART_DIRECTION["business"])]
    note = style_note.strip()
    if note:
        parts.append(f"Additional user style direction: {note}")
    color = primary_color.strip()
    if color and valid_hex(color):
        parts.append(
            f"User preferred primary/accent color: {color} — use as dominant accent in palette, "
            "badges, headers and decorative elements."
        )
    return "\n".join(parts)


def apply_primary_to_palette(palette: dict, primary_color: str) -> dict:
    if not valid_hex(primary_color):
        return palette
    merged = dict(palette)
    merged["accent"] = primary_color
    merged["header"] = primary_color
    merged["bg"] = (primary_color, _darken_hex(primary_color, 0.55))
    return merged


def design_spec_palette(style: str, primary_color: str = "") -> dict[str, str]:
    """Map built-in style swatch to design_spec palette (locked hex values)."""
    raw = dict(PALETTES.get(style, PALETTES["business"]))
    raw = apply_primary_to_palette(raw, primary_color)
    bg = raw["bg"]
    if isinstance(bg, tuple):
        background_start, background_end = bg[0], bg[1]
    else:
        background_start, background_end = str(bg), str(raw["header"])
    return {
        "primary": str(raw["accent"]),
        "secondary": str(raw["header"]),
        "background_start": background_start,
        "background_end": background_end,
        "surface": str(raw["card"]),
        "text": str(raw["body"]),
        "title": str(raw["title"]),
        "muted": str(raw["muted"]),
        "header": str(raw["header"]),
    }


def lock_design_spec_palette(spec: dict, style: str, primary_color: str = "") -> dict:
    """Force design_spec palette to match the selected style preset."""
    merged = dict(spec)
    merged["palette"] = design_spec_palette(style, primary_color)
    merged["style_preset"] = style
    merged["style_label"] = STYLE_LABELS.get(style, style)
    merged["palette_locked"] = True
    return merged


def format_locked_palette_prompt(style: str, primary_color: str = "") -> str:
    palette = design_spec_palette(style, primary_color)
    label = STYLE_LABELS.get(style, style)
    return (
        f"LOCKED PALETTE — style「{label}」({style}). "
        "You MUST use these exact hex colors only; do not invent substitutes:\n"
        f"- Slide background linearGradient: {palette['background_start']} → {palette['background_end']}\n"
        f"- Accent / badges / highlights: {palette['primary']}\n"
        f"- Header bars / secondary blocks: {palette['secondary']}\n"
        f"- Card / surface fill: {palette['surface']}\n"
        f"- Body text on light areas: {palette['text']}\n"
        f"- Title text on gradient/dark areas: {palette['title']}\n"
        f"- Muted / captions: {palette['muted']}"
    )


def apply_primary_to_spec(spec: dict, primary_color: str) -> dict:
    if not valid_hex(primary_color):
        return spec
    palette = dict(spec.get("palette") or {})
    palette["primary"] = primary_color
    palette.setdefault("secondary", _darken_hex(primary_color, 0.75))
    spec["palette"] = palette
    return spec
