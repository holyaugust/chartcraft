import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, Sparkles, Wand2, X } from 'lucide-react'
import {
  DOCUMENT_PROOFREAD_GENRES,
  buildSuggestedProofreadPrompt,
  type DocumentProofreadGenreId,
} from '../data/documentProofreadGenres'
import {
  detectDocumentGenre,
  refineDocumentGenreWithAi,
  type GenreDetectionResult,
} from '../utils/documentGenreDetect'
import type { ProofreadMode, ProofreadPromptContext } from '../utils/deepseek'
import { isDeepSeekConfigured } from '../utils/deepseek'

export interface ProofreadSetupSubmitPayload {
  mode: ProofreadMode
  promptContext: ProofreadPromptContext
}

interface DocumentProofreadSetupModalProps {
  open: boolean
  mode: ProofreadMode
  content: string
  isTableDocument: boolean
  onClose: () => void
  onSubmit: (payload: ProofreadSetupSubmitPayload) => void
}

const CONFIDENCE_LABEL: Record<GenreDetectionResult['confidence'], string> = {
  high: '置信度高',
  medium: '置信度中',
  low: '置信度低',
}

function buildPromptContext(
  genreId: DocumentProofreadGenreId,
  detection: GenreDetectionResult,
  customInstructions: string,
): ProofreadPromptContext {
  const genre = DOCUMENT_PROOFREAD_GENRES.find((item) => item.id === genreId)
  return {
    genreId,
    genreLabel: genre?.label ?? detection.label,
    customInstructions: customInstructions.trim(),
  }
}

