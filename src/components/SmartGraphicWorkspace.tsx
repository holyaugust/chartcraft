import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AlertCircle, Copy, FileDown, LayoutGrid, Loader2, Sparkles } from 'lucide-react'

import SmartGraphicTemplateLibrary from './SmartGraphicTemplateLibrary'

import SmartGraphicEditor from './SmartGraphicEditor'

import SmartGraphicPreview from './SmartGraphicPreview'

import SmartGraphicImageUpload from './SmartGraphicImageUpload'

import { createStateFromTemplate, getSmartGraphicTemplate } from '../data/smartGraphicTemplates'

import type { SmartGraphicState, SmartGraphicTemplate } from '../types/smartGraphic'

import { SMART_GRAPHIC_CATEGORY_LABELS } from '../types/smartGraphic'

import { generateSmartGraphicContent, generateSmartGraphicFromImage } from '../utils/smartGraphicAi'

import { applySmartGraphicElementEdit, getItemIndexFromElementId, type SmartGraphicElementId } from '../utils/smartGraphicEdit'

import { copySmartGraphicPngFromElement, saveSmartGraphicPngFromElement } from '../utils/smartGraphicExport'

import { loadSmartGraphicDraft, saveSmartGraphicDraft } from '../utils/smartGraphicStorage'



interface SmartGraphicWorkspaceProps {

  onSavedLabelChange: (label: string) => void

}



const AI_EXAMPLES = [

  '三大数字化转型抓手：组织、流程、数据',

  'PDCA 持续改进闭环',

  '2025 年四个季度里程碑计划',

  '产品能力金字塔：战略、管理、执行',

]



