from __future__ import annotations

import base64
import mimetypes
from pathlib import Path

_DIR_NAME = "reference_slides"
_ALLOWED_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"}
_MAX_BYTES = 12 * 1024 * 1024


class ReferenceSlideError(ValueError):
    pass


def reference_slides_dir(job_dir: Path) -> Path:
    path = job_dir / _DIR_NAME
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_reference_slides(job_dir: Path, files: list[tuple[str, bytes]]) -> list[str]:
    if not files:
        return []

    dest = reference_slides_dir(job_dir)
    saved: list[str] = []
    for index, (filename, content) in enumerate(files, start=1):
        safe_name = Path(filename).name
        suffix = Path(safe_name).suffix.lower()
        if suffix not in _ALLOWED_SUFFIXES:
            raise ReferenceSlideError(f"不支持的参照页格式：{suffix or '未知'}（请用 PNG/JPG/WebP）")
        if len(content) > _MAX_BYTES:
            raise ReferenceSlideError(f"参照页「{safe_name}」超过 12MB 上限")
        if len(content) < 32:
            raise ReferenceSlideError(f"参照页「{safe_name}」文件无效")

        dest_name = f"slide_{index:02d}{suffix}"
        dest_path = dest / dest_name
        dest_path.write_bytes(content)
        saved.append(dest_name)
    return saved


def list_reference_slide_paths(job_dir: Path) -> list[Path]:
    dest = reference_slides_dir(job_dir)
    if not dest.exists():
        return []
    paths = [path for path in dest.iterdir() if path.is_file() and path.suffix.lower() in _ALLOWED_SUFFIXES]
    return sorted(paths, key=lambda item: item.name)


def image_path_to_data_uri(path: Path) -> str:
    mime, _ = mimetypes.guess_type(str(path))
    if not mime or not mime.startswith("image/"):
        suffix = path.suffix.lower()
        mime = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".bmp": "image/bmp",
        }.get(suffix, "image/png")
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def write_stub_source(job_dir: Path, slide_count: int) -> Path:
    lines = ["参照页还原任务", f"共 {slide_count} 页参照截图", ""]
    for index in range(1, slide_count + 1):
        lines.append(f"## 第 {index} 页")
        lines.append(f"（第 {index} 页内容来自上传的参照截图）")
        lines.append("")
    stub_path = job_dir / "_reference_replica_stub.md"
    stub_path.write_text("\n".join(lines), encoding="utf-8")
    return stub_path
