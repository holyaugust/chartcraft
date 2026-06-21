import { useCallback, useMemo, useRef, useState } from 'react'

import { AlertCircle, Download, FileUp, Loader2, Palette, Sparkles } from 'lucide-react'

import PptBeautifyOutlinePanel, { type PptOutlineSourcePayload } from './PptBeautifyOutlinePanel'

import PptMasterGeneratePanel from './PptMasterGeneratePanel'

import PptBeautifyFullPreview from './PptBeautifyFullPreview'

import PptBeautifySlideList from './PptBeautifySlideList'

import { PPT_COVER_THEMES, getPptCoverTheme } from '../data/pptCoverThemes'

import {

  FULL_BEAUTIFY_EXPORT_MODE_LABELS,
  PPT_BEAUTIFY_VIEW_LABELS,

  type FullBeautifyExportMode,

  type PptBeautifyView,

} from '../types/pptBeautify'

import type { PresentationOutline, PresentationSlideLayout } from '../types/presentation'

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

import { resolveAiDesignSource } from '../utils/pptAiDesignSource'

import { beginSaveFile } from '../utils/saveFile'

import { loadEnterpriseTemplateMeta, registerEnterpriseTemplate } from '../utils/pptBeautifyEnterprise'



interface PptBeautifyWorkspaceProps {

  onSavedLabelChange: (label: string) => void

}



export default function PptBeautifyWorkspace({ onSavedLabelChange }: PptBeautifyWorkspaceProps) {

  const [pptView, setPptView] = useState<PptBeautifyView>('outline')

  const [sharedSource, setSharedSource] = useState<PptOutlineSourcePayload | null>(null)

  const [busy, setBusy] = useState(false)

  const [statusMessage, setStatusMessage] = useState('')

  const [statusIsError, setStatusIsError] = useState(false)

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

  const [activeFullSlideIndex, setActiveFullSlideIndex] = useState(0)

  const fullFileRef = useRef<HTMLInputElement>(null)

  const setStatus = useCallback((message: string, isError = false) => {

    setStatusMessage(message)

    setStatusIsError(isError)

  }, [])



  const handleOutlineReady = useCallback(

    (outline: PresentationOutline) => {

      setOutlineSource(outline)

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



  const handleDesignDraftComplete = useCallback(

    (_slideCount?: number) => {

      onSavedLabelChange(

        `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`,

      )

    },

    [onSavedLabelChange],

  )

  const goOutlineView = useCallback(() => setPptView('outline'), [])



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

  const aiDesignSource = useMemo(

    () => resolveAiDesignSource(sharedSource, outlineSource),

    [sharedSource, outlineSource],

  )

  const aiDesignPrompt = sharedSource?.prompt || loadPresentationDraft().prompt || undefined



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

              <p>
                {pptView === 'outline'
                  ? '上传材料 · 生成并预览 PPT 大纲'
                  : pptView === 'template-export'
                    ? `基于大纲 · ${PPT_BEAUTIFY_VIEW_LABELS['template-export']}`
                    : `${PPT_BEAUTIFY_VIEW_LABELS['ai-design']} · 成稿后直接下载`}
              </p>

            </div>

          </div>

          <div className="document-toolbar-actions">

            <div className="ppt-beautify-output-mode-switch" role="tablist" aria-label="出稿方式">

              <button

                type="button"

                role="tab"

                aria-selected={pptView === 'template-export'}

                className={`ppt-beautify-output-mode-btn${pptView === 'template-export' ? ' active' : ''}`}

                disabled={busy}

                title={outlineSource ? '基于大纲选择主题模板导出' : '请先生成大纲'}

                onClick={() => {

                  if (!outlineSource) {

                    setStatus('请先生成大纲后再使用模板导出', true)

                    return

                  }

                  setPptView('template-export')

                }}

              >

                模板导出

              </button>

              <button

                type="button"

                role="tab"

                aria-selected={pptView === 'ai-design'}

                className={`ppt-beautify-output-mode-btn${pptView === 'ai-design' ? ' active' : ''}`}

                disabled={busy}

                title="Sidecar 逐页 AI 成稿，生成后直接下载"

                onClick={() => setPptView('ai-design')}

              >

                AI 设计稿

              </button>

            </div>

          </div>

        </div>



        {statusMessage ? (

          <div className={`document-status-bar${statusIsError ? ' error' : ' success'}`}>

            {statusIsError ? <AlertCircle size={14} /> : <Sparkles size={14} />}

            {statusMessage}

          </div>

        ) : null}



        {pptView === 'outline' ? (

          <>

            <PptBeautifyOutlinePanel

              busy={busy}

              onBusyChange={setBusy}

              onStatus={setStatus}

              onOutlineReady={handleOutlineReady}

              onSourceChange={setSharedSource}

            />

          </>

        ) : null}



        {pptView === 'ai-design' ? (

          <PptMasterGeneratePanel

            busy={busy}

            onBusyChange={setBusy}

            onStatus={setStatus}

            onDesignDraftComplete={handleDesignDraftComplete}

            initialSource={aiDesignSource}

            initialPrompt={aiDesignPrompt}

            onBack={goOutlineView}

          />

        ) : null}



        {pptView === 'template-export' ? (

          <div className="ppt-beautify-layout ppt-beautify-full-layout">

            <aside className="ppt-beautify-sidebar">

              {fullSourceFromOutline && outlineSource ? (

                <section className="ppt-beautify-block ppt-beautify-outline-sync">

                  <h3>内容来源 · 文本大纲</h3>

                  <p>

                    共 {outlineSource.slides.length} 页 · <strong>{outlineSource.title}</strong>

                  </p>

                  <button type="button" className="btn btn-sm btn-ghost" onClick={goOutlineView}>

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

                <div className="ppt-beautify-export-actions">

                  <button

                    type="button"

                    className="btn btn-sm btn-primary"

                    disabled={busy || !fullSource || !fullTemplateSource}

                    title="基于模板写回文字，可在 PowerPoint 中修改内容"

                    onClick={() => void handleExportFull('editable')}

                  >

                    {busy ? <Loader2 size={14} className="spin" /> : <Download size={14} />}

                    可编辑导出

                  </button>

                  <button

                    type="button"

                    className="btn btn-sm btn-ghost"

                    disabled={busy || !fullSource || fullTemplateKind === 'enterprise'}

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

      </section>

    </main>

  )

}


