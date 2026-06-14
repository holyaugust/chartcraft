import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AlertCircle, ChevronDown, Download, FileUp, Loader2, Palette, Sparkles } from 'lucide-react'

import PptBeautifyCoverPreview from './PptBeautifyCoverPreview'

import PptBeautifyOutlinePanel from './PptBeautifyOutlinePanel'

import PptMasterGeneratePanel from './PptMasterGeneratePanel'

import PptBeautifyFullPreview from './PptBeautifyFullPreview'

import PptBeautifySlideList from './PptBeautifySlideList'

import { PPT_COVER_THEMES, getPptCoverTheme } from '../data/pptCoverThemes'

import {

  DEFAULT_PPT_COVER_CONTENT,

  PPT_BEAUTIFY_PHASE_LABELS,

  type PptBeautifyPhase,

  type PptCoverContent,

  FULL_BEAUTIFY_EXPORT_MODE_LABELS,

  type FullBeautifyExportMode,

} from '../types/pptBeautify'

import {
  PPT_OUTLINE_GENERATE_MODE_LABELS,
  type PptOutlineGenerateMode,
} from '../types/pptMaster'

import type { PresentationOutline, PresentationSlideLayout } from '../types/presentation'

import {

  buildCoverFileName,

  exportBeautifiedCoverPptx,

  extractCoverContentFromImportedPptx,

} from '../utils/pptCoverBeautify'

import {

  FULL_DECK_MAX_SLIDES,

  PPT_LAYOUT_LABELS,

  analyzePptxPageTypes,

  buildFullBeautifyFileName,

  exportFullBeautifiedPptx,

  outlineToImportedPptx,

  type FullBeautifyTemplateSource,

} from '../utils/pptBeautifyFull'

import { exportFullBeautifiedVisualPptx } from '../utils/pptBeautifyFullVisualExport'

import { importPptxFile, type ImportedPptx } from '../utils/pptxImport'

import { loadPresentationDraft } from '../utils/presentationStorage'

import { saveFile, beginSaveFile } from '../utils/saveFile'

import { loadEnterpriseTemplateMeta, registerEnterpriseTemplate } from '../utils/pptBeautifyEnterprise'



interface PptBeautifyWorkspaceProps {

  onSavedLabelChange: (label: string) => void

}



function coverFromOutline(outline: PresentationOutline): PptCoverContent {

  const titleSlide = outline.slides.find((slide) => slide.layout === 'title')

  return {

    title: outline.title || '演示文稿',

    subtitle: outline.subtitle || titleSlide?.title || '',

    author: titleSlide?.bullets?.[0]?.trim() || DEFAULT_PPT_COVER_CONTENT.author,

    date: titleSlide?.bullets?.[1]?.trim() || DEFAULT_PPT_COVER_CONTENT.date,

  }

}



