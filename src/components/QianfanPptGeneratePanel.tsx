import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Download, FileText, Loader2, Sparkles, Trash2, ZoomIn } from 'lucide-react'

import {
  QIANFAN_GEN_MODE_OPTIONS,
  QIANFAN_LAYOUT_OPTIONS,
  QIANFAN_PAGE_RANGE_OPTIONS,
  qianfanThemeKey,
  qianfanThemeLabel,
  type QianfanGenMode,
  type QianfanLayoutMode,
  type QianfanPageRange,
  type QianfanPptJobRecord,
  type QianfanPptTheme,
} from '../types/qianfanPpt'
import {
  createQianfanPptJob,
  downloadQianfanPptJob,
  fetchQianfanPptHealth,
  fetchQianfanPptThemes,
  pollQianfanPptJob,
} from '../utils/qianfanPptApi'
import { DEFAULT_PROJECT_PROMPT, PPT_SOURCE_ACCEPT, readPptSourceDocument, type PptSourceDocument } from '../utils/pptSourceDocument'
import { saveFile } from '../utils/saveFile'
import QianfanThemeCoverModal from './QianfanThemeCoverModal'

interface QianfanPptGeneratePanelProps {
  busy: boolean
  onBusyChange: (busy: boolean) => void
  onStatus: (message: string, isError?: boolean) => void
  onComplete?: (slideCount?: number) => void
  initialPrompt?: string
  sharedMaterial?: PptSourceDocument | null
  onSharedMaterialChange?: (doc: PptSourceDocument | null) => void
}

