from __future__ import annotations

import asyncio
import os
import shutil
import subprocess
import sys
from pathlib import Path

from docx import Document
from pypdf import PdfReader

from app.worker.svg_sanitize import normalize_svg_directory


def read_uploaded_source(path: Path) -> tuple[str, str]:
    suffix = path.suffix.lower()
    if suffix in {".md", ".markdown", ".txt"}:
        return path.read_text(encoding="utf-8", errors="ignore"), "markdown"
    if suffix == ".docx":
        doc = Document(str(path))
        text = "\n".join(p.text.strip() for p in doc.paragraphs if p.text.strip())
        return text, "docx"
    if suffix == ".pdf":
        reader = PdfReader(str(path))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages).strip(), "pdf"
    raise ValueError(f"不支持的文件类型：{suffix}")


def try_ppt_master_convert(ppt_master_home: Path, source_path: Path, dest_md: Path) -> str | None:
    scripts = ppt_master_home / "skills" / "ppt-master" / "scripts"
    if not scripts.exists():
        return None

    suffix = source_path.suffix.lower()
    converter: Path | None = None
    if suffix == ".pdf":
        converter = scripts / "source_to_md" / "pdf_to_md.py"
    elif suffix == ".docx":
        converter = scripts / "source_to_md" / "doc_to_md.py"
    if not converter or not converter.exists():
        return None

    dest_md.parent.mkdir(parents=True, exist_ok=True)
    cmd = [sys.executable, str(converter), str(source_path), "-o", str(dest_md)]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(ppt_master_home))
    if result.returncode != 0:
        return None
    if dest_md.exists():
        return dest_md.read_text(encoding="utf-8", errors="ignore")
    return None


def export_with_ppt_master(ppt_master_home: Path, project_dir: Path, svg_dir: Path) -> Path:
    scripts = ppt_master_home / "skills" / "ppt-master" / "scripts"
    if not scripts.exists():
        raise RuntimeError(
            f"未找到 PPT Master 脚本目录：{scripts}。"
            "请设置 PPT_MASTER_HOME 或运行 docker compose。"
        )

    finalize = scripts / "finalize_svg.py"
    svg_to_pptx = scripts / "svg_to_pptx.py"
    for script in (finalize, svg_to_pptx):
        if not script.exists():
            raise RuntimeError(f"缺少脚本：{script}")

    env = {"PYTHONPATH": str(scripts)}
    merged_env = {**os.environ, **env}

    for cmd in (
        [sys.executable, str(finalize), str(project_dir)],
    ):
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(ppt_master_home),
            env=merged_env,
        )
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "").strip()
            raise RuntimeError(f"PPT Master finalize 失败：{detail[:2000]}")

    svg_final = project_dir / "svg_final"
    if svg_final.exists():
        normalize_svg_directory(svg_final)

    result = subprocess.run(
        [sys.executable, str(svg_to_pptx), str(project_dir), "-s", "final"],
        capture_output=True,
        text=True,
        cwd=str(ppt_master_home),
        env=merged_env,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(f"PPT Master 导出失败：{detail[:2000]}")

    exports = project_dir / "exports"
    candidates = sorted(exports.glob("*.pptx"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not candidates:
        raise RuntimeError("PPT Master 导出完成但未找到 .pptx 文件")
    return candidates[0]


async def convert_source(source_path: Path, ppt_master_home: Path | None, workspace: Path) -> str:
    md_path = workspace / "source.md"
    if ppt_master_home and ppt_master_home.exists():
        converted = try_ppt_master_convert(ppt_master_home, source_path, md_path)
        if converted and converted.strip():
            return converted
    text, _ = read_uploaded_source(source_path)
    md_path.write_text(text, encoding="utf-8")
    return text
