from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from typing import Annotated

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import settings
from app.models import (
    HealthResponse,
    JobCreateResponse,
    JobRecord,
    JobStatus,
    PptMasterStyle,
    QianfanHealthResponse,
    QianfanPptTheme,
    QianfanThemesResponse,
)
from app.qianfan.client import QianfanPptError, get_ppt_themes
from app.qianfan.runner import run_qianfan_job
from app.style_presets import STYLE_LABELS, valid_hex
from app.store import enqueue, set_qianfan_runner, set_runner, store
from app.worker.llm_client import visual_model
from app.worker.vision import vision_enabled, vision_model
from app.worker.reference_slides import ReferenceSlideError, save_reference_slides, write_stub_source
from app.worker.runner import run_job

app = FastAPI(title="ChartCraft PPT Master Sidecar", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_executor = ThreadPoolExecutor(max_workers=1)
_qianfan_executor = ThreadPoolExecutor(max_workers=1)
_executor_lock = threading.Lock()
_qianfan_lock = threading.Lock()


def _schedule_job(job_id: str) -> None:
    def _run() -> None:
        try:
            run_job(job_id)
        except Exception as exc:  # noqa: BLE001
            from app.models import JobProgress, JobStatus

            store.update(
                job_id,
                status=JobStatus.failed,
                error=str(exc),
                progress=JobProgress(step="failed", percent=100, message=str(exc)),
                log=f"ERROR: {exc}",
            )

    with _executor_lock:
        _executor.submit(_run)


def _schedule_qianfan_job(job_id: str) -> None:
    def _run() -> None:
        try:
            run_qianfan_job(job_id)
        except Exception as exc:  # noqa: BLE001
            from app.models import JobProgress, JobStatus

            store.update(
                job_id,
                status=JobStatus.failed,
                error=str(exc),
                progress=JobProgress(step="failed", percent=100, message=str(exc)),
                log=f"ERROR: {exc}",
            )

    with _qianfan_lock:
        _qianfan_executor.submit(_run)


set_runner(_schedule_job)
set_qianfan_runner(_schedule_qianfan_job)


@app.get("/")
def root() -> dict[str, object]:
    return {
        "service": "ChartCraft PPT Master Sidecar",
        "version": "0.3.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "styles": "/styles",
            "create_job": "POST /jobs",
            "job_status": "GET /jobs/{job_id}",
            "download": "GET /jobs/{job_id}/download",
            "qianfan_health": "/qianfan/health",
            "qianfan_themes": "GET /qianfan/themes",
            "qianfan_create_job": "POST /qianfan/jobs",
            "qianfan_job_status": "GET /qianfan/jobs/{job_id}",
            "qianfan_download": "GET /qianfan/jobs/{job_id}/download",
        },
        "note": "ChartCraft 前端通过 /api/ppt-master 代理访问",
    }


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    home = settings.ppt_master_home.strip()
    home_path = Path(home) if home else None
    scripts_ok = bool(
        home_path
        and (home_path / "skills" / "ppt-master" / "scripts" / "svg_to_pptx.py").exists()
    )
    llm_ok = bool(settings.ppt_master_llm_api_key.strip())
    qianfan_ok = bool(settings.qianfan_api_key.strip())
    return HealthResponse(
        ok=(scripts_ok and llm_ok) or qianfan_ok,
        ppt_master_home=home,
        ppt_master_ready=scripts_ok,
        llm_configured=llm_ok,
        render_mode=settings.ppt_master_render_mode,
        plan_model=settings.ppt_master_llm_model,
        visual_model=visual_model(),
        vision_enabled=vision_enabled(),
        vision_model=vision_model() if vision_enabled() else "",
        qianfan_configured=qianfan_ok,
    )


@app.get("/qianfan/health", response_model=QianfanHealthResponse)
def qianfan_health() -> QianfanHealthResponse:
    configured = bool(settings.qianfan_api_key.strip())
    return QianfanHealthResponse(ok=configured, api_configured=configured)


