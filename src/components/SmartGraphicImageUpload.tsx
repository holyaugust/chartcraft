import { useCallback, useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { readImageFileAsDataUrl } from '../utils/smartGraphicImage'

interface SmartGraphicImageUploadProps {
  busy?: boolean
  previewUrl?: string
  onGenerate: (imageDataUrl: string, hint: string) => void | Promise<void>
}

export default function SmartGraphicImageUpload({ busy, previewUrl, onGenerate }: SmartGraphicImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [hint, setHint] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const displayPreview = localPreview ?? previewUrl ?? null

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)
      setLoading(true)
      try {
        const dataUrl = await readImageFileAsDataUrl(file)
        setLocalPreview(dataUrl)
        await onGenerate(dataUrl, hint)
      } catch (err) {
        setError(err instanceof Error ? err.message : '图片处理失败')
      } finally {
        setLoading(false)
      }
    },
    [hint, onGenerate],
  )

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      setDragOver(false)
      if (busy || loading) return
      const file = event.dataTransfer.files[0]
      if (file) void handleFile(file)
    },
    [busy, handleFile, loading],
  )

  const clearPreview = () => {
    setLocalPreview(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <section className="sg-image-upload-block">
      <h3>
        <ImagePlus size={16} />
        从图片生成
      </h3>
      <p className="sg-image-upload-desc">
        上传截图后自动 OCR 识别并生成图形。列表类图片会匹配并列版式；四列仪表盘需截图本身含四栏结构。识别完成后可点「重新识别」。
      </p>

      <div
        className={`sg-image-drop-zone${dragOver ? ' drag-over' : ''}${loading || busy ? ' loading' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => {
          if (!busy && !loading) inputRef.current?.click()
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (!busy && !loading) inputRef.current?.click()
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />

        {loading || busy ? (
          <div className="sg-image-drop-loading">
            <Loader2 size={28} className="spin" />
            <span>正在识别图片…</span>
          </div>
        ) : displayPreview ? (
          <div className="sg-image-drop-preview">
            <img src={displayPreview} alt="上传的参考图" />
            <button
              type="button"
              className="sg-image-clear-btn"
              title="清除图片"
              onClick={(event) => {
                event.stopPropagation()
                clearPreview()
              }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="sg-image-drop-empty">
            <ImagePlus size={28} />
            <strong>拖拽或点击上传图片</strong>
            <span>JPG / PNG / WebP，建议清晰截图</span>
          </div>
        )}
      </div>

      <textarea
        className="sg-ai-input sg-image-hint"
        rows={2}
        placeholder="可选：补充说明，如「这是 3 条项目列表，标题是重点项目明细」"
        value={hint}
        disabled={busy || loading}
        onChange={(event) => setHint(event.target.value)}
        onClick={(event) => event.stopPropagation()}
      />

      {displayPreview && !loading && !busy ? (
        <button
          type="button"
          className="btn btn-primary btn-sm sg-ai-submit"
          onClick={() => void onGenerate(displayPreview, hint)}
        >
          <ImagePlus size={14} />
          重新识别
        </button>
      ) : null}

      {error ? <p className="sg-image-upload-error">{error}</p> : null}
    </section>
  )
}
