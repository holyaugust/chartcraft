import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  ImagePlus,
  Loader2,
  Lock,
  Sparkles,
  Trash2,
} from 'lucide-react'

import type { PptMasterHealth, PptMasterJobRecord, PptMasterStyle } from '../types/pptMaster'
import { PPT_MASTER_STYLE_LABELS, PPT_MASTER_STYLES } from '../types/pptMaster'
import {
  createPptMasterJob,
  downloadPptMasterJob,
  fetchPptMasterHealth,
  pollPptMasterJob,
} from '../utils/pptMasterApi'
import {
  DEFAULT_PROJECT_PROMPT,
  DEFAULT_REPLICA_PROMPT,
  PPT_SOURCE_ACCEPT,
  readPptSourceDocument,
  resolveReplicaPrompt,
  type PptSourceDocument,
} from '../utils/pptSourceDocument'
import { buildMasterProgressStory, friendlyProgressHeadline } from '../utils/pptMasterProgressStory'
import { saveFile } from '../utils/saveFile'
import { PptMasterFieldHintRow } from './PptMasterFieldGuide'
import { PPT_MASTER_PROMPT_GUIDE } from '../data/pptMasterWritingGuide'
import { PPT_MASTER_STYLE_PREVIEWS } from '../data/pptMasterStylePreview'
import PptMasterStyleGuidePanel from './PptMasterStyleGuidePanel'
import PptWizardStepper from './PptWizardStepper'

const CREATIVE_STEPS = ['上传材料', '选风格', '生成下载']
const REPLICA_STEPS = ['上传截图', '确认生成']

export type PptMasterPanelVariant = 'creative-wizard' | 'replica-wizard'

interface PptMasterGeneratePanelProps {
  busy: boolean
  onBusyChange: (busy: boolean) => void
  onStatus: (message: string, isError?: boolean) => void
  onDesignDraftComplete?: (slideCount?: number) => void
  initialPrompt?: string
  variant: PptMasterPanelVariant
  wizardStep: number
  onWizardStepChange: (step: number) => void
  onBackToLanding: () => void
  sharedMaterial: PptSourceDocument | null
  onSharedMaterialChange: (doc: PptSourceDocument | null) => void
}