export default function DocumentProofreadSetupModal({
  open,
  mode,
  content,
  isTableDocument,
  onClose,
  onSubmit,
}: DocumentProofreadSetupModalProps) {
  const [detection, setDetection] = useState<GenreDetectionResult | null>(null)
  const [genreId, setGenreId] = useState<DocumentProofreadGenreId>('general')
  const [promptText, setPromptText] = useState('')
  const [promptDirty, setPromptDirty] = useState(false)
  const [aiRefining, setAiRefining] = useState(false)

  const applyGenreTemplate = useCallback(
    (nextGenreId: DocumentProofreadGenreId, nextDetection: GenreDetectionResult, force = false) => {
      setGenreId(nextGenreId)
      if (!force && promptDirty) return
      setPromptText(
        buildSuggestedProofreadPrompt(nextGenreId, mode, {
          isTableDocument,
          detectionReasons: nextDetection.reasons,
        }),
      )
      setPromptDirty(false)
    },
    [isTableDocument, mode, promptDirty],
  )

  useEffect(() => {
    if (!open) return

    let cancelled = false
    const local = detectDocumentGenre(content, isTableDocument)
    setDetection(local)
    applyGenreTemplate(local.genreId, local, true)

    // 本地置信度不够时自动 AI 精识别，避免首次打开就判错文体
    const shouldAutoRefine =
      isDeepSeekConfigured() &&
      (local.confidence !== 'high' || local.genreId === 'general')

    if (!shouldAutoRefine) return

    setAiRefining(true)
    void refineDocumentGenreWithAi(content, local)
      .then((refined) => {
        if (cancelled) return
        setDetection(refined)
        applyGenreTemplate(refined.genreId, refined, true)
      })
      .catch(() => {
        /* 自动精识别失败时保留本地结果 */
      })
      .finally(() => {
        if (!cancelled) setAiRefining(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, content, isTableDocument, applyGenreTemplate])

  const handleGenreChange = (nextGenreId: DocumentProofreadGenreId) => {
    const nextDetection: GenreDetectionResult = {
      genreId: nextGenreId,
      label: DOCUMENT_PROOFREAD_GENRES.find((item) => item.id === nextGenreId)?.label ?? '通用文稿',
      confidence: 'medium',
      reasons: ['用户手动选择文体'],
      scores: detection?.scores ?? [],
    }
    setDetection(nextDetection)
    applyGenreTemplate(nextGenreId, nextDetection, true)
  }

  const handleAiRefine = async () => {
    if (!detection || !isDeepSeekConfigured()) return
    setAiRefining(true)
    try {
      const refined = await refineDocumentGenreWithAi(content, detection)
      setDetection(refined)
      applyGenreTemplate(refined.genreId, refined, !promptDirty)
    } finally {
      setAiRefining(false)
    }
  }

  const handleResetPrompt = () => {
    if (!detection) return
    setPromptText(
      buildSuggestedProofreadPrompt(genreId, mode, {
        isTableDocument,
        detectionReasons: detection.reasons,
      }),
    )
    setPromptDirty(false)
  }

  const handleSubmit = () => {
    if (!detection || !promptText.trim()) return
    onSubmit({
      mode: 'standard',
      promptContext: buildPromptContext(genreId, detection, promptText),
    })
  }

  if (!open) return null

  return createPortal(
    <div className="doc-write-overlay" role="presentation" onMouseDown={onClose}>
      <div
        className="doc-write-modal doc-proofread-setup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="doc-proofread-setup-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="doc-write-header">
          <div className="doc-write-brand">
            <span className="doc-write-logo">
              <Sparkles size={16} />
            </span>
            <div>
              <h2 id="doc-proofread-setup-title">智能校对 · 校对方案</h2>
              <p className="doc-proofread-setup-subtitle">
                {aiRefining
                  ? '正在自动识别文体并生成校对提示词…'
                  : '平台已识别文体并生成侧重提示词，您可修改后提交'}
              </p>
            </div>
          </div>
          <button type="button" className="doc-write-close" onClick={onClose} aria-label="关闭">
            <X size={16} />
          </button>
        </header>

        <div className="doc-write-body">
          <section className="doc-proofread-genre-section">
            <div className="doc-proofread-genre-row">
              <label htmlFor="proofread-genre-select">识别文体</label>
              <select
                id="proofread-genre-select"
                className="doc-proofread-genre-select"
                value={genreId}
                onChange={(event) => handleGenreChange(event.target.value as DocumentProofreadGenreId)}
              >
                {DOCUMENT_PROOFREAD_GENRES.map((genre) => (
                  <option key={genre.id} value={genre.id}>
                    {genre.label}
                  </option>
                ))}
              </select>
              {detection ? (
                <span className={`doc-proofread-confidence conf-${detection.confidence}`}>
                  {CONFIDENCE_LABEL[detection.confidence]}
                </span>
              ) : null}
              <button
                type="button"
                className="btn btn-sm btn-ghost doc-proofread-ai-refine"
                disabled={aiRefining || !isDeepSeekConfigured()}
                title={isDeepSeekConfigured() ? '使用 AI 精识别文体' : '需配置 DeepSeek API'}
                onClick={() => void handleAiRefine()}
              >
                {aiRefining ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />}
                AI 精识别
              </button>
            </div>
            {detection?.reasons.length ? (
              <ul className="doc-proofread-reasons">
                {detection.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : (
              <p className="doc-proofread-reasons empty">暂未识别到明显文体特征，可按需选择文体类型。</p>
            )}
          </section>

          <section className="doc-proofread-prompt-section">
            <div className="doc-proofread-prompt-header">
              <label htmlFor="proofread-prompt-text">校对提示词（可编辑）</label>
              <button type="button" className="btn btn-sm btn-ghost" onClick={handleResetPrompt}>
                恢复推荐模板
              </button>
            </div>
            <textarea
              id="proofread-prompt-text"
              className="doc-proofread-prompt-textarea"
              value={promptText}
              rows={16}
              onChange={(event) => {
                setPromptText(event.target.value)
                setPromptDirty(true)
              }}
            />
            <p className="doc-proofread-prompt-hint">
              提交后将按此文体的校对侧重 + 您修改后的要求，由 AI 执行智能校对。
            </p>
          </section>
        </div>

        <footer className="doc-write-footer">
          <button type="button" className="doc-write-btn-outline" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="doc-write-btn-primary"
            disabled={!promptText.trim()}
            onClick={handleSubmit}
          >
            <Sparkles size={14} />
            开始智能校对
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
