import { useCallback, useEffect, useRef, useState } from 'react'
import {
  X,
  Plus,
  List,
  Loader2,
  ChevronDown,
  FileText,
  Trash2,
  Sparkles,
} from 'lucide-react'
import {
  DOCUMENT_WRITE_AUTO_TYPE,
  DOCUMENT_WRITE_TYPES,
  resolveWriteTypeSelection,
  type DocumentWriteType,
} from '../data/documentWriteTypes'
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
  onGenerated: (payload: {
    content: string
    templateId?: string | null
    mode: DocumentWriteMode
    title: string
  }) => void
}

const MAX_REFERENCE_FILES = 3
const MAX_IMITATION_FILES = 2

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
  const rootRef = useRef<HTMLDivElement>(null)

  const resolved = resolveWriteTypeSelection({ typeId, subtypeId })
  const hoverType =
    DOCUMENT_WRITE_TYPES.find((item) => item.id === hoverTypeId) ??
    (typeId !== 'auto' ? DOCUMENT_WRITE_TYPES.find((item) => item.id === typeId) : null)

  useEffect(() => {
    if (!open) return
    const handleClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selectType = (type: DocumentWriteType, subtypeIdValue: string | null = null) => {
    onChange(type.id, subtypeIdValue)
    setOpen(false)
    setHoverTypeId(null)
  }

  return (
    <div className="doc-write-type-picker" ref={rootRef}>
      <span className="doc-write-type-label">公文类型</span>
      <button
        type="button"
        className="doc-write-type-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {resolved.label}
        <ChevronDown size={14} />
      </button>

      {open ? (
        <div className="doc-write-type-menu">
          <button
            type="button"
            className={`doc-write-type-item${typeId === 'auto' ? ' active' : ''}`}
            onMouseEnter={() => setHoverTypeId(null)}
            onClick={() => selectType(DOCUMENT_WRITE_AUTO_TYPE)}
          >
            自动识别
          </button>
          <div className="doc-write-type-menu-split">
            <div className="doc-write-type-column">
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
              <div className="doc-write-type-subcolumn">
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
        </div>
      ) : null}
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
  onGenerated,
}: DocumentWriteModalProps) {
  const saved = loadWriteMaterials()
  const [prompt, setPrompt] = useState(saved.prompt || DEFAULT_WRITE_PROMPT)
  const [typeId, setTypeId] = useState(saved.typeId || 'auto')
  const [subtypeId, setSubtypeId] = useState<string | null>(saved.subtypeId)
  const [autoReference, setAutoReference] = useState(saved.autoReference)
  const [saveMaterials, setSaveMaterials] = useState(saved.saveMaterials)
  const [referenceFiles, setReferenceFiles] = useState<WriteReferenceFile[]>(saved.referenceFiles)
  const [imitationFiles, setImitationFiles] = useState<WriteReferenceFile[]>(saved.imitationFiles)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const referenceInputRef = useRef<HTMLInputElement>(null)
  const imitationInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const savedDraft = loadWriteMaterials()
    setPrompt(savedDraft.prompt || DEFAULT_WRITE_PROMPT)
    setTypeId(savedDraft.typeId || 'auto')
    setSubtypeId(savedDraft.subtypeId)
    setAutoReference(savedDraft.autoReference)
    setSaveMaterials(savedDraft.saveMaterials)
    setReferenceFiles(savedDraft.referenceFiles)
    setImitationFiles(savedDraft.imitationFiles)
    setError(null)
  }, [open])

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
      imitationFiles,
      typeId,
      subtypeId,
    })
  }, [prompt, autoReference, saveMaterials, referenceFiles, imitationFiles, typeId, subtypeId])

  const handleUpload = useCallback(
    async (files: FileList | null, kind: 'reference' | 'imitation') => {
      if (!files?.length) return
      setError(null)

      const max = kind === 'reference' ? MAX_REFERENCE_FILES : MAX_IMITATION_FILES
      const current = kind === 'reference' ? referenceFiles : imitationFiles
      const remaining = max - current.length
      if (remaining <= 0) {
        setError(kind === 'reference' ? `参考文档最多 ${MAX_REFERENCE_FILES} 个` : `仿写文档最多 ${MAX_IMITATION_FILES} 个`)
        return
      }

      const toAdd: WriteReferenceFile[] = []
      for (const file of Array.from(files).slice(0, remaining)) {
        try {
          const text = await readWriteReferenceFile(file)
          toAdd.push({ id: createFileId(), name: file.name, text })
        } catch (err) {
          setError(err instanceof Error ? err.message : '文件读取失败')
        }
      }

      if (toAdd.length === 0) return
      if (kind === 'reference') {
        setReferenceFiles((prev) => [...prev, ...toAdd])
      } else {
        setImitationFiles((prev) => [...prev, ...toAdd])
      }
    },
    [imitationFiles, referenceFiles],
  )

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
        const referenceTexts = referenceFiles.map((file) => file.text)
        if (autoReference && currentEditorContent.trim()) {
          referenceTexts.unshift(`【当前编辑器内容】\n${currentEditorContent.trim()}`)
        }

        const result = await generateDocumentWithAi({
          prompt,
          typeSelection: { typeId, subtypeId },
          referenceTexts,
          imitationTexts: imitationFiles.map((file) => file.text),
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
      imitationFiles,
      autoReference,
      currentEditorContent,
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
                className="doc-write-icon-btn"
                title="重置为默认提示"
                disabled={busy}
                onClick={() => setPrompt(DEFAULT_WRITE_PROMPT)}
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                className="doc-write-icon-btn"
                title="插入大纲占位"
                disabled={busy}
                onClick={() =>
                  setPrompt((prev) =>
                    prev.includes('大纲')
                      ? prev
                      : `${prev.trim()}\n\n请先生成包含「一、二、三」层级的大纲要点。`,
                  )
                }
              >
                <List size={16} />
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
            <div className="doc-write-toolbar-right">
              <button
                type="button"
                className="btn btn-sm doc-write-btn-outline"
                disabled={busy}
                onClick={() => void runGenerate('outline')}
              >
                {busy ? <Loader2 size={14} className="spin" /> : null}
                生成大纲
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary doc-write-btn-primary"
                disabled={busy}
                onClick={() => void runGenerate('full')}
              >
                {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                生成全文
              </button>
            </div>
          </div>

          {error ? <p className="doc-write-error">{error}</p> : null}

          <div className="doc-write-materials">
            <section className="doc-write-material-block">
              <div className="doc-write-material-head">
                <h3>参考文档</h3>
                <label className="doc-write-toggle">
                  <input
                    type="checkbox"
                    checked={autoReference}
                    onChange={(event) => setAutoReference(event.target.checked)}
                    disabled={busy}
                  />
                  <span className="doc-write-toggle-track" />
                  自动添加参考
                </label>
              </div>
              <input
                ref={referenceInputRef}
                type="file"
                accept=".docx,.txt,.md"
                multiple
                hidden
                onChange={(event) => {
                  void handleUpload(event.target.files, 'reference')
                  event.target.value = ''
                }}
              />
              <button
                type="button"
                className="doc-write-upload-zone"
                disabled={busy || referenceFiles.length >= MAX_REFERENCE_FILES}
                onClick={() => referenceInputRef.current?.click()}
              >
                <ReferenceFileList
                  files={referenceFiles}
                  onRemove={(id) => setReferenceFiles((prev) => prev.filter((file) => file.id !== id))}
                  emptyLabel={`点击上传参考文档（.docx / .txt，最多 ${MAX_REFERENCE_FILES} 个）`}
                />
              </button>
            </section>

            <section className="doc-write-material-block">
              <div className="doc-write-material-head">
                <h3>仿写文档</h3>
              </div>
              <input
                ref={imitationInputRef}
                type="file"
                accept=".docx,.txt,.md"
                multiple
                hidden
                onChange={(event) => {
                  void handleUpload(event.target.files, 'imitation')
                  event.target.value = ''
                }}
              />
              <button
                type="button"
                className="doc-write-upload-zone"
                disabled={busy || imitationFiles.length >= MAX_IMITATION_FILES}
                onClick={() => imitationInputRef.current?.click()}
              >
                <ReferenceFileList
                  files={imitationFiles}
                  onRemove={(id) => setImitationFiles((prev) => prev.filter((file) => file.id !== id))}
                  emptyLabel={`点击上传仿写范文（最多 ${MAX_IMITATION_FILES} 个，AI 将模仿文风）`}
                />
              </button>
            </section>
          </div>
        </div>

        <footer className="doc-write-footer">
          <label className="doc-write-save-check">
            <input
              type="checkbox"
              checked={saveMaterials}
              onChange={(event) => setSaveMaterials(event.target.checked)}
              disabled={busy}
            />
            保存素材至下次创作
          </label>
        </footer>
      </div>
    </div>
  )
}
