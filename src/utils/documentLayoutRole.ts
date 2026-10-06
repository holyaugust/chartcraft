import type { LayoutGenre } from '../data/documentLayoutSpecs'
import { detectHeadingLevel } from './documentFormatNormalize'
import {
  classifyOfficialParagraph,
  type OfficialParagraphKind,
} from './docxFormattedExport'
import { TABLE_COL_SEP } from './docxTextExtract'

const CONTRACT_ARTICLE_RE = /^第.+条/u
const CONTRACT_DECIMAL_ARTICLE_RE = /^\d+\.\d+/
const CONTRACT_SIGNATURE_RE =
  /^(甲方|乙方|丙方|签字|盖章|法定代表人|授权代表)([：:]|$)/u
const FEASIBILITY_CHAPTER_RE = /^第.+章/u

function isContractArticle(line: string): boolean {
  const trimmed = line.trim()
  if (CONTRACT_ARTICLE_RE.test(trimmed)) return true
  if (CONTRACT_DECIMAL_ARTICLE_RE.test(trimmed) && !line.includes('。')) return true
  return false
}

function isContractSignature(line: string): boolean {
  return CONTRACT_SIGNATURE_RE.test(line.trim())
}

function classifyContractLine(
  line: string,
  context?: { isFirstContentLine?: boolean },
): string {
  if (isContractArticle(line)) return 'article'
  if (isContractSignature(line)) return 'signature'
  if (context?.isFirstContentLine) return 'contractTitle'
  return 'body'
}

function isFeasibilityChapter(line: string): boolean {
  const trimmed = line.trim()
  if (FEASIBILITY_CHAPTER_RE.test(trimmed)) return true
  return detectHeadingLevel(trimmed) === 'h1'
}

function classifyFeasibilityLine(
  line: string,
  context?: { isFirstContentLine?: boolean },
): string {
  if (isFeasibilityChapter(line)) return 'chapter'
  if (context?.isFirstContentLine) return 'reportTitle'
  return 'body'
}

export function layoutRoleForLine(
  genre: LayoutGenre,
  line: string,
  context?: {
    previousOfficialKind?: OfficialParagraphKind
    isFirstContentLine?: boolean
  },
): string | 'table' {
  if (line.includes(TABLE_COL_SEP)) return 'table'

  switch (genre) {
    case 'official':
      return classifyOfficialParagraph(line, context?.previousOfficialKind)
    case 'contract':
      return classifyContractLine(line, context)
    case 'feasibility':
      return classifyFeasibilityLine(line, context)
    case 'general':
      return detectHeadingLevel(line.trim()) ? 'heading' : 'body'
  }
}
