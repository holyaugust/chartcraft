from __future__ import annotations

import asyncio
import shutil
from pathlib import Path

from app.config import settings
from app.models import JobProgress, JobStatus
from app.store import store
from app.worker.design_spec import create_design_spec
from app.worker.llm import plan_slides_fallback, plan_slides_from_markdown
from app.worker.llm_client import executor_model
from app.worker.llm_svg import generate_all_slide_svgs
from app.worker.llm_svg_replica import generate_all_replica_svgs
from app.worker.reference_slides import list_reference_slide_paths
from app.worker.replica_prompt import resolve_replica_prompt
from app.worker.svg_sanitize import normalize_svg_directory
from app.worker.source_convert import convert_source, export_with_ppt_master
from app.worker.svg_builder import build_slide_svg
from app.worker.vision import vision_enabled, vision_model


def _ppt_master_home() -> Path | None:
    raw = settings.ppt_master_home.strip()
    if not raw:
        return None
    path = Path(raw)
    return path if path.exists() else None


def _render_mode() -> str:
    mode = settings.ppt_master_render_mode.strip().lower()
    return mode if mode in {"ai_svg", "template"} else "ai_svg"


def _generation_mode(record) -> str:
    mode = (record.generation_mode or "creative").strip().lower()
    return mode if mode in {"creative", "replica"} else "creative"


def run_job(job_id: str) -> None:
    record = store.get(job_id)
    if not record:
        return

    render_mode = _render_mode()
    generation_mode = _generation_mode(record)
    job_dir = store.job_dir(job_id)
    reference_paths = list_reference_slide_paths(job_dir)
    is_replica = generation_mode == "replica" and len(reference_paths) > 0

    store.update(
        job_id,
        status=JobStatus.running,
        progress=JobProgress(step="prepare", percent=5, message="准备任务…"),
        log=f"任务开始 · 模式={generation_mode} · 渲染={render_mode}",
    )

    workspace = store.workspace(job_id)
    source_path = job_dir / record.source_name
    if not source_path.exists():
        raise FileNotFoundError(f"源文件不存在：{source_path.name}")

    ppt_master_home = _ppt_master_home()

    if is_replica and not vision_enabled():
        raise RuntimeError("参照页还原需要开启 PPT_MASTER_VISION_ENABLED 并配置视觉模型")

    store.update(
        job_id,
        progress=JobProgress(step="convert", percent=12, message="解析源文档…"),
        log="解析源文档",
    )
    markdown = asyncio.run(convert_source(source_path, ppt_master_home, workspace))
    if not markdown.strip() and not is_replica:
        raise RuntimeError("源文档未提取到可用文字")

    deck_title = Path(record.source_name).stem
    if is_replica:
        deck_title = deck_title.replace("_reference_replica_stub", "参照页还原") or "参照页还原"

    slides = []
    if is_replica:
        store.update(
            job_id,
            progress=JobProgress(step="plan", percent=22, message="已锁定参照页顺序…"),
            log=f"参照页还原 · 共 {len(reference_paths)} 页",
        )
    else:
        store.update(
            job_id,
            progress=JobProgress(step="plan", percent=22, message="AI 规划幻灯片结构…"),
            log="调用 LLM 规划结构",
        )
        try:
            deck_title, slides = asyncio.run(
                plan_slides_from_markdown(
                    markdown=markdown,
                    prompt=record.prompt,
                    style=record.style,
                    deck_title=deck_title,
                    style_note=record.style_note,
                )
            )
        except Exception as exc:  # noqa: BLE001
            store.update(job_id, log=f"LLM 规划失败，使用兜底结构：{exc}")
            deck_title, slides = plan_slides_fallback(markdown=markdown, deck_title=deck_title)

    design_spec: dict = {}
    if render_mode == "ai_svg" and not is_replica:
        store.update(
            job_id,
            progress=JobProgress(step="design", percent=32, message="AI 制定视觉设计规范…"),
            log=f"Strategist 设计规范 · 模型 {vision_model()}",
        )
        try:
            design_spec = asyncio.run(
                create_design_spec(
                    markdown=markdown,
                    prompt=record.prompt,
                    style=record.style,
                    deck_title=deck_title,
                    style_note=record.style_note,
                    primary_color=record.primary_color,
                    reference_image_url=record.reference_image_url,
                )
            )
        except Exception as exc:  # noqa: BLE001
            store.update(job_id, log=f"设计规范生成失败，使用风格预设：{exc}")

    project_dir = workspace / "ppt_project"
    if project_dir.exists():
        shutil.rmtree(project_dir)
    project_dir.mkdir(parents=True, exist_ok=True)
    (project_dir / "exports").mkdir(exist_ok=True)
    svg_dir = project_dir / "svg_output"
    svg_dir.mkdir(exist_ok=True)

    def on_slide_progress(current: int, total: int, model: str) -> None:
        percent = 40 + int((current / max(total, 1)) * 38)
        message = (
            f"视觉还原第 {current}/{total} 页（{model}）…"
            if is_replica
            else f"AI 绘制第 {current}/{total} 页 SVG（{model}）…"
        )
        store.update(
            job_id,
            progress=JobProgress(step="render", percent=percent, message=message),
            log=f"{'Replica' if is_replica else 'Executor'} 第 {current}/{total} 页",
        )

    slide_total = len(reference_paths) if is_replica else len(slides)

    if is_replica:
        svg_contents = asyncio.run(
            generate_all_replica_svgs(
                image_paths=reference_paths,
                user_hint=resolve_replica_prompt(record.prompt),
                on_progress=on_slide_progress,
            )
        )
    elif render_mode == "ai_svg":
        svg_contents = asyncio.run(
            generate_all_slide_svgs(
                slides=slides,
                style=record.style,
                design_spec=design_spec,
                deck_title=deck_title,
                style_note=record.style_note,
                primary_color=record.primary_color,
                on_progress=on_slide_progress,
            )
        )
    else:
        store.update(
            job_id,
            progress=JobProgress(step="render", percent=55, message="模板渲染 SVG…"),
            log=f"模板模式生成 {len(slides)} 页",
        )
        svg_contents = [
            build_slide_svg(slide, record.style, index, len(slides), record.primary_color)
            for index, slide in enumerate(slides, start=1)
        ]

    for index, svg in enumerate(svg_contents, start=1):
        (svg_dir / f"slide_{index:02d}.svg").write_text(svg, encoding="utf-8")
    normalize_svg_directory(svg_dir)

    store.update(
        job_id,
        progress=JobProgress(step="export", percent=82, message="导出可编辑 PPTX…"),
        log="调用 PPT Master finalize_svg + svg_to_pptx",
    )
    if not ppt_master_home:
        raise RuntimeError(
            "未配置可用的 PPT Master（PPT_MASTER_HOME）。"
            "请 clone hugohe3/ppt-master 并安装依赖，或使用 docker compose up。"
        )

    exported = export_with_ppt_master(ppt_master_home, project_dir, svg_dir)
    output_path = store.output_path(job_id)
    shutil.copy2(exported, output_path)

    mode_label = "参照页还原" if is_replica else render_mode
    model_label = vision_model() if is_replica else executor_model()
    store.update(
        job_id,
        status=JobStatus.succeeded,
        progress=JobProgress(step="done", percent=100, message="生成完成"),
        output_file=str(output_path),
        slide_count=slide_total,
        log=f"完成：{output_path.name}（{slide_total} 页 · {mode_label} · {model_label}）",
    )