export default function PptBeautifyWorkspace({ onSavedLabelChange }: PptBeautifyWorkspaceProps) {

  const [phase, setPhase] = useState<PptBeautifyPhase>(1)

  const [generateMode, setGenerateMode] = useState<PptOutlineGenerateMode>('outline')

  const [content, setContent] = useState<PptCoverContent>(() => {

    const draft = loadPresentationDraft()

    if (draft.outlineJson.trim()) {

      try {

        return coverFromOutline(JSON.parse(draft.outlineJson) as PresentationOutline)

      } catch {

        /* use default */

      }

    }

    return { ...DEFAULT_PPT_COVER_CONTENT }

  })

  const [themeId, setThemeId] = useState(PPT_COVER_THEMES[0].id)

  const [busy, setBusy] = useState(false)

  const [statusMessage, setStatusMessage] = useState('')

  const [statusIsError, setStatusIsError] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)



  const theme = useMemo(() => getPptCoverTheme(themeId) ?? PPT_COVER_THEMES[0], [themeId])

  const [enterpriseCount, setEnterpriseCount] = useState(() => loadEnterpriseTemplateMeta().length)

  const [enterpriseTemplates, setEnterpriseTemplates] = useState(() => loadEnterpriseTemplateMeta())

  const enterpriseRef = useRef<HTMLInputElement>(null)



  const [outlineSource, setOutlineSource] = useState<PresentationOutline | null>(() => {

    const draft = loadPresentationDraft()

    if (!draft.outlineJson.trim()) return null

    try {

      return JSON.parse(draft.outlineJson) as PresentationOutline

    } catch {

      return null

    }

  })

  const [fullSource, setFullSource] = useState<ImportedPptx | null>(() => {

    const draft = loadPresentationDraft()

    if (!draft.outlineJson.trim()) return null

    try {

      return outlineToImportedPptx(JSON.parse(draft.outlineJson) as PresentationOutline)

    } catch {

      return null

    }

  })

  const [fullSourceFromOutline, setFullSourceFromOutline] = useState(() => {

    const draft = loadPresentationDraft()

    return Boolean(draft.outlineJson.trim())

  })

  const [fullThemeId, setFullThemeId] = useState(PPT_COVER_THEMES[0].id)

  const [fullTemplateKind, setFullTemplateKind] = useState<'builtin' | 'enterprise'>('builtin')

  const [fullEnterpriseId, setFullEnterpriseId] = useState('')

  const [layoutOverrides, setLayoutOverrides] = useState<Partial<Record<number, PresentationSlideLayout>>>({})

  const [fullExportMenuOpen, setFullExportMenuOpen] = useState(false)

  const [activeFullSlideIndex, setActiveFullSlideIndex] = useState(0)

  const fullFileRef = useRef<HTMLInputElement>(null)

  const fullExportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!fullExportMenuOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!fullExportMenuRef.current?.contains(event.target as Node)) {
        setFullExportMenuOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullExportMenuOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [fullExportMenuOpen])



  const setStatus = useCallback((message: string, isError = false) => {

    setStatusMessage(message)

    setStatusIsError(isError)

  }, [])



  const handleOutlineReady = useCallback(

    (outline: PresentationOutline) => {

      setOutlineSource(outline)

      setContent(coverFromOutline(outline))

      const imported = outlineToImportedPptx(outline)

      setFullSource(imported)

      setFullSourceFromOutline(true)

      setLayoutOverrides({})

      setActiveFullSlideIndex(0)

      onSavedLabelChange(

        `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,

      )

    },

    [onSavedLabelChange],

  )



  const handlePptxReady = useCallback(

    (imported: ImportedPptx) => {

      const cover = extractCoverContentFromImportedPptx(imported)

      setContent(cover)

      setFullSource(imported)

      setFullSourceFromOutline(false)

      setOutlineSource(null)

      setLayoutOverrides({})

      setActiveFullSlideIndex(0)

      onSavedLabelChange(

        `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,

      )

    },

    [onSavedLabelChange],

  )



  const update = (patch: Partial<PptCoverContent>) => {

    setContent((prev) => ({ ...prev, ...patch }))

    onSavedLabelChange(

      `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,

    )

  }



  const handleImportPptx = useCallback(async (file: File) => {

    setBusy(true)

    setStatusMessage('')

    setStatusIsError(false)

    try {

      const imported = await importPptxFile(file)

      const cover = extractCoverContentFromImportedPptx(imported)

      setContent(cover)

      setStatusMessage(`已从「${file.name}」第一页提取封面文字，请选择主题后导出`)

    } catch (err) {

      setStatusIsError(true)

      setStatusMessage(err instanceof Error ? err.message : 'PPT 导入失败')

    } finally {

      setBusy(false)

    }

  }, [])



  const handleExport = useCallback(async () => {

    if (busy) return

    setBusy(true)

    setStatusMessage('')

    setStatusIsError(false)

    try {

      const blob = await exportBeautifiedCoverPptx(content, themeId)

      const saved = await saveFile(blob, {

        suggestedName: buildCoverFileName(content.title, themeId),

        description: 'PowerPoint 演示文稿',

        accept: {

          'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],

        },

      })

      setStatusMessage(saved ? '封面美化 PPT 已下载，请用 PowerPoint / WPS 打开查看' : '已取消下载')

    } catch (err) {

      setStatusIsError(true)

      setStatusMessage(err instanceof Error ? err.message : '导出失败')

    } finally {

      setBusy(false)

    }

  }, [busy, content, themeId])



  const fullTemplateSource = useMemo((): FullBeautifyTemplateSource | null => {

    if (fullTemplateKind === 'enterprise') {

      if (!fullEnterpriseId) return null

      return { kind: 'enterprise', templateId: fullEnterpriseId }

    }

    return { kind: 'builtin', themeId: fullThemeId }

  }, [fullTemplateKind, fullEnterpriseId, fullThemeId])



  const fullPreviewTheme = useMemo(

    () => getPptCoverTheme(fullThemeId) ?? PPT_COVER_THEMES[0],

    [fullThemeId],

  )



  const handleImportFullPptx = useCallback(async (file: File) => {

    setBusy(true)

    setStatusMessage('')

    setStatusIsError(false)

    try {

      const analysis = await analyzePptxPageTypes(file)

      setFullSource(analysis.imported)

      setFullSourceFromOutline(false)

      setLayoutOverrides({})

      setActiveFullSlideIndex(0)

      const typeSummary = analysis.pageTypes

        .map((layout, index) => `${index + 1}:${PPT_LAYOUT_LABELS[layout]}`)

        .join(' · ')

      setStatusMessage(`已分析「${file.name}」共 ${analysis.imported.slideCount} 页 · ${typeSummary}`)

    } catch (err) {

      setStatusIsError(true)

      setStatusMessage(err instanceof Error ? err.message : 'PPT 分析失败')

    } finally {

      setBusy(false)

    }

  }, [])



  const handleExportFull = useCallback(async (mode: FullBeautifyExportMode) => {

    if (busy || !fullSource) return

    if (mode === 'editable' && !fullTemplateSource) return

    if (mode === 'visual' && fullTemplateKind === 'enterprise') return

    setFullExportMenuOpen(false)

    const themeKey =

      fullTemplateSource?.kind === 'builtin'

        ? fullTemplateSource.themeId

        : fullEnterpriseId || fullThemeId

    const saveOptions = {

      suggestedName: buildFullBeautifyFileName(fullSource.fileName, themeKey, mode),

      description: 'PowerPoint 演示文稿',

      accept: {

        'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],

      },

    }

    let saveSession: Awaited<ReturnType<typeof beginSaveFile>>

    try {

      saveSession = await beginSaveFile(saveOptions)

    } catch (err) {

      setStatusIsError(true)

      setStatusMessage(err instanceof Error ? err.message : '无法打开保存对话框')

      return

    }

    if (!saveSession) {

      setStatusMessage('已取消下载')

      return

    }

    setBusy(true)

    setStatusMessage(mode === 'visual' ? '高保真导出中，请稍候…' : '正在导出，请稍候…')

    setStatusIsError(false)

    try {

      const result =

        mode === 'visual'

          ? await exportFullBeautifiedVisualPptx(fullSource, fullThemeId, {

              layoutOverrides,

              onProgress: (current, total) => {

                setStatusMessage(`高保真导出中：正在生成第 ${current}/${total} 页…`)

              },

            })

          : await exportFullBeautifiedPptx(fullSource, fullTemplateSource!, { layoutOverrides })

      const saved = await saveSession.write(result.blob)

      const warnText = result.warnings.length > 0 ? ` · ${result.warnings.join('；')}` : ''

      const modeLabel = FULL_BEAUTIFY_EXPORT_MODE_LABELS[mode]

      setStatusMessage(

        saved

          ? `全文美化完成（${modeLabel}）：已导出 ${result.updatedCount} 页${warnText}`

          : '已取消下载',

      )

    } catch (err) {

      setStatusIsError(true)

      setStatusMessage(err instanceof Error ? err.message : '全文导出失败')

    } finally {

      setBusy(false)

    }

  }, [

    busy,

    fullSource,

    fullTemplateSource,

    layoutOverrides,

    fullEnterpriseId,

    fullThemeId,

    fullTemplateKind,

  ])



  return (

    <main className="app-main document-main ppt-beautify-main">

      <section className="panel panel-document panel-ppt-beautify">

        <div className="panel-header document-toolbar-header">

          <div className="document-panel-title">

            <Palette size={20} />

            <div>

              <h2>PPT 美化</h2>

              <p>分阶段流程 · 当前：{PPT_BEAUTIFY_PHASE_LABELS[phase]}</p>

            </div>

          </div>

          <div className="document-toolbar-actions">

            {phase === 2 ? (

              <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void handleExport()}>

                <Download size={14} />

                导出美化封面

              </button>

            ) : null}

            {phase === 3 ? (

              <div className="document-export-dropdown" ref={fullExportMenuRef}>

                <button

                  type="button"

                  className="btn btn-sm btn-primary document-export-trigger"

                  disabled={busy || !fullSource}

                  aria-expanded={fullExportMenuOpen}

                  aria-haspopup="menu"

                  onClick={() => setFullExportMenuOpen((open) => !open)}

                >

                  {busy ? <Loader2 size={14} className="spin" /> : <Download size={14} />}

                  导出全文美化

                  <ChevronDown size={14} className={`document-export-chevron${fullExportMenuOpen ? ' open' : ''}`} />

                </button>

                {fullExportMenuOpen ? (

                  <div className="document-export-menu" role="menu">

                    <button

                      type="button"

                      role="menuitem"

                      disabled={busy || !fullTemplateSource}

                      title="基于模板写回文字，可在 PowerPoint 中修改内容"

                      onClick={() => void handleExportFull('editable')}

                    >

                      可编辑导出

                    </button>

                    <button

                      type="button"

                      role="menuitem"

                      disabled={busy || fullTemplateKind === 'enterprise'}

                      title={

                        fullTemplateKind === 'enterprise'

                          ? '高保真导出仅支持内置主题'

                          : '按 HTML 预览逐页截图，视觉与预览一致，文字不可编辑'

                      }

                      onClick={() => void handleExportFull('visual')}

                    >

                      高保真导出

                    </button>

                  </div>

                ) : null}

              </div>

            ) : null}

          </div>

        </div>



        <div className="ppt-beautify-phase-tabs" role="tablist" aria-label="美化阶段">

          {([1, 2, 3, 4] as PptBeautifyPhase[]).map((item) => (

            <button

              key={item}

              type="button"

              role="tab"

              aria-selected={phase === item}

              className={`ppt-beautify-phase-tab${phase === item ? ' active' : ''}${item === 4 ? ' phase-future' : ''}`}

              onClick={() => setPhase(item)}

            >

              阶段 {item} · {PPT_BEAUTIFY_PHASE_LABELS[item]}

              {item === 1 && outlineSource ? ` (${outlineSource.slides.length}页)` : ''}

              {item === 3 && enterpriseCount > 0 ? ` (${enterpriseCount})` : ''}

            </button>

          ))}

        </div>



        {statusMessage ? (

          <div className={`document-status-bar${statusIsError ? ' error' : ' success'}`}>

            {statusIsError ? <AlertCircle size={14} /> : <Sparkles size={14} />}

            {statusMessage}

          </div>

        ) : null}



        {phase === 1 ? (

          <>

            <div className="ppt-beautify-generate-mode-tabs" role="tablist" aria-label="生成模式">

              {(Object.keys(PPT_OUTLINE_GENERATE_MODE_LABELS) as PptOutlineGenerateMode[]).map((mode) => (

                <button

                  key={mode}

                  type="button"

                  role="tab"

                  aria-selected={generateMode === mode}

                  className={`ppt-beautify-generate-mode-tab${generateMode === mode ? ' active' : ''}`}

                  disabled={busy}

                  onClick={() => setGenerateMode(mode)}

                >

                  {PPT_OUTLINE_GENERATE_MODE_LABELS[mode]}

                </button>

              ))}

            </div>

            {generateMode === 'outline' ? (

              <PptBeautifyOutlinePanel

                busy={busy}

                onBusyChange={setBusy}

                onStatus={setStatus}

                onOutlineReady={handleOutlineReady}

              />

            ) : (

              <PptMasterGeneratePanel

                busy={busy}

                onBusyChange={setBusy}

                onStatus={setStatus}

                onPptxReady={handlePptxReady}

              />

            )}

          </>

        ) : null}



        {phase === 2 ? (

          <div className="ppt-beautify-layout">

            <aside className="ppt-beautify-sidebar">

              {outlineSource ? (

                <section className="ppt-beautify-block ppt-beautify-outline-sync">

                  <h3>来自文档大纲</h3>

                  <p>

                    已同步封面字段：<strong>{outlineSource.title}</strong>

                  </p>

                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPhase(1)}>

                    返回修改大纲

                  </button>

                </section>

              ) : null}



              <section className="ppt-beautify-block">

                <h3>封面内容</h3>

                <div className="setting-field">

                  <label htmlFor="ppt-cover-title">主标题</label>

                  <input

                    id="ppt-cover-title"

                    type="text"

                    value={content.title}

                    onChange={(e) => update({ title: e.target.value })}

                  />

                </div>

                <div className="setting-field">

                  <label htmlFor="ppt-cover-subtitle">副标题</label>

                  <input

                    id="ppt-cover-subtitle"

                    type="text"

                    value={content.subtitle}

                    onChange={(e) => update({ subtitle: e.target.value })}

                  />

                </div>

                <div className="ppt-beautify-row-2">

                  <div className="setting-field">

                    <label htmlFor="ppt-cover-author">汇报人</label>

                    <input

                      id="ppt-cover-author"

                      type="text"

                      value={content.author}

                      onChange={(e) => update({ author: e.target.value })}

                    />

                  </div>

                  <div className="setting-field">

                    <label htmlFor="ppt-cover-date">日期</label>

                    <input

                      id="ppt-cover-date"

                      type="text"

                      value={content.date}

                      onChange={(e) => update({ date: e.target.value })}

                    />

                  </div>

                </div>

              </section>



              <section className="ppt-beautify-block">

                <h3>从 PPT 导入</h3>

                <input

                  ref={fileRef}

                  type="file"

                  accept=".pptx"

                  hidden

                  onChange={(e) => {

                    const file = e.target.files?.[0]

                    if (file) void handleImportPptx(file)

                  }}

                />

                <button

                  type="button"

                  className="doc-write-upload-zone ppt-beautify-upload"

                  disabled={busy}

                  onClick={() => fileRef.current?.click()}

                >

                  <FileUp size={18} />

                  <span>上传 .pptx，提取第一页文字</span>

                </button>

              </section>



              <section className="ppt-beautify-block">

                <h3>选择主题（{PPT_COVER_THEMES.length} 套）</h3>

                <div className="ppt-beautify-theme-grid">

                  {PPT_COVER_THEMES.map((item) => (

                    <button

                      key={item.id}

                      type="button"

                      className={`ppt-beautify-theme-card${themeId === item.id ? ' active' : ''}`}

                      onClick={() => setThemeId(item.id)}

                    >

                      <span className="ppt-beautify-theme-swatch" style={{ background: item.preview.background }} />

                      <strong>{item.name}</strong>

                      <span>{item.description}</span>

                    </button>

                  ))}

                </div>

              </section>

            </aside>



            <div className="ppt-beautify-compare">

              <div className="ppt-beautify-compare-col">

                <h4>美化前</h4>

                <PptBeautifyCoverPreview mode="before" content={content} />

              </div>

              <div className="ppt-beautify-compare-arrow" aria-hidden="true">

                →

              </div>

              <div className="ppt-beautify-compare-col">

                <h4>美化后 · {theme.name}</h4>

                <PptBeautifyCoverPreview mode="after" content={content} theme={theme} />

              </div>

              <p className="ppt-beautify-compare-hint">

                右侧为 HTML 主题预览；导出 pptx 基于模板写回，请在 PowerPoint / WPS 中查看最终效果。

              </p>

            </div>

          </div>

        ) : null}



        {phase === 3 ? (

          <div className="ppt-beautify-layout ppt-beautify-full-layout">

            <aside className="ppt-beautify-sidebar">

              {fullSourceFromOutline && outlineSource ? (

                <section className="ppt-beautify-block ppt-beautify-outline-sync">

                  <h3>内容来源 · 文档大纲</h3>

                  <p>

                    共 {outlineSource.slides.length} 页 · <strong>{outlineSource.title}</strong>

                  </p>

                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setPhase(1)}>

                    返回修改大纲

                  </button>

                </section>

              ) : null}



              <section className="ppt-beautify-block">

                <h3>{fullSourceFromOutline ? '或上传已有 PPT' : '上传待美化 PPT'}</h3>

                <input

                  ref={fullFileRef}

                  type="file"

                  accept=".pptx"

                  hidden

                  onChange={(e) => {

                    const file = e.target.files?.[0]

                    if (file) void handleImportFullPptx(file)

                  }}

                />

                <button

                  type="button"

                  className="doc-write-upload-zone ppt-beautify-upload"

                  disabled={busy}

                  onClick={() => fullFileRef.current?.click()}

                >

                  <FileUp size={18} />

                  <span>

                    {fullSource && !fullSourceFromOutline

                      ? `已加载：${fullSource.fileName}`

                      : fullSourceFromOutline

                        ? '上传 .pptx 替换大纲内容'

                        : '上传 .pptx，自动识别每页版式'}

                  </span>

                </button>

                {fullSource ? (

                  <p className="ppt-beautify-full-meta">

                    共 {fullSource.slideCount} 页 · 内置模板最多支持 {FULL_DECK_MAX_SLIDES} 页

                  </p>

                ) : null}

              </section>



              <section className="ppt-beautify-block">

                <h3>模板来源</h3>

                <div className="ppt-beautify-template-source">

                  <label className="ppt-beautify-radio">

                    <input

                      type="radio"

                      name="full-template-kind"

                      checked={fullTemplateKind === 'builtin'}

                      onChange={() => setFullTemplateKind('builtin')}

                    />

                    内置主题（{PPT_COVER_THEMES.length} 套）

                  </label>

                  <label className={`ppt-beautify-radio${enterpriseCount === 0 ? ' disabled' : ''}`}>

                    <input

                      type="radio"

                      name="full-template-kind"

                      checked={fullTemplateKind === 'enterprise'}

                      disabled={enterpriseCount === 0}

                      onChange={() => {

                        setFullTemplateKind('enterprise')

                        if (!fullEnterpriseId && enterpriseTemplates[0]) {

                          setFullEnterpriseId(enterpriseTemplates[0].id)

                        }

                      }}

                    />

                    企业模板（{enterpriseCount}）

                  </label>

                </div>



                {fullTemplateKind === 'builtin' ? (

                  <div className="ppt-beautify-theme-grid ppt-beautify-theme-grid-compact">

                    {PPT_COVER_THEMES.map((item) => (

                      <button

                        key={item.id}

                        type="button"

                        className={`ppt-beautify-theme-card${fullThemeId === item.id ? ' active' : ''}`}

                        onClick={() => setFullThemeId(item.id)}

                      >

                        <span className="ppt-beautify-theme-swatch" style={{ background: item.preview.background }} />

                        <strong>{item.name}</strong>

                      </button>

                    ))}

                  </div>

                ) : (

                  <div className="ppt-beautify-enterprise-list">

                    {enterpriseTemplates.length === 0 ? (

                      <p className="ppt-beautify-phase-note">请先上传企业模板</p>

                    ) : (

                      enterpriseTemplates.map((item) => (

                        <button

                          key={item.id}

                          type="button"

                          className={`ppt-beautify-enterprise-item${fullEnterpriseId === item.id ? ' active' : ''}`}

                          onClick={() => setFullEnterpriseId(item.id)}

                        >

                          <strong>{item.name}</strong>

                          <span>{item.pageTypes.join(' · ') || '自动识别页型'}</span>

                        </button>

                      ))

                    )}

                  </div>

                )}

              </section>



              <section className="ppt-beautify-block">

                <h3>企业模板库</h3>

                <input

                  ref={enterpriseRef}

                  type="file"

                  accept=".pptx"

                  hidden

                  onChange={(e) => {

                    const file = e.target.files?.[0]

                    if (!file) return

                    void (async () => {

                      setBusy(true)

                      try {

                        const buffer = await file.arrayBuffer()

                        const imported = await importPptxFile(

                          new File([buffer], file.name, {

                            type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

                          }),

                        )

                        const pageTypes = imported.slides.map((slide) => slide.suggestedLayout)

                        await registerEnterpriseTemplate({

                          name: file.name.replace(/\.pptx$/i, ''),

                          fileName: file.name,

                          buffer,

                          pageTypes,

                        })

                        const list = loadEnterpriseTemplateMeta()

                        setEnterpriseTemplates(list)

                        setEnterpriseCount(list.length)

                        if (!fullEnterpriseId && list[0]) {

                          setFullEnterpriseId(list[0].id)

                        }

                        setStatusIsError(false)

                        setStatusMessage(

                          `企业模板「${file.name}」已注册（${pageTypes.length} 页 · ${pageTypes.map((t) => PPT_LAYOUT_LABELS[t as PresentationSlideLayout] ?? t).join(' / ')}）`,

                        )

                      } catch (err) {

                        setStatusIsError(true)

                        setStatusMessage(err instanceof Error ? err.message : '模板注册失败')

                      } finally {

                        setBusy(false)

                      }

                    })()

                  }}

                />

                <button

                  type="button"

                  className="btn btn-sm btn-ghost ppt-beautify-enterprise-btn"

                  disabled={busy}

                  onClick={() => enterpriseRef.current?.click()}

                >

                  <FileUp size={14} />

                  上传企业模板（.pptx）

                </button>

              </section>

            </aside>



            <div className="ppt-beautify-full-main">

              <div className="ppt-beautify-full-preview-header">

                <h4>美化后预览</h4>

              </div>



              <PptBeautifyFullPreview

                slides={fullSource?.slides ?? []}

                theme={fullPreviewTheme}

                layoutOverrides={layoutOverrides}

                activeIndex={activeFullSlideIndex}

                onSelect={setActiveFullSlideIndex}

                enterprisePreview={fullTemplateKind === 'enterprise'}

              />



              <details className="ppt-beautify-full-layout-details" open>

                <summary>页型识别 · 可手动修正</summary>

                <PptBeautifySlideList

                  slides={fullSource?.slides ?? []}

                  layoutOverrides={layoutOverrides}

                  onLayoutChange={(slideIndex, layout) => {

                    setLayoutOverrides((prev) => ({ ...prev, [slideIndex]: layout }))

                  }}

                />

              </details>



              <p className="ppt-beautify-compare-hint">

                上方 HTML 预览为标准效果。可编辑模式基于内置模板写回文字；高保真模式逐页截图，视觉与预览一致。

              </p>

            </div>

          </div>

        ) : null}



        {phase === 4 ? (

          <div className="ppt-beautify-phase-panel">

            <h3>阶段四：元素与主题（规划中）</h3>

            <ul>

              <li>图表 / 表格样式一键优化</li>

              <li>单页版式重排</li>

              <li>全局主题色 / 字体一键替换</li>

            </ul>

          </div>

        ) : null}

      </section>

    </main>

  )

}