export default function QianfanPptGeneratePanel({
  busy,
  onBusyChange,
  onStatus,
  onComplete,
  initialPrompt,
  sharedMaterial,
  onSharedMaterialChange,
}: QianfanPptGeneratePanelProps) {
  const [healthOk, setHealthOk] = useState(false)
  const [healthError, setHealthError] = useState('')
  const [themes, setThemes] = useState<QianfanPptTheme[]>([])
  const [themesError, setThemesError] = useState('')
  const [themesLoading, setThemesLoading] = useState(true)
  const [selectedThemeKey, setSelectedThemeKey] = useState('')
  const [prompt, setPrompt] = useState(initialPrompt ?? DEFAULT_PROJECT_PROMPT)
  const [pageRange, setPageRange] = useState<QianfanPageRange>('1-10')
  const [layout, setLayout] = useState<QianfanLayoutMode>('2')
  const [genMode, setGenMode] = useState<QianfanGenMode>(1)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [job, setJob] = useState<QianfanPptJobRecord | null>(null)
  const [downloadName, setDownloadName] = useState('')
  const [zoomTheme, setZoomTheme] = useState<QianfanPptTheme | null>(null)
  const stopPollRef = useRef<(() => void) | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedTheme = useMemo(
    () => themes.find((item) => qianfanThemeKey(item) === selectedThemeKey) ?? null,
    [selectedThemeKey, themes],
  )

  const buildDownloadName = useCallback(
    (record: QianfanPptJobRecord) => {
      const base = sourceFile?.name.replace(/\.[^.]+$/, '') || '千帆PPT'
      return `${base}-千帆-${record.job_id.slice(0, 8)}.pptx`
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
    setThemesLoading(true)
    try {
      const health = await fetchQianfanPptHealth()
      setHealthOk(Boolean(health.api_configured))
      if (!health.api_configured) {
        setHealthError('Sidecar 未配置 QIANFAN_API_KEY')
        setThemesLoading(false)
      }
    } catch (err) {
      setHealthOk(false)
      setThemesLoading(false)
      setThemesError('')
      setHealthError(
        err instanceof Error
          ? err.message
          : '千帆服务不可用（请确认 Sidecar 已重启且版本 ≥ 0.3.0）',
      )
    }
  }, [])

  const loadThemes = useCallback(async () => {
    setThemesLoading(true)
    setThemesError('')
    try {
      const list = await fetchQianfanPptThemes()
      setThemes(list)
      if (list.length > 0) {
        setSelectedThemeKey((prev) => prev || qianfanThemeKey(list[0]))
      }
    } catch (err) {
      setThemes([])
      setThemesError(err instanceof Error ? err.message : '模板加载失败')
    } finally {
      setThemesLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshHealth()
  }, [refreshHealth])

  useEffect(() => {
    if (healthOk) void loadThemes()
  }, [healthOk, loadThemes])

  useEffect(() => {
    if (initialPrompt?.trim()) setPrompt(initialPrompt)
  }, [initialPrompt])

  useEffect(() => {
    if (sharedMaterial && !sourceFile) {
      setSourceFile(sharedMaterial.file)
      setSourceName(sharedMaterial.name)
    }
  }, [sharedMaterial, sourceFile])

  const handleUpload = useCallback(
    async (file: File) => {
      onBusyChange(true)
      try {
        const doc = await readPptSourceDocument(file)
        setSourceFile(doc.file)
        setSourceName(doc.name)
        onSharedMaterialChange?.(doc)
        onStatus(`已上传「${doc.name}」`)
      } catch (err) {
        setSourceFile(null)
        setSourceName('')
        onSharedMaterialChange?.(null)
        onStatus(err instanceof Error ? err.message : '文档读取失败', true)
      } finally {
        onBusyChange(false)
      }
    },
    [onBusyChange, onSharedMaterialChange, onStatus],
  )

  const finishJob = useCallback(
    (record: QianfanPptJobRecord) => {
      setDownloadName(buildDownloadName(record))
      onComplete?.(record.slide_count ?? undefined)
      const pages = record.slide_count ? `${record.slide_count} 页` : '已完成'
      onStatus(`千帆 PPT 已生成（${pages}）· 可直接下载`)
    },
    [buildDownloadName, onComplete, onStatus],
  )

  const handleDownload = useCallback(async () => {
    if (!job || job.status !== 'succeeded') return
    onBusyChange(true)
    try {
      const blob = await downloadQianfanPptJob(job.job_id)
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
      onStatus('请先上传源文件（PDF / Word / 文本等）', true)
      return
    }
    if (!prompt.trim()) {
      onStatus('请填写生成要求', true)
      return
    }
    if (!selectedTheme) {
      onStatus('请选择千帆 PPT 模板', true)
      return
    }
    if (!healthOk) {
      onStatus('千帆 API 未就绪，请配置 QIANFAN_API_KEY', true)
      return
    }

    stopPollRef.current?.()
    onBusyChange(true)
    onStatus('已提交千帆 PPT 任务…')
    setJob(null)
    try {
      const created = await createQianfanPptJob({
        file: sourceFile,
        prompt: prompt.trim(),
        tpl_id: selectedTheme.tpl_id,
        style_id: selectedTheme.style_id,
        page_range: pageRange,
        layout,
        gen_mode: genMode,
      })
      stopPollRef.current = pollQianfanPptJob(created.job_id, (record) => {
        setJob(record)
        onStatus(record.progress.message)
        if (record.status === 'succeeded') {
          finishJob(record)
          onBusyChange(false)
        } else if (record.status === 'failed') {
          onStatus(record.error || '生成失败', true)
          onBusyChange(false)
        }
      })
    } catch (err) {
      onStatus(err instanceof Error ? err.message : '任务提交失败', true)
      onBusyChange(false)
    }
  }, [
    finishJob,
    genMode,
    healthOk,
    layout,
    onBusyChange,
    onStatus,
    pageRange,
    prompt,
    selectedTheme,
    sourceFile,
  ])

  const ready = healthOk && themes.length > 0 && !themesLoading

  return (
    <div className="ppt-beautify-layout ppt-beautify-outline-layout ppt-beautify-ai-layout ppt-beautify-qianfan-layout">
      <aside className="ppt-beautify-sidebar">
        {!ready && !themesLoading ? (
          <section className="ppt-beautify-block ppt-beautify-sidecar-alert">
            <p className="ppt-beautify-sidecar-warn">
              <AlertCircle size={14} />
              {healthError || themesError || '千帆 PPT 服务暂不可用'}
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => void refreshHealth()}>
                重试
              </button>
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
          <p className="ppt-beautify-qianfan-hint">材料会在本地解析后随 query 提交；严格依从模式建议配置公网文档 URL。</p>
        </section>

        <section className="ppt-beautify-block">
          <h3>页数与模式</h3>
          <div className="ppt-beautify-qianfan-options">
            <label>
              页数
              <select value={pageRange} disabled={busy} onChange={(e) => setPageRange(e.target.value as QianfanPageRange)}>
                {QIANFAN_PAGE_RANGE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              版式
              <select value={layout} disabled={busy} onChange={(e) => setLayout(e.target.value as QianfanLayoutMode)}>
                {QIANFAN_LAYOUT_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              生成模式
              <select
                value={genMode}
                disabled={busy}
                onChange={(e) => setGenMode(Number(e.target.value) as QianfanGenMode)}
              >
                {QIANFAN_GEN_MODE_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="ppt-beautify-block ppt-beautify-block-primary">
          <h3>生成要求</h3>
          <textarea
            className="ppt-beautify-outline-prompt"
            value={prompt}
            rows={4}
            disabled={busy}
            placeholder="说明汇报对象、重点章节、语气风格等"
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm btn-primary ppt-beautify-generate-btn"
            disabled={busy || !sourceFile || !ready}
            onClick={() => void handleGenerate()}
          >
            {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            开始千帆一键生成
          </button>
        </section>
      </aside>

      <div className="ppt-beautify-outline-main ppt-beautify-ai-main">
        {!job ? (
          <div className="ppt-beautify-qianfan-themes-panel">
            <div className="ppt-beautify-qianfan-themes-head">
              <h3>千帆文库模板</h3>
              <p>大纲、排版与导出均由百度智能 PPT API 完成 · 点击放大镜可放大预览封面</p>
            </div>
            {themesLoading ? (
              <p className="ppt-beautify-qianfan-loading">
                <Loader2 size={18} className="spin" /> 正在加载模板…
              </p>
            ) : themesError ? (
              <p className="ppt-beautify-sidecar-warn">{themesError}</p>
            ) : (
              <div className="ppt-beautify-qianfan-theme-grid">
                {themes.map((theme) => {
                  const key = qianfanThemeKey(theme)
                  const active = key === selectedThemeKey
                  return (
                    <button
                      key={key}
                      type="button"
                      className={`ppt-beautify-qianfan-theme-card${active ? ' active' : ''}`}
                      disabled={busy}
                      onClick={() => setSelectedThemeKey(key)}
                    >
                      <div className="ppt-beautify-qianfan-theme-thumb">
                        {theme.main_img_url ? (
                          <img src={theme.main_img_url} alt="" loading="lazy" />
                        ) : (
                          <span className="ppt-beautify-qianfan-theme-fallback" aria-hidden="true" />
                        )}
                        {theme.main_img_url ? (
                          <button
                            type="button"
                            className="ppt-beautify-qianfan-theme-zoom"
                            aria-label={`放大预览：${qianfanThemeLabel(theme)}`}
                            disabled={busy}
                            onClick={(event) => {
                              event.stopPropagation()
                              setZoomTheme(theme)
                            }}
                          >
                            <ZoomIn size={14} />
                          </button>
                        ) : null}
                      </div>
                      <strong>{qianfanThemeLabel(theme)}</strong>
                      {theme.color_list[0] ? (
                        <span className="ppt-beautify-qianfan-theme-color" style={{ background: theme.color_list[0] }} />
                      ) : null}
                    </button>
                  )
                })}
              </div>
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
                    ? '千帆 PPT 已生成'
                    : job.status === 'failed'
                      ? '生成未完成'
                      : '千帆正在生成 PPT…'}
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

      <QianfanThemeCoverModal theme={zoomTheme} onClose={() => setZoomTheme(null)} />
    </div>
  )
}
