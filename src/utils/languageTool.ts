import type { DocumentIssue, IssueCategory } from './documentProofread'
import { shouldSkipProofreadIssue, trimDuplicateTrailingPunctuation } from './documentProofread'

const DEFAULT_DEV_URL = '/api/languagetool/v2/check'
const DEFAULT_PROD_URL = 'https://api.languagetool.org/v2/check'
/** 公共 API 单次请求上限约 20KB，留余量按字符切分 */
const MAX_CHUNK_CHARS = 18_000

export interface LanguageToolError extends Error {
  status?: number
}

export function createLanguageToolError(message: string, status?: number): LanguageToolError {
  const error = new Error(message) as LanguageToolError
  error.name = 'LanguageToolError'
  error.status = status
  return error
}

interface LanguageToolReplacement {
  value: string
}

interface LanguageToolMatch {
  message: string
  shortMessage?: string
  offset: number
  length: number
  replacements: LanguageToolReplacement[]
  rule: {
    id: string
    category: { id: string; name: string }
  }
}

interface LanguageToolResponse {
  matches: LanguageToolMatch[]
}

let ltIssueSeq = 0

function nextLtIssueId(): string {
  ltIssueSeq += 1
  return `lt-${ltIssueSeq}`
}

export function getLanguageToolApiUrl(): string {
  const configured = import.meta.env.VITE_LANGUAGETOOL_API_URL as string | undefined
  if (configured?.trim()) return configured.trim()
  return import.meta.env.DEV ? DEFAULT_DEV_URL : DEFAULT_PROD_URL
}

export function getLanguageToolLanguage(): string {
  const configured = import.meta.env.VITE_LANGUAGETOOL_LANGUAGE as string | undefined
  return configured?.trim() || 'zh-CN'
}

function mapLanguageToolCategory(categoryId: string): IssueCategory {
  const id = categoryId.toUpperCase()
  if (id.includes('TYPO') || id === 'CONFUSED_WORDS') return 'typo'
  if (id.includes('PUNCT')) return 'punctuation'
  if (id === 'STYLE' || id === 'REDUNDANCY' || id === 'CASING' || id === 'PLAIN_ENGLISH') return 'style'
  if (id.includes('FORMAT') || id === 'WHITESPACE') return 'format'
  return 'grammar'
}

function splitTextIntoChunks(text: string, maxChars: number): Array<{ chunk: string; baseOffset: number }> {
  if (text.length <= maxChars) {
    return [{ chunk: text, baseOffset: 0 }]
  }

  const chunks: Array<{ chunk: string; baseOffset: number }> = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length)

    if (end < text.length) {
      const slice = text.slice(start, end)
      const lastParagraph = slice.lastIndexOf('\n\n')
      const lastLine = slice.lastIndexOf('\n')
      const minSplit = Math.floor(maxChars * 0.4)

      if (lastParagraph >= minSplit) {
        end = start + lastParagraph + 2
      } else if (lastLine >= minSplit) {
        end = start + lastLine + 1
      }
    }

    if (end <= start) {
      end = Math.min(start + maxChars, text.length)
    }

    chunks.push({ chunk: text.slice(start, end), baseOffset: start })
    start = end
  }

  return chunks
}

async function checkChunk(text: string, apiUrl: string, language: string): Promise<LanguageToolMatch[]> {
  const body = new URLSearchParams({
    text,
    language,
    enabledOnly: 'false',
  })

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw createLanguageToolError(
      detail ? `LanguageTool 请求失败（${response.status}）` : `LanguageTool 请求失败（${response.status}）`,
      response.status,
    )
  }

  const data = (await response.json()) as LanguageToolResponse
  return data.matches ?? []
}

function matchToIssue(text: string, match: LanguageToolMatch, baseOffset: number): DocumentIssue | null {
  const start = baseOffset + match.offset
  const end = start + match.length
  if (start < 0 || end > text.length || start >= end) return null

  const original = text.slice(start, end)
  const suggestion = trimDuplicateTrailingPunctuation(
    text,
    end,
    match.replacements[0]?.value ?? '',
  )
  const message = match.shortMessage?.trim() || match.message.trim()
  if (!message) return null
  if (shouldSkipProofreadIssue(original, suggestion)) return null

  return {
    id: nextLtIssueId(),
    category: mapLanguageToolCategory(match.rule.category.id),
    message,
    start,
    end,
    original,
    suggestion,
    autoFixable: suggestion.length > 0 && suggestion !== original,
  }
}

export async function checkWithLanguageTool(text: string): Promise<DocumentIssue[]> {
  if (!text.trim()) return []

  ltIssueSeq = 0
  const apiUrl = getLanguageToolApiUrl()
  const language = getLanguageToolLanguage()
  const chunks = splitTextIntoChunks(text, MAX_CHUNK_CHARS)
  const allMatches: Array<{ match: LanguageToolMatch; baseOffset: number }> = []

  for (const { chunk, baseOffset } of chunks) {
    const matches = await checkChunk(chunk, apiUrl, language)
    for (const match of matches) {
      allMatches.push({ match, baseOffset })
    }
  }

  const issues: DocumentIssue[] = []
  for (const { match, baseOffset } of allMatches) {
    const issue = matchToIssue(text, match, baseOffset)
    if (issue) issues.push(issue)
  }

  return issues.sort((a, b) => a.start - b.start || a.end - b.end)
}
