import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Download, FileText, Loader2, Sparkles, Trash2 } from 'lucide-react'

import type { PptMasterHealth, PptMasterJobRecord, PptMasterStyle } from '../types/pptMaster'
import { PPT_MASTER_STYLE_LABELS } from '../types/pptMaster'
import {
  createPptMasterJob,
  downloadPptMasterJob,
  fetchPptMasterHealth,
  pollPptMasterJob,
} from '../utils/pptMasterApi'
import { DEFAULT_PROJECT_PROMPT, PPT_SOURCE_ACCEPT, readPptSourceDocument } from '../utils/pptSourceDocument'
import { saveFile } from '../utils/saveFile'

interface PptMasterGeneratePanelProps {
  busy: boolean
  onBusyChange: (busy: boolean) => void
  onStatus: (message: string, isError?: boolean) => void
  onDesignDraftComplete?: (slideCount?: number) => void
  initialPrompt?: string
}

export default function PptMasterGeneratePanel({
  busy,
  onBusyChange,
  onStatus,
  onDesignDraftComplete,
  initialPrompt,
}: PptMasterGeneratePanelProps) {
  const [health, setHealth] = useState<PptMasterHealth | null>(null)
  const [healthError, setHealthError] = useState('')
  const [prompt, setPrompt] = useState(initialPrompt ?? DEFAULT_PROJECT_PROMPT)
  const [style, setStyle] = useState<PptMasterStyle>('business')
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [job, setJob] = useState<PptMasterJobRecord | null>(null)
  const [downloadName, setDownloadName] = useState('')
  const stopPollRef = useRef<(() => void) | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const buildDownloadName = useCallback(
    (record: PptMasterJobRecord) => {
      const base = sourceFile?.name.replace(/\.[^.]+$/, '') || 'AI设计稿'
      return `${base}-设计稿-${record.job_id.slice(0, 8)}.pptx`
    },
    [sourceFile],
  )

  useEffect(() => {
    return () => {
      stopPollRef.current?.()
    }
  }, [])

  const refreshHealth = useCallback(async () => {
    setHealthError('')
    try {
      const next = await fetchPptMasterHealth()
      setHealth(next)
    } catch (err) {
      setHealth(null)
      setHealthError(err instanceof Error ? err.message : 'Sidecar 不可用')
    }
  }, [])

  useEffect(() => {
    void refreshHealth()
  }, [refreshHealth])

  useEffect(() => {
    if (initialPrompt?.trim()) setPrompt(initialPrompt)
  }, [initialPrompt])

  const handleUpload = useCallback(
    async (file: File) => {
      onBusyChange(true)
      try {
        const doc = await readPptSourceDocument(file)
        setSourceFile(doc.file)
        setSourceName(doc.name)
        onStatus(`已上传「${doc.name}」`)
      } catch (err) {
        setSourceFile(null)
        setSourceName('')
        onStatus(err instanceof Error ? err.message : '文档读取失败', true)
      } finally {
        onBusyChange(false)
      }
    },
    [onBusyChange, onStatus],
  )

  const finishJob = useCallback(
    async (record: PptMasterJobRecord) => {
      if (record.status !== 'succeeded') return
      setDownloadName(buildDownloadName(record))
      onDesignDraftComplete?.(record.slide_count ?? undefined)
      const pages = record.slide_count ? `${record.slide_count} 页` : '已完成'
      onStatus(`AI 一键设计已完成（${pages}）· 可直接下载使用`)
    },
    [buildDownloadName, onDesignDraftComplete, onStatus],
  )

  const handleDownload = useCallback(async () => {
    if (!job || job.status !== 'succeeded') return
    onBusyChange(true)
    try {
      const blob = await downloadPptMasterJob(job.job_id)
      const name = downloadName || buildDownloadName(job)
      const saved = await saveFile(blob, {
        suggestedName: name,
        description: 'PowerPoint 演示文稿',
        accept: {
          'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
        },
      })
      onStatus(saved ? `已保存：${name}` : '已取消下载')
    } catch (err) {
      onStatus(err instanceof Error ? err.message : '下载失败', true)
    } finally {
      onBusyChange(false)
    }
  }, [buildDownloadName, downloadName, job, onBusyChange, onStatus])

  const handleGenerate = useCallback(async () => {
    if (!sourceFile) {
      onStatus('请先上传源文件（PDF / Word / 文本）', true)
      return
    }
    if (!prompt.trim()) {
      onStatus('请填写生成要求', true)
      return
    }
    if (!health?.ppt_master_ready) {
      onStatus('PPT Master Sidecar 未就绪，请先启动 docker compose 或本地 API', true)
      return
    }
    if (!health.llm_configured) {
      onStatus('Sidecar 未配置 LLM API Key（PPT_MASTER_LLM_API_KEY）', true)
      return
    }

    stopPollRef.current?.()
    onBusyChange(true)
    onStatus('已提交 AI 一键设计任务…')
    setJob(null)
    try {
      const created = await createPptMasterJob({
        file: sourceFile,
        prompt: prompt.trim(),
        style,
      })
      stopPollRef.current = pollPptMasterJob(created.job_id, (record) => {
        setJob(record)
        onStatus(record.progress.message)
        if (record.status === 'succeeded') {
          void finishJob(record).catch((err) => {
            onStatus(err instanceof Error ? err.message : 'PPT 解析失败', true)
          }).finally(() => {
            onBusyChange(false)
          })
        } else if (record.status === 'failed') {
          onStatus(record.error || '生成失败', true)
          onBusyChange(false)
        }
      })
    } catch (err) {
      onStatus(err instanceof Error ? err.message : '任务提交失败', true)
      onBusyChange(false)
    }
  }, [finishJob, health, onBusyChange, onStatus, prompt, sourceFile, style])

  const sidecarReady = Boolean(health?.ppt_master_ready && health.llm_configured)
  const sidecarChecking = !health && !healthError

  return (
    <div className="ppt-beautify-layout ppt-beautify-outline-layout">
      <aside className="ppt-beautify-sidebar">
        {!sidecarReady && !sidecarChecking ? (
          <section className="ppt-beautify-block ppt-beautify-sidecar-alert">
            <p className="ppt-beautify-sidecar-warn">
              <AlertCircle size={14} />
              {healthError || '生成服务暂不可用，请稍后重试'}
              {healthError ? (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => void refreshHealth()}>
                  重试
                </button>
              ) : null}
            </p>
          </section>
        ) : null}

        <section className="ppt-beautify-block">
          <h3>上传材料</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept={PPT_SOURCE_ACCEPT}
            hidden
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleUpload(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="doc-write-upload-zone ppt-beautify-upload"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {sourceFile ? (
              <span className="ppt-beautify-doc-uploaded">
                <FileText size={16} />
                {sourceName || sourceFile.name}
                <button
                  type="button"
                  className="ppt-beautify-doc-remove"
                  aria-label="移除文件"
                  disabled={busy}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSourceFile(null)
                    setSourceName('')
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            ) : (
              <>
                <FileText size={18} />
                <span>PDF / Word / Markdown / 文本</span>
              </>
            )}
          </button>
        </section>

        <section className="ppt-beautify-block">
          <h3>视觉风格</h3>
          <div className="ppt-beautify-outline-templates">
            {(Object.keys(PPT_MASTER_STYLE_LABELS) as PptMasterStyle[]).map((item) => (
              <button
                key={item}
                type="button"
                className={`ppt-beautify-outline-template${style === item ? ' active' : ''}`}
                disabled={busy}
                onClick={() => setStyle(item)}
              >
                <strong>{PPT_MASTER_STYLE_LABELS[item]}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="ppt-beautify-block">
          <h3>生成要求</h3>
          <textarea
            className="ppt-beautify-outline-prompt"
            value={prompt}
            rows={4}
            disabled={busy}
            placeholder={DEFAULT_PROJECT_PROMPT}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm btn-primary ppt-beautify-generate-btn"
            disabled={busy || !sourceFile || !sidecarReady}
            onClick={() => void handleGenerate()}
          >
            {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            开始 AI 一键设计
          </button>
        </section>
      </aside>

      <div className="ppt-beautify-outline-main ppt-beautify-ai-main">
        {!job ? (
          <div className="ppt-beautify-ai-idle">
            {!sourceFile ? (
              <>
                <div className="ppt-beautify-ai-idle-icon" aria-hidden="true">
                  <Sparkles size={36} />
                </div>
                <h3 className="ppt-beautify-ai-idle-title">上传材料，AI 帮你完成整套 PPT</h3>
                <p className="ppt-beautify-ai-idle-desc">
                  在左侧上传 PDF / Word / 文本，选择视觉风格并填写要求，即可开始生成。
                </p>
                <ul className="ppt-beautify-ai-idle-steps">
                  <li><span>1</span>上传材料</li>
                  <li><span>2</span>选风格 · 填要求</li>
                  <li><span>3</span>一键生成 · 下载</li>
                </ul>
                <p className="ppt-beautify-compare-hint">生成约 5–15 分钟，成稿为可编辑 .pptx</p>
              </>
            ) : (
              <>
                <div className="ppt-beautify-ai-ready-card">
                  <FileText size={28} />
                  <div>
                    <strong>{sourceName || sourceFile.name}</strong>
                    <p>风格：{PPT_MASTER_STYLE_LABELS[style]}</p>
                  </div>
                </div>
                <p className="ppt-beautify-ai-idle-desc">
                  材料已就绪，点击左侧「开始 AI 一键设计」即可成稿。
                </p>
                <button
                  type="button"
                  className="btn btn-primary ppt-beautify-ai-idle-cta"
                  disabled={busy || !sidecarReady}
                  onClick={() => void handleGenerate()}
                >
                  {busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                  开始 AI 一键设计
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="ppt-beautify-master-progress ppt-beautify-ai-progress">
            <div className="ppt-beautify-ai-progress-head">
              {job.status === 'succeeded' ? (
                <Sparkles size={28} />
              ) : (
                <Loader2 size={28} className="spin" />
              )}
              <div>
                <h3>
                  {job.status === 'succeeded'
                    ? 'PPT 已生成完成'
                    : job.status === 'failed'
                      ? '生成未完成'
                      : 'AI 正在设计你的 PPT…'}
                </h3>
                <p>{job.progress.message}</p>
              </div>
            </div>
            <div className="ppt-beautify-master-progress-bar">
              <div style={{ width: `${job.progress.percent}%` }} />
            </div>
            <p className="ppt-beautify-ai-progress-percent">
              <strong>{job.progress.percent}%</strong>
              {job.slide_count ? ` · 共 ${job.slide_count} 页` : null}
            </p>
            {job.error ? <p className="ppt-beautify-sidecar-warn">{job.error}</p> : null}
            {job.status === 'succeeded' ? (
              <div className="ppt-beautify-master-done">
                <button
                  type="button"
                  className="btn btn-primary ppt-beautify-master-download-btn"
                  disabled={busy}
                  onClick={() => void handleDownload()}
                >
                  <Download size={16} />
                  下载 PPT（.pptx）
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