export default function PptMasterGeneratePanel({
  busy,
  onBusyChange,
  onStatus,
  onDesignDraftComplete,
  initialPrompt,
  variant,
  wizardStep,
  onWizardStepChange,
  onBackToLanding,
  sharedMaterial,
  onSharedMaterialChange,
}: PptMasterGeneratePanelProps) {
  const isReplica = variant === 'replica-wizard'
  const steps = isReplica ? REPLICA_STEPS : CREATIVE_STEPS
  const maxStep = steps.length

  const [health, setHealth] = useState<PptMasterHealth | null>(null)
  const [healthError, setHealthError] = useState('')
  const [prompt, setPrompt] = useState(() =>
    isReplica ? DEFAULT_REPLICA_PROMPT : (initialPrompt ?? DEFAULT_PROJECT_PROMPT),
  )
  const [style, setStyle] = useState<PptMasterStyle>('business')
  const [referenceImageUrl, setReferenceImageUrl] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [referenceSlides, setReferenceSlides] = useState<File[]>([])
  const [referencePreviewUrls, setReferencePreviewUrls] = useState<string[]>([])
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourceName, setSourceName] = useState('')
  const [job, setJob] = useState<PptMasterJobRecord | null>(null)
  const [downloadName, setDownloadName] = useState('')
  const stopPollRef = useRef<(() => void) | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const urls = referenceSlides.map((file) => URL.createObjectURL(file))
    setReferencePreviewUrls(urls)
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [referenceSlides])

  useEffect(() => {
    if (sharedMaterial) {
      setSourceFile(sharedMaterial.file)
      setSourceName(sharedMaterial.name)
    }
  }, [sharedMaterial])

  useEffect(() => {
    if (isReplica) return
    if (initialPrompt?.trim()) setPrompt(initialPrompt)
  }, [initialPrompt, isReplica])

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
      setHealthError(err instanceof Error ? err.message : '生成服务不可用')
    }
  }, [])

  useEffect(() => {
    void refreshHealth()
  }, [refreshHealth])

  const buildDownloadName = useCallback(
    (record: PptMasterJobRecord) => {
      const base = sourceFile?.name.replace(/\.[^.]+$/, '') || (isReplica ? '参照页还原' : 'AI设计稿')
      const suffix = isReplica ? '还原' : '设计稿'
      return `${base}-${suffix}-${record.job_id.slice(0, 8)}.pptx`
    },
    [isReplica, sourceFile],
  )

  const applyMaterial = useCallback(
    async (file: File) => {
      onBusyChange(true)
      try {
        const doc = await readPptSourceDocument(file)
        setSourceFile(doc.file)
        setSourceName(doc.name)
        onSharedMaterialChange(doc)
        onStatus(`已上传「${doc.name}」`)
      } catch (err) {
        setSourceFile(null)
        setSourceName('')
        onSharedMaterialChange(null)
        onStatus(err instanceof Error ? err.message : '文档读取失败', true)
      } finally {
        onBusyChange(false)
      }
    },
    [onBusyChange, onSharedMaterialChange, onStatus],
  )

  const clearMaterial = useCallback(() => {
    setSourceFile(null)
    setSourceName('')
    onSharedMaterialChange(null)
  }, [onSharedMaterialChange])

  const handleReferenceSlides = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files).filter(
        (file) => file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name),
      )
      if (list.length === 0) return
      setReferenceSlides((prev) => [...prev, ...list].slice(0, 30))
      onStatus(`已添加 ${list.length} 张参照页`)
    },
    [onStatus],
  )

  const removeReferenceSlide = useCallback((index: number) => {
    setReferenceSlides((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const finishJob = useCallback(
    async (record: PptMasterJobRecord) => {
      if (record.status !== 'succeeded') return
      setDownloadName(buildDownloadName(record))
      onDesignDraftComplete?.(record.slide_count ?? undefined)
      const pages = record.slide_count ? `${record.slide_count} 页` : '已完成'
      onStatus(isReplica ? `参照页还原已完成（${pages}）` : `AI 设计稿已完成（${pages}）`)
    },
    [buildDownloadName, isReplica, onDesignDraftComplete, onStatus],
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
    if (isReplica) {
      if (!health?.vision_enabled) {
        onStatus('截图还原需要开启视觉模型，请检查本地生成服务配置', true)
        return
      }
      if (referenceSlides.length === 0) {
        onStatus('请上传至少一张 PPT 页面截图', true)
        return
      }
    } else if (!sourceFile) {
      onStatus('请先上传源文件（PDF / Word / 文本）', true)
      return
    }
    if (!prompt.trim() && !isReplica) {
      onStatus('请填写生成要求', true)
      return
    }
    if (!health?.ppt_master_ready) {
      onStatus('PPT 生成服务未就绪，请确认本地 API 已启动', true)
      return
    }
    if (!health.llm_configured) {
      onStatus('生成服务未配置 API Key', true)
      return
    }

    stopPollRef.current?.()
    onBusyChange(true)
    onStatus(isReplica ? '已提交还原任务…' : '已提交 AI 设计任务…')
    setJob(null)
    try {
      const created = await createPptMasterJob({
        file: sourceFile,
        prompt: isReplica ? resolveReplicaPrompt(prompt) : prompt.trim(),
        style,
        generationMode: isReplica ? 'replica' : 'creative',
        referenceImages: isReplica ? referenceSlides : undefined,
        ...(!isReplica && referenceImageUrl.trim() ? { referenceImageUrl: referenceImageUrl.trim() } : {}),
      })
      stopPollRef.current = pollPptMasterJob(created.job_id, (record) => {
        setJob(record)
        onStatus(record.progress.message)
        if (record.status === 'succeeded') {
          void finishJob(record)
            .catch((err) => {
              onStatus(err instanceof Error ? err.message : 'PPT 解析失败', true)
            })
            .finally(() => {
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
  }, [
    finishJob,
    health,
    isReplica,
    onBusyChange,
    onStatus,
    prompt,
    referenceImageUrl,
    referenceSlides,
    sourceFile,
    style,
  ])

  const sidecarReady = Boolean(health?.ppt_master_ready && health.llm_configured)
  const sidecarChecking = !health && !healthError
  const storySteps = buildMasterProgressStory(job, isReplica)

  const canNextStep1 = isReplica ? referenceSlides.length > 0 : Boolean(sourceFile)
  const checklistReady = sidecarReady
  const checklistMaterial = Boolean(sourceFile) || (isReplica && referenceSlides.length > 0)
  const checklistStyle = isReplica || wizardStep >= 2

  const goNext = () => {
    if (wizardStep >= maxStep) return
    if (wizardStep === 1 && !canNextStep1) {
      onStatus(isReplica ? '请先上传参照页截图' : '请先上传材料', true)
      return
    }
    onWizardStepChange(wizardStep + 1)
  }

  const goPrev = () => {
    if (wizardStep <= 1) {
      onBackToLanding()
      return
    }
    onWizardStepChange(wizardStep - 1)
  }

  return (
    <div className="ppt-beautify-layout ppt-beautify-outline-layout ppt-beautify-ai-layout ppt-master-wizard-layout">
      <aside className="ppt-beautify-sidebar ppt-master-wizard-sidebar">
        <div className="ppt-master-wizard-nav">
          <button type="button" className="btn btn-sm btn-ghost ppt-master-wizard-back" disabled={busy} onClick={goPrev}>
            <ChevronLeft size={14} />
            {wizardStep <= 1 ? '返回场景选择' : '上一步'}
          </button>
          <PptWizardStepper steps={steps} current={job ? maxStep : wizardStep} />
          {!isReplica && !job ? (
            <p className="ppt-beautify-qianfan-hint ppt-master-wizard-eta">预计 5–15 分钟 · 约 8–12 页（视材料而定）</p>
          ) : null}
        </div>

        {!sidecarReady && !sidecarChecking ? (
          <section className="ppt-beautify-block ppt-beautify-sidecar-alert">
            <p className="ppt-beautify-sidecar-warn">
              <AlertCircle size={14} />
              {healthError || 'PPT 生成服务未就绪，请确认 npm run dev:ppt-api 已启动'}
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => void refreshHealth()}>
                重试
              </button>
            </p>
          </section>
        ) : null}

        {!job && isReplica && wizardStep === 1 ? (
          <section className="ppt-beautify-block">
            <h3>上传 PPT 页面截图</h3>
            <input
              ref={referenceInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
              multiple
              hidden
              disabled={busy}
              onChange={(e) => {
                if (e.target.files?.length) handleReferenceSlides(e.target.files)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className="doc-write-upload-zone ppt-beautify-upload"
              disabled={busy}
              onClick={() => referenceInputRef.current?.click()}
            >
              <ImagePlus size={18} />
              <span>添加截图（可多选，按顺序还原）</span>
            </button>
            {referenceSlides.length > 0 ? (
              <div className="ppt-beautify-master-ref-grid">
                {referenceSlides.map((file, index) => (
                  <figure key={`${file.name}-${index}`} className="ppt-beautify-master-ref-card">
                    {referencePreviewUrls[index] ? <img src={referencePreviewUrls[index]} alt="" /> : null}
                    <figcaption>
                      <span>第 {index + 1} 页</span>
                      <button
                        type="button"
                        className="ppt-beautify-doc-remove"
                        aria-label="移除"
                        disabled={busy}
                        onClick={() => removeReferenceSlide(index)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : null}
            <button type="button" className="btn btn-sm btn-primary ppt-beautify-wizard-next" disabled={busy || !canNextStep1} onClick={goNext}>
              下一步
              <ChevronRight size={14} />
            </button>
          </section>
        ) : null}

        {!job && !isReplica && wizardStep === 1 ? (
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
                if (file) void applyMaterial(file)
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
                    aria-label="移除"
                    disabled={busy}
                    onClick={(event) => {
                      event.stopPropagation()
                      clearMaterial()
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
            <p className="ppt-beautify-qianfan-hint">也可在顶部「当前材料」栏提前上传，会自动带入此步。</p>
            <button type="button" className="btn btn-sm btn-primary ppt-beautify-wizard-next" disabled={busy || !canNextStep1} onClick={goNext}>
              下一步：选风格
              <ChevronRight size={14} />
            </button>
          </section>
        ) : null}

        {!job && !isReplica && wizardStep === 2 ? (
          <section className="ppt-beautify-block">
            <h3>选视觉风格</h3>
            <p className="ppt-beautify-palette-locked">
              <Lock size={13} />
              配色已锁定，生成结果与右侧预览一致
            </p>
            <div className="ppt-beautify-outline-templates ppt-beautify-style-list ppt-beautify-style-swatch-grid">
              {PPT_MASTER_STYLES.map((item) => {
                const preview = PPT_MASTER_STYLE_PREVIEWS[item].preview
                return (
                  <button
                    key={item}
                    type="button"
                    className={`ppt-beautify-style-swatch-btn${style === item ? ' active' : ''}`}
                    disabled={busy}
                    title={PPT_MASTER_STYLE_PREVIEWS[item].scene}
                    onClick={() => setStyle(item)}
                  >
                    <span className="ppt-beautify-style-swatch" style={{ background: preview.slideBackground }} aria-hidden="true" />
                    <strong>{PPT_MASTER_STYLE_LABELS[item]}</strong>
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              className="ppt-beautify-advanced-toggle"
              disabled={busy}
              onClick={() => setAdvancedOpen((open) => !open)}
            >
              {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              更多选项（可选）
            </button>
            {advancedOpen ? (
              <div className="ppt-beautify-advanced-panel">
                {health?.vision_enabled ? (
                  <label className="ppt-beautify-qianfan-custom-url ppt-beautify-master-vision-ref">
                    风格参考图链接（仅学习版式，配色仍用预设）
                    <input
                      type="url"
                      value={referenceImageUrl}
                      disabled={busy}
                      placeholder="https://… 公网图片链接"
                      onChange={(e) => setReferenceImageUrl(e.target.value)}
                    />
                  </label>
                ) : (
                  <p className="ppt-beautify-qianfan-hint">开启视觉模型后可粘贴模板封面链接辅助版式。</p>
                )}
              </div>
            ) : null}
            <div className="ppt-beautify-wizard-nav-row">
              <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={goPrev}>
                上一步
              </button>
              <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={goNext}>
                下一步：确认生成
                <ChevronRight size={14} />
              </button>
            </div>
          </section>
        ) : null}

        {!job && (isReplica ? wizardStep === 2 : wizardStep === 3) ? (
          <>
            {!isReplica ? (
              <section className="ppt-beautify-block">
                <h3>确认摘要</h3>
                <ul className="ppt-beautify-wizard-summary">
                  <li>
                    <span>材料</span>
                    <strong>{sourceName || '未上传'}</strong>
                  </li>
                  <li>
                    <span>风格</span>
                    <strong>{PPT_MASTER_STYLE_LABELS[style]}</strong>
                  </li>
                </ul>
              </section>
            ) : null}
            {isReplica ? (
              <section className="ppt-beautify-block">
                <h3>材料（可选）</h3>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={PPT_SOURCE_ACCEPT}
                  hidden
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void applyMaterial(file)
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
                      {sourceName}
                    </span>
                  ) : (
                    <>
                      <FileText size={18} />
                      <span>可选：补充 Word / PDF</span>
                    </>
                  )}
                </button>
                <p className="ppt-beautify-qianfan-hint">已选 {referenceSlides.length} 张参照页，按上传顺序还原。</p>
              </section>
            ) : null}
            <section className="ppt-beautify-block ppt-beautify-block-primary">
              <h3>{isReplica ? '还原要求' : PPT_MASTER_PROMPT_GUIDE.title}</h3>
              {!isReplica ? <PptMasterFieldHintRow guide={PPT_MASTER_PROMPT_GUIDE} /> : null}
              {isReplica ? (
                <p className="ppt-beautify-qianfan-hint">
                  默认严格按截图还原；仅补充与截图相关的细节（如「保留底部数据条」），勿填写「重新生成 AI 趋势」类要求。
                </p>
              ) : null}
              <textarea
                className="ppt-beautify-outline-prompt"
                value={prompt}
                rows={4}
                disabled={busy}
                placeholder={
                  isReplica
                    ? '严格按截图还原全部文字与版式，不要更换主题…'
                    : PPT_MASTER_PROMPT_GUIDE.placeholder
                }
                onChange={(e) => setPrompt(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-sm btn-primary ppt-beautify-generate-btn"
                disabled={busy || !sidecarReady || (isReplica ? referenceSlides.length === 0 : !sourceFile)}
                onClick={() => void handleGenerate()}
              >
                {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                {isReplica ? '开始还原' : '开始生成'}
              </button>
            </section>
          </>
        ) : null}
      </aside>

      <div className="ppt-beautify-outline-main ppt-beautify-ai-main">
        {job ? (
          <div className="ppt-beautify-master-progress ppt-beautify-ai-progress">
            <div className="ppt-beautify-ai-progress-head">
              {job.status === 'succeeded' ? <Sparkles size={28} /> : <Loader2 size={28} className="spin" />}
              <div>
                <h3>{friendlyProgressHeadline(job, isReplica)}</h3>
                <p>{job.progress.message}</p>
              </div>
            </div>
            <ol className="ppt-progress-story">
              {storySteps.map((step) => (
                <li key={step.id} className={`ppt-progress-story-item ${step.state}`}>
                  <span className="ppt-progress-story-dot" aria-hidden="true" />
                  {step.label}
                </li>
              ))}
            </ol>
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
                <button type="button" className="btn btn-primary ppt-beautify-master-download-btn" disabled={busy} onClick={() => void handleDownload()}>
                  <Download size={16} />
                  下载 PPT（.pptx）
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="ppt-master-wizard-preview">
            {!isReplica && wizardStep === 1 ? (
              <div className="ppt-master-wizard-checklist">
                <h3>你将得到</h3>
                <p>可编辑 .pptx：封面、目录与正文页，适合正式汇报。</p>
                <ul>
                  <li className={checklistReady ? 'done' : ''}>本地生成服务已就绪</li>
                  <li className={checklistMaterial ? 'done' : ''}>已上传材料</li>
                  <li className={checklistStyle ? 'done' : ''}>已选择风格</li>
                </ul>
              </div>
            ) : null}
            {!isReplica ? (
              <PptMasterStyleGuidePanel style={style} sourceFile={sourceFile} sourceName={sourceName} onPromptChange={setPrompt} />
            ) : (
              <div className="ppt-master-wizard-checklist">
                <h3>截图还原说明</h3>
                <p>按上传顺序逐页高保真还原为可编辑 SVG，再导出 pptx。</p>
                <p className="ppt-beautify-qianfan-hint">可将千帆模板封面放大截图，或导出 PPT 各页为 PNG。</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
