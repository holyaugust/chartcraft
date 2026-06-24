from __future__ import annotations

import json
from pathlib import Path
from typing import Callable

from app.config import settings
from app.models import JobProgress, JobRecord, JobStatus, utc_now


class JobStore:
    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._jobs: dict[str, JobRecord] = {}

    def job_dir(self, job_id: str) -> Path:
        return self._job_dir(job_id)

    def _job_dir(self, job_id: str) -> Path:
        return self.data_dir / "jobs" / job_id

    def _meta_path(self, job_id: str) -> Path:
        return self._job_dir(job_id) / "meta.json"

    def create(
        self,
        *,
        prompt: str,
        style: str,
        source_name: str,
        source_kind: str,
        style_note: str = "",
        primary_color: str = "",
        engine: str = "ppt-master",
        tpl_id: int | None = None,
        style_id: int | None = None,
        page_range: str = "1-10",
        layout: str = "2",
        gen_mode: int = 1,
        resource_url: str = "",
        reference_image_url: str = "",
        generation_mode: str = "creative",
    ) -> JobRecord:
        import uuid

        job_id = uuid.uuid4().hex
        now = utc_now()
        record = JobRecord(
            job_id=job_id,
            status=JobStatus.queued,
            created_at=now,
            updated_at=now,
            prompt=prompt,
            style=style,
            style_note=style_note,
            primary_color=primary_color,
            source_name=source_name,
            source_kind=source_kind,
            engine=engine,
            tpl_id=tpl_id,
            style_id=style_id,
            page_range=page_range,
            layout=layout,
            gen_mode=gen_mode,
            resource_url=resource_url,
            reference_image_url=reference_image_url,
            generation_mode=generation_mode,
        )
        job_dir = self._job_dir(job_id)
        job_dir.mkdir(parents=True, exist_ok=True)
        self._persist(record)
        self._jobs[job_id] = record
        return record

    def get(self, job_id: str) -> JobRecord | None:
        cached = self._jobs.get(job_id)
        if cached:
            return cached
        meta = self._meta_path(job_id)
        if not meta.exists():
            return None
        record = JobRecord.model_validate_json(meta.read_text(encoding="utf-8"))
        self._jobs[job_id] = record
        return record

    def update(
        self,
        job_id: str,
        *,
        status: JobStatus | None = None,
        progress: JobProgress | None = None,
        error: str | None = None,
        output_file: str | None = None,
        slide_count: int | None = None,
        log: str | None = None,
    ) -> JobRecord:
        record = self.get(job_id)
        if not record:
            raise KeyError(job_id)
        if status is not None:
            record.status = status
        if progress is not None:
            record.progress = progress
        if error is not None:
            record.error = error
        if output_file is not None:
            record.output_file = output_file
        if slide_count is not None:
            record.slide_count = slide_count
        if log:
            record.logs.append(log)
            if len(record.logs) > 200:
                record.logs = record.logs[-200:]
        record.updated_at = utc_now()
        self._persist(record)
        self._jobs[job_id] = record
        return record

    def workspace(self, job_id: str) -> Path:
        path = self._job_dir(job_id) / "workspace"
        path.mkdir(parents=True, exist_ok=True)
        return path

    def output_path(self, job_id: str) -> Path:
        return self._job_dir(job_id) / "output.pptx"

    def _persist(self, record: JobRecord) -> None:
        meta = self._meta_path(record.job_id)
        meta.parent.mkdir(parents=True, exist_ok=True)
        meta.write_text(record.model_dump_json(indent=2), encoding="utf-8")


store = JobStore(Path(settings.ppt_master_data_dir))

_runner: Callable[[str], None] | None = None
_qianfan_runner: Callable[[str], None] | None = None


def set_runner(fn: Callable[[str], None]) -> None:
    global _runner
    _runner = fn


def set_qianfan_runner(fn: Callable[[str], None]) -> None:
    global _qianfan_runner
    _qianfan_runner = fn


def enqueue(job_id: str) -> None:
    record = store.get(job_id)
    if record and record.engine == "qianfan-ppt":
        if _qianfan_runner is None:
            raise RuntimeError("Qianfan worker runner not registered")
        _qianfan_runner(job_id)
        return
    if _runner is None:
        raise RuntimeError("Worker runner not registered")
    _runner(job_id)
