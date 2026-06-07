import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Plus,
  Loader2,
  ChevronDown,
  FileText,
  Trash2,
  Sparkles,
  CircleHelp,
} from 'lucide-react'
import {
  DOCUMENT_WRITE_AUTO_TYPE,
  DOCUMENT_WRITE_TYPES,
  findWriteTypeSelectionByTemplateId,
  resolveWriteTypeSelection,
  type DocumentWriteType,
} from '../data/documentWriteTypes'
import { getDocumentTemplateById } from '../data/documentTemplates'
import {
  DEFAULT_WRITE_PROMPT,
  generateDocumentWithAi,
  readWriteReferenceFile,
  type DocumentWriteMode,
} from '../utils/documentWrite'
import { loadWriteMaterials, saveWriteMaterials, type WriteReferenceFile } from '../utils/documentWriteStorage'
import { isDeepSeekConfigured } from '../utils/deepseek'

interface DocumentWriteModalProps {
  open: boolean
  onClose: () => void
  currentEditorContent?: string
  activeTemplateId?: string | null
  onGenerated: (payload: {
    content: string
    templateId?: string | null
    mode: DocumentWriteMode
    title: string
  }) => void
}

const MAX_REFERENCE_FILES = 1

function createFileId(): string {
  return `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function WriteTypePicker({
  typeId,
  subtypeId,
  onChange,
}: {
  typeId: string
  subtypeId: string | null
  onChange: (typeId: string, subtypeId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [hoverTypeId, setHoverTypeId] = useState<string | null>(null)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({ visibility: 'hidden' })
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const resolved = resolveWriteTypeSelection({ typeId, subtypeId })
  const hoverType =
    DOCUMENT_WRITE_TYPES.find((item) => item.id === hoverTypeId) ??
    (typeId !== 'auto' ? DOCUMENT_WRITE_TYPES.find((item) => item.id === typeId) : null)

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return

    const rect = trigger.getBoundingClientRect()
    const menuRect = menu.getBoundingClientRect()
    const menuWidth = menuRect.width || 420
    const gap = 6
    const margin = 12
    const autoRowHeight = 41

    const spaceBelow = window.innerHeight - rect.bottom - gap - margin
    const spaceAbove = rect.top - gap - margin
    const openBelow = spaceBelow >= 200 || spaceBelow >= spaceAbove
    const availableSplitHeight = Math.max(
      120,
      Math.min(360, (openBelow ? spaceBelow : spaceAbove) - autoRowHeight),
    )
    const menuHeight = autoRowHeight + availableSplitHeight

    const top = openBelow
      ? rect.bottom + gap
      : Math.max(margin, rect.top - gap - menuHeight)

    let left = rect.left
    if (left + menuWidth > window.innerWidth - margin) {
      left = window.innerWidth - margin - menuWidth
    }
    if (left < margin) left = margin

    setMenuStyle({
      position: 'fixed',
      top,
      left,
      zIndex: 4000,
      visibility: 'visible',
      height: `${menuHeight}px`,
      maxHeight: `${menuHeight}px`,
      ['--doc-write-type-split-max' as string]: `${availableSplitHeight}px`,
    })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updateMenuPosition()
    const raf = window.requestAnimationFrame(updateMenuPosition)
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open, updateMenuPosition, hoverTypeId])

  useEffect(() => {
    if (!open) return
    const menu = menuRef.current
    if (!menu) return

    const stopMenuWheelBubble = (event: WheelEvent) => {
      event.stopPropagation()
    }

    menu.addEventListener('wheel', stopMenuWheelBubble, { capture: true })
    return () => menu.removeEventListener('wheel', stopMenuWheelBubble, { capture: true })
  }, [open])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
      setHoverTypeId(null)
    }

    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', handlePointerDown)
    }, 0)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [open])

  const stopColumnWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.stopPropagation()
    const column = event.currentTarget
    const { scrollTop, scrollHeight, clientHeight } = column
    const delta = event.deltaY
    const atTop = scrollTop <= 0 && delta < 0
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && delta > 0
    if (!atTop && !atBottom) {
      event.preventDefault()
    }
  }, [])

  const selectType = (type: DocumentWriteType, subtypeIdValue: string | null = null) => {
    onChange(type.id, subtypeIdValue)
    setOpen(false)
    setHoverTypeId(null)
  }

  return (
    <div className="doc-write-type-picker" ref={rootRef}>
      <span className="doc-write-type-label">公文类型</span>
      <button
        ref={triggerRef}
        type="button"
        className="doc-write-type-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => {
            if (value) return false
            setMenuStyle({ visibility: 'hidden' })
            return true
          })
        }}
      >
        {resolved.label}
        <ChevronDown size={14} />
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              className="doc-write-type-menu doc-write-type-menu-portal"
              role="listbox"
              style={menuStyle}
            >
              <button
                type="button"
                className={`doc-write-type-item${typeId === 'auto' ? ' active' : ''}`}
                onMouseEnter={() => setHoverTypeId(null)}
                onClick={() => selectType(DOCUMENT_WRITE_AUTO_TYPE)}
              >
                自动识别
              </button>
              <div className="doc-write-type-menu-split">
                <div className="doc-write-type-column" onWheel={stopColumnWheel}>
                  {DOCUMENT_WRITE_TYPES.map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      className={`doc-write-type-item${typeId === type.id ? ' active' : ''}${hoverTypeId === type.id ? ' hover' : ''}`}
                      onMouseEnter={() => setHoverTypeId(type.id)}
                      onClick={() => {
                        if (type.subtypes?.length) {
                          selectType(type, type.subtypes[0].id)
                        } else {
                          selectType(type)
                        }
                      }}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
                {hoverType?.subtypes?.length ? (
                  <div className="doc-write-type-subcolumn" onWheel={stopColumnWheel}>
                    {hoverType.subtypes.map((subtype) => (
                      <button
                        key={subtype.id}
                        type="button"
                        className={`doc-write-type-subitem${typeId === hoverType.id && subtypeId === subtype.id ? ' active' : ''}`}
                        onClick={() => selectType(hoverType, subtype.id)}
                      >
                        {subtype.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

const AUTO_REFERENCE_HELP =
  '点击「开启」后，会把左侧编辑器里当前正文自动当作参考材料，一并发给 AI'

const SAVE_MATERIALS_HELP = '勾选后，下次再打开弹窗会自动恢复当前提示词和所有设置'

const HELP_POPOVER_GAP = 8

function WriteHelpButton({
  ariaLabel,
  text,
  disabled,
}: {
  ariaLabel: string
  text: string
  disabled?: boolean
}) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({ visibility: 'hidden' })

  const updatePosition = useCallback(() => {
    const button = buttonRef.current
    const popover = popoverRef.current
    if (!button || !popover) return

    const rect = button.getBoundingClientRect()
    const popoverRect = popover.getBoundingClientRect()
    const popoverHeight = popoverRect.height || 72
    const popoverWidth = popoverRect.width || 240
    const spaceBelow = window.innerHeight - rect.bottom - HELP_POPOVER_GAP
    const spaceAbove = rect.top - HELP_POPOVER_GAP
    const openBelow = spaceBelow >= popoverHeight || spaceBelow >= spaceAbove

    const top = openBelow
      ? rect.bottom + HELP_POPOVER_GAP
      : rect.top - HELP_POPOVER_GAP
    const transform = openBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'

    const margin = 12
    const halfWidth = Math.min(popoverWidth / 2, 140)
    const left = Math.max(
      margin + halfWidth,
      Math.min(rect.left + rect.width / 2, window.innerWidth - margin - halfWidth),
    )

    setPopoverStyle({
      position: 'fixed',
      top,
      left,
      transform,
      zIndex: 4000,
      visibility: 'visible',
    })
  }, [])

  useLayoutEffect(() => {
    if (!helpOpen) return
    updatePosition()
    const raf = window.requestAnimationFrame(updatePosition)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [helpOpen, updatePosition, text])

  useEffect(() => {
    if (!helpOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setHelpOpen(false)
    }

    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', handlePointerDown)
    }, 0)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [helpOpen])

  return (
    <div className="doc-write-help-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="doc-write-help-btn"
        aria-label={ariaLabel}
        aria-expanded={helpOpen}
        disabled={disabled}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setHelpOpen((open) => {
            if (open) return false
            setPopoverStyle({ visibility: 'hidden' })
            return true
          })
        }}
      >
        <CircleHelp size={14} />
      </button>
      {helpOpen
        ? createPortal(
            <div
              ref={popoverRef}
              className="doc-write-help-popover doc-write-help-popover-portal"
              role="tooltip"
              style={popoverStyle}
            >
              {text}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

function AutoReferenceControl({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="doc-write-auto-reference">
      <label className="doc-write-toggle">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={disabled}
        />
        <span className="doc-write-toggle-track" />
        自动添加参考
      </label>
      <WriteHelpButton
        ariaLabel="自动添加参考说明"
        text={AUTO_REFERENCE_HELP}
        disabled={disabled}
      />
    </div>
  )
}

function ReferenceFileList({
  files,
  onRemove,
  emptyLabel,
}: {
  files: WriteReferenceFile[]
  onRemove: (id: string) => void
  emptyLabel: string
}) {
  if (files.length === 0) {
    return <p className="doc-write-file-empty">{emptyLabel}</p>
  }

  return (
    <ul className="doc-write-file-list">
      {files.map((file) => (
        <li key={file.id} className="doc-write-file-item">
          <FileText size={14} />
          <span className="doc-write-file-name" title={file.name}>
            {file.name}
          </span>
          <button type="button" className="doc-write-file-remove" aria-label="移除" onClick={() => onRemove(file.id)}>
            <Trash2 size={13} />
          </button>
        </li>
      ))}
    </ul>
  )
}

export default function DocumentWriteModal({
  open,
  onClose,
  currentEditorContent = '',
  activeTemplateId = null,
  onGenerated,
}: DocumentWriteModalProps) {
  const saved = loadWriteMaterials()
  const [prompt, setPrompt] = useState(saved.prompt || DEFAULT_WRITE_PROMPT)
  const [typeId, setTypeId] = useState(saved.typeId || 'auto')
  const [subtypeId, setSubtypeId] = useState<string | null>(saved.subtypeId)
  const [autoReference, setAutoReference] = useState(saved.autoReference)
  const [saveMaterials, setSaveMaterials] = useState(saved.saveMaterials)
  const [referenceFiles, setReferenceFiles] = useState<WriteReferenceFile[]>(saved.referenceFiles.slice(0, MAX_REFERENCE_FILES))
  const [referencePanelOpen, setReferencePanelOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const savedDraft = loadWriteMaterials()
    setPrompt(savedDraft.prompt || DEFAULT_WRITE_PROMPT)
    setAutoReference(savedDraft.autoReference)
    setSaveMaterials(savedDraft.saveMaterials)
    setReferenceFiles(savedDraft.referenceFiles.slice(0, MAX_REFERENCE_FILES))
    setReferencePanelOpen(savedDraft.referenceFiles.length > 0)
    setError(null)

    if (activeTemplateId) {
      const linked = findWriteTypeSelectionByTemplateId(activeTemplateId)
      if (linked) {
        setTypeId(linked.typeId)
        setSubtypeId(linked.subtypeId ?? null)
        return
      }
    }

    setTypeId(savedDraft.typeId || 'auto')
    setSubtypeId(savedDraft.subtypeId)
  }, [open, activeTemplateId])

  const linkedTemplate = activeTemplateId ? getDocumentTemplateById(activeTemplateId) : undefined
  const linkedTypeLabel = useMemo(() => {
    if (!activeTemplateId) return null
    const selection = findWriteTypeSelectionByTemplateId(activeTemplateId)
    if (!selection) return linkedTemplate?.name ?? null
    return resolveWriteTypeSelection(selection).label
  }, [activeTemplateId, linkedTemplate?.name])

  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, busy, onClose])

  const persistDraft = useCallback(() => {
    saveWriteMaterials({
      prompt,
      autoReference,
      saveMaterials,
      referenceFiles,
      typeId,
      subtypeId,
    })
  }, [prompt, autoReference, saveMaterials, referenceFiles, typeId, subtypeId])

  const handleUploadReference = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    setError(null)

    const file = files[0]
    try {
      const text = await readWriteReferenceFile(file)
      setReferenceFiles([{ id: createFileId(), name: file.name, text }])
      setReferencePanelOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '文件读取失败')
    }
  }, [])

  const runGenerate = useCallback(
    async (mode: DocumentWriteMode) => {
      if (!prompt.trim()) {
        setError('请先填写写作需求')
        return
      }
      if (!isDeepSeekConfigured()) {
        setError('未配置 DeepSeek：请在 .env.local 中设置 VITE_DEEPSEEK_API_KEY 后重启 dev')
        return
      }

      setBusy(true)
      setError(null)
      persistDraft()

      try {
        const referenceTexts: string[] = []
        if (autoReference && currentEditorContent.trim()) {
          referenceTexts.push(`【当前编辑器内容】\n${currentEditorContent.trim()}`)
        }

        const result = await generateDocumentWithAi({
          prompt,
          typeSelection: { typeId, subtypeId },
          activeTemplateId,
          referenceTexts,
          imitationTexts: referenceFiles.map((file) => file.text),
          mode,
        })

        const titleMatch = prompt.match(/标题是[【\[]([^】\]]+)[】\]]/)
        onGenerated({
          content: result.content,
          templateId: result.templateId ?? null,
          mode: result.mode,
          title: titleMatch?.[1]?.trim() ?? '公文',
        })
        onClose()
      } catch (err) {
        setError(err instanceof Error ? err.message : '生成失败，请重试')
      } finally {
        setBusy(false)
      }
    },
    [
      prompt,
      typeId,
      subtypeId,
      referenceFiles,
      autoReference,
      currentEditorContent,
      activeTemplateId,
      persistDraft,
      onGenerated,
      onClose,
    ],
  )

  if (!open) return null

  return (
    <div className="doc-write-overlay" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="doc-write-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-write-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="doc-write-header">
          <div className="doc-write-brand">
            <span className="doc-write-logo" aria-hidden="true">
              A
            </span>
            <h2 id="doc-write-title">写公文</h2>
          </div>
          <button type="button" className="doc-write-close" aria-label="关闭" disabled={busy} onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="doc-write-body">
          {linkedTemplate ? (
            <div className="doc-write-template-link" role="status">
              已关联右侧模板：<strong>{linkedTemplate.name}</strong>
              {linkedTypeLabel ? `（${linkedTypeLabel}）` : ''}
            </div>
          ) : null}

          <textarea
            className="doc-write-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={DEFAULT_WRITE_PROMPT}
            rows={4}
            disabled={busy}
          />

          <div className="doc-write-toolbar">
            <div className="doc-write-toolbar-left">
              <button
                type="button"
                className={`doc-write-icon-btn${referencePanelOpen ? ' active' : ''}`}
                title={referencePanelOpen ? '收起参考文档' : '展开参考文档'}
                aria-expanded={referencePanelOpen}
                disabled={busy}
                onClick={() => setReferencePanelOpen((value) => !value)}
              >
                <Plus size={16} />
              </button>
              <WriteTypePicker
                typeId={typeId}
                subtypeId={subtypeId}
                onChange={(nextTypeId, nextSubtypeId) => {
                  setTypeId(nextTypeId)
                  setSubtypeId(nextSubtypeId)
                }}
              />
            </div>
            <AutoReferenceControl
              checked={autoReference}
              onChange={setAutoReference}
              disabled={busy}
            />
            <div className="doc-write-toolbar-right">
              <button
                type="button"
                className="btn btn-sm btn-primary doc-write-btn-primary"
                disabled={busy}
                onClick={() => void runGenerate('full')}
              >
                {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                生成内容
              </button>
            </div>
          </div>

          {error ? <p className="doc-write-error">{error}</p> : null}

          {referencePanelOpen ? (
            <div className="doc-write-materials doc-write-materials-single">
              <section className="doc-write-material-block">
                <div className="doc-write-material-head">
                  <h3>参考文档</h3>
                </div>
                <input
                  ref={referenceInputRef}
                  type="file"
                  accept=".docx,.txt,.md"
                  hidden
                  onChange={(event) => {
                    void handleUploadReference(event.target.files)
                    event.target.value = ''
                  }}
                />
                <button
                  type="button"
                  className="doc-write-upload-zone"
                  disabled={busy}
                  onClick={() => referenceInputRef.current?.click()}
                >
                  <ReferenceFileList
                    files={referenceFiles}
                    onRemove={(id) => setReferenceFiles((prev) => prev.filter((file) => file.id !== id))}
                    emptyLabel="点击上传参考文档（.docx / .txt，最多 1 个，AI 将参照其结构与文风仿写）"
                  />
                </button>
              </section>
            </div>
          ) : null}
        </div>

        <footer className="doc-write-footer">
          <div className="doc-write-save-row">
            <label className="doc-write-save-check">
              <input
                type="checkbox"
                checked={saveMaterials}
                onChange={(event) => setSaveMaterials(event.target.checked)}
                disabled={busy}
              />
              保存素材至下次创作
            </label>
            <WriteHelpButton
              ariaLabel="保存素材至下次创作说明"
              text={SAVE_MATERIALS_HELP}
              disabled={busy}
            />
          </div>
        </footer>
      </div>
    </div>
  )
}
