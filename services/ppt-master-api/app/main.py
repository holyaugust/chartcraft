from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import settings
from app.models import HealthResponse, JobCreateResponse, JobRecord, JobStatus, PptMasterStyle, STYLE_LABELS
from app.store import enqueue, set_runner, store
from app.worker.llm_client import visual_model
from app.worker.runner import run_job

app = FastAPI(title="ChartCraft PPT Master Sidecar", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_executor = ThreadPoolExecutor(max_workers=1)
_executor_lock = threading.Lock()


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


set_runner(_schedule_job)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    home = settings.ppt_master_home.strip()
    home_path = Path(home) if home else None
    scripts_ok = bool(
        home_path
        and (home_path / "skills" / "ppt-master" / "scripts" / "svg_to_pptx.py").exists()
    )
    return HealthResponse(
        ok=scripts_ok and bool(settings.ppt_master_llm_api_key.strip()),
        ppt_master_home=home,
        ppt_master_ready=scripts_ok,
        llm_configured=bool(settings.ppt_master_llm_api_key.strip()),
        render_mode=settings.ppt_master_render_mode,
        plan_model=settings.ppt_master_llm_model,
        visual_model=visual_model(),
    )


@app.get("/styles")
def list_styles() -> dict[str, str]:
    return STYLE_LABELS


@app.post("/jobs", response_model=JobCreateResponse)
async def create_job(
    background_tasks: BackgroundTasks,
    prompt: str = Form(default="请根据材料生成结构清晰的汇报 PPT"),
    style: PptMasterStyle = Form(default=PptMasterStyle.business),
    file: UploadFile = File(...),
) -> JobCreateResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="请上传源文件")
    suffix = Path(file.filename).suffix.lower()
    allowed = {".pdf", ".docx", ".md", ".markdown", ".txt"}
    if suffix not in allowed:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型：{suffix}")

    record = store.create(
        prompt=prompt.strip() or "请根据材料生成结构清晰的汇报 PPT",
        style=style.value,
        source_name=Path(file.filename).name,
        source_kind="file",
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
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=f"ppt-master-{job_id[:8]}.pptx",
    )
