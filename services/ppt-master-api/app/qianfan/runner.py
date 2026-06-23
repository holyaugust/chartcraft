from __future__ import annotations

from pathlib import Path

from app.models import JobProgress, JobStatus
from app.qianfan.client import QianfanPptError, download_pptx, stream_generate_outline, stream_generate_ppt
from app.store import store
from app.worker.source_convert import read_uploaded_source


def _build_query(prompt: str, source_path: Path) -> str:
    try:
        text, _ = read_uploaded_source(source_path)
    except Exception:  # noqa: BLE001
        text = ""
    prompt = prompt.strip() or "请根据材料生成结构清晰的汇报 PPT"
    excerpt = text.strip()[:12000]
    if excerpt:
        return f"{prompt}\n\n【源材料】\n{excerpt}"
    return prompt


def run_qianfan_job(job_id: str) -> None:
    record = store.get(job_id)
    if not record:
        return
    if record.engine != "qianfan-ppt":
        raise QianfanPptError(f"任务引擎不匹配：{record.engine}")

    store.update(
        job_id,
        status=JobStatus.running,
        progress=JobProgress(step="prepare", percent=5, message="准备千帆 PPT 任务…"),
        log="千帆智能 PPT 任务开始",
    )

    source_path = store.job_dir(job_id) / record.source_name
    if not source_path.exists():
        raise FileNotFoundError(f"源文件不存在：{source_path.name}")

    if record.tpl_id is None or record.style_id is None:
        raise QianfanPptError("未选择千帆模板（tpl_id / style_id）")

    query = _build_query(record.prompt, source_path)
    resource_url = record.resource_url.strip()

    store.update(
        job_id,
        progress=JobProgress(step="outline", percent=18, message="千帆正在生成大纲…"),
        log="调用 generate_outline",
    )

    outline_body: dict[str, object] = {
        "query": query,
        "page_range": record.page_range or "1-10",
        "layout": record.layout or "2",
        "language_option": "default",
        "gen_mode": record.gen_mode or 1,
    }
    if resource_url:
        outline_body["resource_url"] = resource_url

    outline_result = stream_generate_outline(outline_body)
    outline_text = str(outline_result["outline"]).strip()
    title = str(outline_result.get("title") or Path(record.source_name).stem).strip()
    chat_id = int(outline_result["chat_id"])
    query_id = int(outline_result["query_id"])

    store.update(
        job_id,
        progress=JobProgress(step="outline_done", percent=42, message="大纲已完成，开始排版生成 PPT…"),
        log=f"大纲完成 · chat_id={chat_id} · query_id={query_id}",
    )

    generate_body: dict[str, object] = {
        "query_id": query_id,
        "chat_id": chat_id,
        "outline": outline_text,
        "query": query,
        "title": title,
        "style_id": record.style_id,
        "tpl_id": record.tpl_id,
        "gen_mode": record.gen_mode or 1,
        "ai_info": False,
    }
    if resource_url:
        generate_body["resource_url"] = resource_url

    store.update(
        job_id,
        progress=JobProgress(step="render", percent=55, message="千帆正在排版并导出 PPT…"),
        log="调用 generate_ppt_by_outline",
    )

    ppt_result = stream_generate_ppt(generate_body)
    pptx_url = str(ppt_result["pptx_url"])
    page_count = int(ppt_result.get("page_count") or 0)

    store.update(
        job_id,
        progress=JobProgress(step="download", percent=88, message="正在下载 PPT 文件…"),
        log="下载 pptx",
    )

    output_path = store.output_path(job_id)
    download_pptx(pptx_url, str(output_path))

    store.update(
        job_id,
        status=JobStatus.succeeded,
        progress=JobProgress(step="done", percent=100, message="千帆 PPT 生成完成"),
        output_file=str(output_path),
        slide_count=page_count or None,
        log=f"完成：{output_path.name}",
    )
