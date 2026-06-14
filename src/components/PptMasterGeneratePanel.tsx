import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, Download, FileText, Loader2, Sparkles, Trash2 } from 'lucide-react'

import type { PptMasterHealth, PptMasterJobRecord, PptMasterStyle } from '../types/pptMaster'
import { PPT_MASTER_STYLE_LABELS } from '../types/pptMaster'
import type { ImportedPptx } from '../utils/pptxImport'
import { importPptxFile } from '../utils/pptxImport'
import {
  createPptMasterJob,
  downloadPptMasterJob,
  fetchPptMasterHealth,
  pollPptMasterJob,
} from '../utils/pptMasterApi'
import { saveFile } from '../utils/saveFile'

const DEFAULT_PROMPT = '请根据上传材料生成结构清晰、适合正式汇报的可编辑 PPT，突出结论与关键数据。'

interface PptMasterGeneratePanelProps {
  busy: boolean
  onBusyChange: (busy: boolean) => void
  onStatus: (message: string, isError?: boolean) => void
  onPptxReady: (imported: ImportedPptx) => void
}

export default function PptMasterGeneratePanel({
  busy,
  onBusyChange,
  onStatus,
  onPptxReady,
}: PptMasterGeneratePanelProps) {
  const [health, setHealth] = useState<PptMasterHealth | null>(null)
  const [healthError, setHealthError] = useState('')
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [style, setStyle] = useState<PptMasterStyle>('business')
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [job, setJob] = useState<PptMasterJobRecord | null>(null)
  const [downloadName, setDownloadName] = useState('')
  const stopPollRef = useRef<(() => void) | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const buildDownloadName = useCallback((record: PptMasterJobRecord) => {
    const base = sourceFile?.name.replace(/\.[^.]+$/, '') || '智能设计稿'
    return `${base}-设计稿-${record.job_id.slice(0, 8)}.pptx`
  }, [sourceFile])

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

  const finishJob = useCallback(
    async (record: PptMasterJobRecord) => {
      if (record.status !== 'succeeded') return
      onStatus('正在下载并解析 PPT…')
      const blob = await downloadPptMasterJob(record.job_id)
      const file = new File([blob], `ppt-master-${record.job_id.slice(0, 8)}.pptx`, {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      })
      const imported = await importPptxFile(file)
      setDownloadName(buildDownloadName(record))
      onPptxReady(imported)
      onStatus(`智能设计稿已就绪：共 ${imported.slideCount} 页 · 可点击下方下载，或进入「全文美化」换主题`)
    },
    [buildDownloadName, onPptxReady, onStatus],
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
    onStatus('已提交智能设计稿任务…')
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

  return (
    <div className="ppt-beautify-layout ppt-beautify-outline-layout">
      <aside className="ppt-beautify-sidebar">
        <section className="ppt-beautify-block">
          <h3>Sidecar 状态</h3>
          {healthError ? (
            <p className="ppt-beautify-sidecar-warn">
              <AlertCircle size={14} />
              {healthError}
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => void refreshHealth()}>
                重试
              </button>
            </p>
          ) : health ? (
            <ul className="ppt-beautify-sidecar-status">
              <li className={health.ppt_master_ready ? 'ok' : 'bad'}>
                PPT Master 脚本：{health.ppt_master_ready ? '就绪' : '未安装'}
              </li>
              <li className={health.llm_configured ? 'ok' : 'bad'}>
                LLM：{health.llm_configured ? '已配置' : '未配置 Key'}
              </li>
              <li className="ok">
                渲染：{health.render_mode === 'ai_svg' ? 'AI 逐页 SVG（高视觉）' : '模板（快速）'}
              </li>
              <li className="ok">
                规划模型：{health.plan_model} · 视觉模型：{health.visual_model}
              </li>
            </ul>
          ) : (
            <p className="ppt-beautify-full-meta">检测 Sidecar…</p>
          )}
          <p className="ppt-beautify-full-meta">
            本地启动：<code>cd services/ppt-master-api &amp;&amp; docker compose up</code>
          </p>
        </section>

        <section className="ppt-beautify-block">
          <h3>上传材料</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,.markdown"
            hidden
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setSourceFile(file)
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
                {sourceFile.name}
                <button
                  type="button"
                  className="ppt-beautify-doc-remove"
                  aria-label="移除文件"
                  disabled={busy}
                  onClick={(event) => {
                    event.stopPropagation()
                    setSourceFile(null)
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
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm btn-primary ppt-beautify-generate-btn"
            disabled={busy || !sourceFile || !sidecarReady}
            onClick={() => void handleGenerate()}
          >
            {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
            生成智能设计稿（可编辑 PPT）
          </button>
        </section>
      </aside>

      <div className="ppt-beautify-outline-main">
        <div className="ppt-beautify-outline-toolbar">
          <h4>智能设计稿 · PPT Master Sidecar</h4>
        </div>

        {!job ? (
          <div className="ppt-beautify-phase-panel">
            <p>基于 <a href="https://github.com/hugohe3/ppt-master" target="_blank" rel="noreferrer">PPT Master</a> 流水线：</p>
            <ol>
              <li>解析 PDF / Word 等材料</li>
              <li>LLM 规划页型与要点</li>
              <li>AI 逐页绘制 SVG（接近 PPT Master 官方视觉）</li>
              <li>DrawingML 导出可编辑 .pptx</li>
            </ol>
            <p className="ppt-beautify-compare-hint">
              AI 逐页渲染约 5–15 分钟（视页数与模型速度）。追求最佳视觉效果时，Sidecar 建议配置 Claude Sonnet / Opus 作为视觉模型。
              生成完成后可进入「全文美化」套用 ChartCraft 企业主题；也可直接下载使用。
            </p>
          </div>
        ) : (
          <div className="ppt-beautify-master-progress">
            <div className="ppt-beautify-master-progress-bar">
              <div style={{ width: `${job.progress.percent}%` }} />
            </div>
            <p>
              <strong>{job.progress.percent}%</strong> · {job.progress.message}
            </p>
            <p className="ppt-beautify-full-meta">状态：{job.status}</p>
            {job.slide_count ? <p className="ppt-beautify-full-meta">页数：{job.slide_count}</p> : null}
            {job.error ? <p className="ppt-beautify-sidecar-warn">{job.error}</p> : null}
            {job.logs.length > 0 ? (
              <pre className="ppt-beautify-master-log">{job.logs.slice(-6).join('\n')}</pre>
            ) : null}
            {job.status === 'succeeded' ? (
              <button
                type="button"
                className="btn btn-sm btn-primary ppt-beautify-master-download-btn"
                disabled={busy}
                onClick={() => void handleDownload()}
              >
                <Download size={14} />
                下载 PPT（.pptx）
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