@app.get("/qianfan/themes", response_model=QianfanThemesResponse)
def qianfan_themes() -> QianfanThemesResponse:
    if not settings.qianfan_api_key.strip():
        raise HTTPException(status_code=503, detail="未配置 QIANFAN_API_KEY")
    try:
        raw = get_ppt_themes()
    except QianfanPptError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    themes: list[QianfanPptTheme] = []
    for item in raw:
        tpl_id = item.get("tpl_id")
        style_id = item.get("style_id")
        if tpl_id is None or style_id is None:
            continue
        names = item.get("style_name_list")
        styles = item.get("style_list")
        scenes = item.get("scene_list")
        colors = item.get("color_list")
        style_names = [str(n) for n in names] if isinstance(names, list) else []
        style_tags = [str(n) for n in styles] if isinstance(styles, list) else []
        scene_tags = [str(n) for n in scenes] if isinstance(scenes, list) else []
        themes.append(
            QianfanPptTheme(
                tpl_id=int(tpl_id),
                style_id=int(style_id),
                style_name_list=style_names,
                style_list=style_tags,
                scene_list=scene_tags,
                color_list=[str(c) for c in colors] if isinstance(colors, list) else [],
                main_img_url=str(item.get("main_img_url") or ""),
            )
        )
    return QianfanThemesResponse(themes=themes)


@app.get("/styles")
def list_styles() -> dict[str, str]:
    return STYLE_LABELS


@app.post("/jobs", response_model=JobCreateResponse)
async def create_job(
    background_tasks: BackgroundTasks,
    prompt: str = Form(default="请根据材料生成结构清晰的汇报 PPT"),
    style: PptMasterStyle = Form(default=PptMasterStyle.business),
    style_note: str = Form(default=""),
    primary_color: str = Form(default=""),
    reference_image_url: str = Form(default=""),
    generation_mode: str = Form(default="creative"),
    file: UploadFile | None = File(default=None),
    reference_images: Annotated[list[UploadFile] | None, File()] = None,
) -> JobCreateResponse:
    mode = (generation_mode or "creative").strip().lower()
    if mode not in {"creative", "replica"}:
        raise HTTPException(status_code=400, detail="generation_mode 无效")

    uploaded_refs = [item for item in (reference_images or []) if item.filename]
    if mode == "replica":
        if not vision_enabled():
            raise HTTPException(
                status_code=503,
                detail="参照页还原需要开启 PPT_MASTER_VISION_ENABLED 并配置 deepseek-v4-flash 等视觉模型",
            )
        if not uploaded_refs:
            raise HTTPException(status_code=400, detail="请上传至少一张 PPT 参照页图片（PNG/JPG/WebP）")

    if mode == "creative" and (not file or not file.filename):
        raise HTTPException(status_code=400, detail="请上传源文件")

    color = primary_color.strip()
    if color and not valid_hex(color):
        raise HTTPException(status_code=400, detail="主色格式无效，请使用 #RRGGBB")

    ref_payload: list[tuple[str, bytes]] = []
    for upload in uploaded_refs:
        ref_payload.append((Path(upload.filename).name, await upload.read()))

    source_name = "_reference_replica_stub.md"
    source_bytes: bytes | None = None
    if file and file.filename:
        source_name = Path(file.filename).name
        suffix = Path(source_name).suffix.lower()
        allowed = {".pdf", ".docx", ".md", ".markdown", ".txt"}
        if suffix not in allowed:
            raise HTTPException(status_code=400, detail=f"不支持的文件类型：{suffix}")
        source_bytes = await file.read()
    elif mode != "replica":
        raise HTTPException(status_code=400, detail="请上传源文件")

    record = store.create(
        prompt=prompt.strip() or "请根据材料生成结构清晰的汇报 PPT",
        style=style.value,
        style_note=style_note.strip(),
        primary_color=color,
        source_name=source_name,
        source_kind="file",
        engine="ppt-master",
        reference_image_url=reference_image_url.strip(),
        generation_mode=mode,
    )
    job_dir = store.job_dir(record.job_id)
    job_dir.mkdir(parents=True, exist_ok=True)

    try:
        if ref_payload:
            save_reference_slides(job_dir, ref_payload)
    except ReferenceSlideError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if source_bytes is not None:
        (job_dir / record.source_name).write_bytes(source_bytes)
    elif mode == "replica":
        write_stub_source(job_dir, len(ref_payload))

    background_tasks.add_task(enqueue, record.job_id)
    return JobCreateResponse(job_id=record.job_id, status=JobStatus.queued)


