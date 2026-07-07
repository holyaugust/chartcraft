from __future__ import annotations

from pathlib import Path

from app.worker.reference_slides import image_path_to_data_uri


def build_replica_background_svg(image_path: Path) -> str:
    """无可用视觉模型时：将截图铺底为 16:9 SVG，保证版式与截图一致。"""
    data_uri = image_path_to_data_uri(image_path)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" '
        'xmlns:xlink="http://www.w3.org/1999/xlink" '
        'width="1280" height="720" viewBox="0 0 1280 720">\n'
        f'  <image x="0" y="0" width="1280" height="720" '
        'preserveAspectRatio="xMidYMid meet" '
        f'xlink:href="{data_uri}" href="{data_uri}"/>\n'
        "</svg>"
    )
