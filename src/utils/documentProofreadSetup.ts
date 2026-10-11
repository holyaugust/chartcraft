import {
  DOCUMENT_PROOFREAD_GENRES,
  buildSuggestedProofreadPrompt,
} from '../data/documentProofreadGenres'
import {
  detectDocumentGenre,
  refineDocumentGenreWithAi,
  type GenreDetectionResult,
} from './documentGenreDetect'
import { isDeepSeekConfigured, type ProofreadMode, type ProofreadPromptContext } from './deepseek'

export interface AutoProofreadSetupResult {
  detection: GenreDetectionResult
  promptContext: ProofreadPromptContext
}

/** 后台自动识别文体并生成校对方案（与弹窗默认逻辑一致，无需用户确认） */
export async function prepareAutoProofreadSetup(options: {
  content: string
  mode: ProofreadMode
  isTableDocument?: boolean
}): Promise<AutoProofreadSetupResult> {
  const isTableDocument = options.isTableDocument ?? false
  let detection = detectDocumentGenre(options.content, isTableDocument)

  const shouldRefine =
    isDeepSeekConfigured() &&
    (detection.confidence !== 'high' || detection.genreId === 'general')

  if (shouldRefine) {
    try {
      detection = await refineDocumentGenreWithAi(options.content, detection)
    } catch {
      /* 精识别失败时保留本地结果 */
    }
  }

  const customInstructions = buildSuggestedProofreadPrompt(detection.genreId, options.mode, {
    isTableDocument,
    detectionReasons: detection.reasons,
  }).trim()

  const genre = DOCUMENT_PROOFREAD_GENRES.find((item) => item.id === detection.genreId)

  return {
    detection,
    promptContext: {
      genreId: detection.genreId,
      genreLabel: genre?.label ?? detection.label,
      customInstructions,
    },
  }
}
