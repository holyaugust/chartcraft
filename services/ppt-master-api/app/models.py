from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class JobCreateResponse(BaseModel):
    job_id: str
    status: JobStatus


class JobProgress(BaseModel):
    step: str
    percent: int
    message: str


class JobRecord(BaseModel):
    job_id: str
    status: JobStatus
    created_at: str
    updated_at: str
    prompt: str = ""
    style: str = "business"
    style_note: str = ""
    primary_color: str = ""
    source_name: str = ""
    source_kind: str = "file"
    progress: JobProgress = Field(default_factory=lambda: JobProgress(step="queued", percent=0, message="排队中"))
    error: str | None = None
    output_file: str | None = None
    slide_count: int | None = None
    logs: list[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    ok: bool
    ppt_master_home: str
    ppt_master_ready: bool
    llm_configured: bool
    render_mode: str
    plan_model: str
    visual_model: str
    version: str = "0.2.0"


class PptMasterStyle(str, Enum):
    business = "business"
    tech = "tech"
    academic = "academic"
    editorial = "editorial"
    minimal = "minimal"
    dark = "dark"
    creative = "creative"
    warm = "warm"
    luxury = "luxury"
    gov = "gov"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()