@app.post("/qianfan/jobs", response_model=JobCreateResponse)
async def create_qianfan_job(
    background_tasks: BackgroundTasks,
    prompt: str = Form(default="请根据材料生成结构清晰的汇报 PPT"),
    tpl_id: int = Form(...),
    style_id: int = Form(...),
    page_range: str = Form(default="1-10"),
    layout: str = Form(default="2"),
    gen_mode: int = Form(default=1),
    resource_url: str = Form(default=""),
    file: UploadFile = File(...),
) -> JobCreateResponse:
    if not settings.qianfan_api_key.strip():
        raise HTTPException(status_code=503, detail="未配置 QIANFAN_API_KEY")
    if not file.filename:
        raise HTTPException(status_code=400, detail="请上传源文件")
    suffix = Path(file.filename).suffix.lower()
    allowed = {".pdf", ".doc", ".docx", ".md", ".markdown", ".txt", ".ppt", ".pptx"}
    if suffix not in allowed:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型：{suffix}")
    if page_range not in {"1-10", "11-20", "21-30", "31-40", "40+"}:
        raise HTTPException(status_code=400, detail="page_range 无效")
    if layout not in {"1", "2"}:
        raise HTTPException(status_code=400, detail="layout 无效")
    if gen_mode not in {1, 2}:
        raise HTTPException(status_code=400, detail="gen_mode 无效")

    record = store.create(
        prompt=prompt.strip() or "请根据材料生成结构清晰的汇报 PPT",
        style="qianfan",
        source_name=Path(file.filename).name,
        source_kind="file",
        engine="qianfan-ppt",
        tpl_id=tpl_id,
        style_id=style_id,
        page_range=page_range,
        layout=layout,
        gen_mode=gen_mode,
        resource_url=resource_url.strip(),
    )
    dest = store.job_dir(record.job_id) / record.source_name
    dest.parent.mkdir(parents=True, exist_ok=True)
    content = await file.read()
    dest.write_bytes(content)

    background_tasks.add_task(enqueue, record.job_id)
    return JobCreateResponse(job_id=record.job_id, status=JobStatus.queued)


@app.get("/jobs/{job_id}", response_model=JobRecord)
def get_job(job_id: str) -> JobRecord:
    record = store.get(job_id)
    if not record:
        raise HTTPException(status_code=404, detail="任务不存在")
    return record


@app.get("/qianfan/jobs/{job_id}", response_model=JobRecord)
def get_qianfan_job(job_id: str) -> JobRecord:
    record = store.get(job_id)
    if not record:
        raise HTTPException(status_code=404, detail="任务不存在")
    if record.engine != "qianfan-ppt":
        raise HTTPException(status_code=404, detail="非千帆 PPT 任务")
    return record


@app.get("/jobs/{job_id}/download")
def download_job(job_id: str) -> FileResponse:
    record = store.get(job_id)
    if not record:
        raise HTTPException(status_code=404, detail="任务不存在")
    if record.status != JobStatus.succeeded or not record.output_file:
        raise HTTPException(status_code=409, detail="任务尚未完成")
    path = Path(record.output_file)
    if not path.exists():
        raise HTTPException(status_code=404, detail="输出文件不存在")
    prefix = "qianfan-ppt" if record.engine == "qianfan-ppt" else "ppt-master"
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=f"{prefix}-{job_id[:8]}.pptx",
    )


@app.get("/qianfan/jobs/{job_id}/download")
def download_qianfan_job(job_id: str) -> FileResponse:
    return download_job(job_id)