export default function SmartGraphicWorkspace({ onSavedLabelChange }: SmartGraphicWorkspaceProps) {

  const [state, setState] = useState<SmartGraphicState>(() => loadSmartGraphicDraft())

  const [aiPrompt, setAiPrompt] = useState('')

  const [busy, setBusy] = useState(false)

  const [exporting, setExporting] = useState<'png' | 'copy' | null>(null)

  const [statusMessage, setStatusMessage] = useState('')

  const [statusIsError, setStatusIsError] = useState(false)

  const [lastSavedAt, setLastSavedAt] = useState(Date.now())

  const [selectedElement, setSelectedElement] = useState<SmartGraphicElementId | null>(null)

  const captureRef = useRef<HTMLDivElement>(null)



  const template = useMemo(

    () => getSmartGraphicTemplate(state.templateId) ?? getSmartGraphicTemplate('parallel-h3-card')!,

    [state.templateId],

  )



  useEffect(() => {

    const timer = window.setTimeout(() => {

      saveSmartGraphicDraft(state)

      setLastSavedAt(Date.now())

    }, 400)

    return () => window.clearTimeout(timer)

  }, [state])



  const savedLabel = useMemo(() => {

    const date = new Date(lastSavedAt)

    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`

  }, [lastSavedAt])



  useEffect(() => {

    onSavedLabelChange(savedLabel)

  }, [savedLabel, onSavedLabelChange])



  const handleApplyTemplate = useCallback((nextTemplate: SmartGraphicTemplate) => {

    setState(createStateFromTemplate(nextTemplate))

    setSelectedElement(null)

    setStatusMessage(`已切换版式：${nextTemplate.name}`)

    setStatusIsError(false)

  }, [])



  const handleAiGenerate = useCallback(async () => {

    const prompt = aiPrompt.trim()

    if (!prompt || busy) return



    setBusy(true)

    setStatusMessage('')

    setStatusIsError(false)



    try {

      const result = await generateSmartGraphicContent({

        prompt,

        itemCount: template.itemCount,

        layoutName: template.name,

        categoryLabel: SMART_GRAPHIC_CATEGORY_LABELS[template.category],

        templateId: template.id,

      })

      setState((prev) => ({

        ...prev,

        title: result.title,

        subtitle: result.subtitle,

        items: result.items,

        footerGroupA: result.footerGroupA ?? prev.footerGroupA,

        footerGroupB: result.footerGroupB ?? prev.footerGroupB,

      }))

      setAiPrompt('')

      setStatusMessage('AI 已生成图形内容')

    } catch (err) {

      setStatusIsError(true)

      setStatusMessage(err instanceof Error ? err.message : 'AI 生成失败')

    } finally {

      setBusy(false)

    }

  }, [aiPrompt, busy, template])



  const handleImageGenerate = useCallback(

    async (imageDataUrl: string, hint: string) => {

      if (busy) return



      setBusy(true)

      setStatusMessage('')

      setStatusIsError(false)

      setSelectedElement(null)



      try {

        const generated = await generateSmartGraphicFromImage({
          imageDataUrl,
          hint,
          onProgress: (message) => setStatusMessage(message),
        })

        setState(generated)

        const nextTemplate = getSmartGraphicTemplate(generated.templateId)

        setStatusMessage(`已根据图片生成：${nextTemplate?.name ?? '智能图形'}，可在右侧点击文字编辑`)

      } catch (err) {

        setStatusIsError(true)

        setStatusMessage(err instanceof Error ? err.message : '图片识别失败')

      } finally {

        setBusy(false)

      }

    },

    [busy],

  )



  const handleElementChange = useCallback((elementId: SmartGraphicElementId, value: string) => {

    setState((prev) => applySmartGraphicElementEdit(prev, elementId, value))

  }, [])



  const handleExportPng = useCallback(async () => {

    if (exporting || !captureRef.current) return

    setSelectedElement(null)

    setExporting('png')

    try {

      await new Promise((resolve) => window.setTimeout(resolve, 80))

      const saved = await saveSmartGraphicPngFromElement(captureRef.current, state.title, state.colorSchemeId)

      if (saved) {

        setStatusIsError(false)

        setStatusMessage('PNG 已下载，可直接粘贴到 PPT')

      }

    } catch (err) {

      setStatusIsError(true)

      setStatusMessage(err instanceof Error ? err.message : 'PNG 导出失败')

    } finally {

      setExporting(null)

    }

  }, [exporting, state.title, state.colorSchemeId])



  const handleCopyPng = useCallback(async () => {

    if (exporting || !captureRef.current) return

    setSelectedElement(null)

    setExporting('copy')

    try {

      await new Promise((resolve) => window.setTimeout(resolve, 80))

      await copySmartGraphicPngFromElement(captureRef.current, state.colorSchemeId)

      setStatusIsError(false)

      setStatusMessage('已复制 PNG 到剪贴板，可在 PPT 中 Ctrl+V 粘贴')

    } catch (err) {

      setStatusIsError(true)

      setStatusMessage(err instanceof Error ? err.message : '复制失败')

    } finally {

      setExporting(null)

    }

  }, [exporting, state.colorSchemeId])



  return (

    <main className="app-main document-main sg-main">

      <section className="panel panel-document panel-sg">

        <div className="panel-header document-toolbar-header">

          <div className="document-panel-title">

            <LayoutGrid size={20} />

            <div>

              <h2>智能图形</h2>

              <p>上传图片识别 · 预览区点击编辑 · 导出 PNG 贴 PPT</p>

            </div>

          </div>

          <div className="document-toolbar-actions">

            <button

              type="button"

              className="btn btn-sm btn-ghost"

              disabled={!!exporting}

              onClick={() => void handleCopyPng()}

            >

              {exporting === 'copy' ? <Loader2 size={14} className="spin" /> : <Copy size={14} />}

              复制图片

            </button>

            <button

              type="button"

              className="btn btn-sm btn-primary"

              disabled={!!exporting}

              onClick={() => void handleExportPng()}

            >

              {exporting === 'png' ? <Loader2 size={14} className="spin" /> : <FileDown size={14} />}

              PNG

            </button>

          </div>

        </div>



        {statusMessage ? (

          <div className={`document-status-bar${statusIsError ? ' error' : ' success'}`}>

            {statusIsError ? <AlertCircle size={14} /> : <Sparkles size={14} />}

            {statusMessage}

          </div>

        ) : null}



        <div className="document-layout-split sg-layout-split">

          <div className="document-editor-column sg-sidebar-column">

            <SmartGraphicTemplateLibrary activeTemplateId={state.templateId} onApply={handleApplyTemplate} />



            <SmartGraphicImageUpload

              busy={busy}

              previewUrl={state.sourceImageUrl}

              onGenerate={handleImageGenerate}

            />



            <section className="sg-ai-block">

              <h3>

                <Sparkles size={16} />

                AI 生成内容

              </h3>

              <textarea

                className="sg-ai-input"

                rows={3}

                placeholder="描述要展示的内容，AI 将填入当前版式…"

                value={aiPrompt}

                disabled={busy}

                onChange={(event) => setAiPrompt(event.target.value)}

                onKeyDown={(event) => {

                  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {

                    event.preventDefault()

                    void handleAiGenerate()

                  }

                }}

              />

              <button

                type="button"

                className="btn btn-primary btn-sm sg-ai-submit"

                disabled={busy || !aiPrompt.trim()}

                onClick={() => void handleAiGenerate()}

              >

                {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}

                {busy ? '生成中…' : 'AI 填充'}

              </button>

              <div className="sg-ai-examples">

                {AI_EXAMPLES.map((example) => (

                  <button

                    key={example}

                    type="button"

                    className="chart-ai-example-chip"

                    disabled={busy}

                    onClick={() => setAiPrompt(example)}

                  >

                    {example}

                  </button>

                ))}

              </div>

            </section>



            <SmartGraphicEditor

              state={state}

              template={template}

              selectedItemIndex={getItemIndexFromElementId(selectedElement)}

              onChange={setState}

            />

          </div>



          <div className="sg-preview-column">

            <div className="sg-preview-header">

              <h3>预览</h3>

              <span>{template.name} · 点击文字可编辑</span>

            </div>

            <SmartGraphicPreview

              ref={captureRef}

              state={state}

              template={template}

              editable

              selectedElement={selectedElement}

              onSelectElement={setSelectedElement}

              onElementChange={handleElementChange}

            />

            <p className="sg-preview-hint">

              在预览区点击标题、栏目、指标等文字即可直接修改；Enter 确认，Esc 取消。导出 PNG 后粘贴到 PowerPoint / WPS。

            </p>

          </div>

        </div>

      </section>

    </main>

  )

}

