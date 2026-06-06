import type { DocumentIssue, IssueCategory } from './documentProofread'
import { shouldSkipProofreadIssue, trimDuplicateTrailingPunctuation } from './documentProofread'

const DEFAULT_DEV_URL = '/api/deepseek/v1/chat/completions'
const DEFAULT_PROD_URL = 'https://api.deepseek.com/v1/chat/completions'
/** 单次校对片段上限，保证 original 定位准确 */
const MAX_CHUNK_CHARS = 5_000

export interface DeepSeekError extends Error {
  status?: number
}

export function createDeepSeekError(message: string, status?: number): DeepSeekError {
  const error = new Error(message) as DeepSeekError
  error.name = 'DeepSeekError'
  error.status = status
  return error
}

interface DeepSeekIssuePayload {
  category?: string
  original?: string
  suggestion?: string
  message?: string
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string }
  }>
  error?: { message?: string }
}

let dsIssueSeq = 0

function nextDsIssueId(): string {
  dsIssueSeq += 1
  return `ds-${dsIssueSeq}`
}

export function getDeepSeekApiUrl(): string {
  const configured = import.meta.env.VITE_DEEPSEEK_API_URL as string | undefined
  if (configured?.trim()) return configured.trim()
  return import.meta.env.DEV ? DEFAULT_DEV_URL : DEFAULT_PROD_URL
}

export function getDeepSeekModel(): string {
  const configured = import.meta.env.VITE_DEEPSEEK_MODEL as string | undefined
  return configured?.trim() || 'deepseek-chat'
}

export function isDeepSeekConfigured(): boolean {
  const url = getDeepSeekApiUrl()
  if (url.startsWith('/api/')) return true
  return !!(import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined)?.trim()
}

function mapDeepSeekCategory(raw?: string): IssueCategory {
  const value = (raw ?? '').toLowerCase()
  if (value.includes('typo') || value.includes('spell')) return 'typo'
  if (value.includes('punct')) return 'punctuation'
  if (value.includes('style') || value.includes('tone')) return 'style'
  if (value.includes('format')) return 'format'
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

function buildProofreadPrompt(chunk: string): string {
  return `请校对以下中文文档片段，找出明确的错误（错别字、语法、标点、冗余表述、格式问题）。

要求：
1. 只报告确实需要修改的问题，不要为改而改，不要改变原意和风格
2. "original" 必须是原文中逐字出现的连续片段（不要编造）
3. "suggestion" 是替换后的文本；若建议删除则填空字符串
4. category 只能是：typo、grammar、punctuation、style、format
5. 若无问题，返回 {"issues":[]}
6. 不要建议「仅增删汉字与数字/百分号/符号之间空格」的修改（这类往往是格式转换产物，不是原文错误）

待校对文本：
"""
${chunk}
"""`
}

const SYSTEM_PROMPT = `你是专业的中文文档校对助手，服务于报告、公文、方案类文本。
只输出 JSON，格式为 {"issues":[{"category":"typo","original":"原文片段","suggestion":"建议","message":"简短说明"}]}。
不要输出 markdown 代码块或任何额外说明。
不要报告仅涉及汉字与数字/百分号之间空格的格式问题。`

function stripMarkdownFence(content: string): string {
  let text = content.trim()
  if (!text.startsWith('```')) return text

  text = text.replace(/^```(?:json|JSON)?\s*\n?/, '')
  text = text.replace(/\n?```[\s\S]*$/, '')
  return text.trim()
}

/** 从文本中提取第一个完整的 JSON 对象或数组 */
function extractJsonSnippet(text: string): string | null {
  const objectStart = text.indexOf('{')
  const arrayStart = text.indexOf('[')
  let start = -1
  let openChar = ''
  let closeChar = ''

  if (objectStart >= 0 && (arrayStart < 0 || objectStart < arrayStart)) {
    start = objectStart
    openChar = '{'
    closeChar = '}'
  } else if (arrayStart >= 0) {
    start = arrayStart
    openChar = '['
    closeChar = ']'
  } else {
    return null
  }

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === openChar) depth += 1
    if (ch === closeChar) {
      depth -= 1
      if (depth === 0) return text.slice(start, i + 1)
    }
  }

  return null
}

function tryParseJson(text: string): unknown {
  const trimmed = stripMarkdownFence(text)
  try {
    return JSON.parse(trimmed)
  } catch {
    const snippet = extractJsonSnippet(trimmed)
    if (!snippet) throw new Error('invalid json')
    const parsed = JSON.parse(snippet)
    if (typeof parsed === 'string') {
      return JSON.parse(parsed)
    }
    return parsed
  }
}

function readIssueField(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function normalizeIssuePayload(raw: unknown): DeepSeekIssuePayload | null {
  if (!raw || typeof raw !== 'object') return null

  const record = raw as Record<string, unknown>
  const original = readIssueField(record, ['original', '原文', 'source', 'text', 'wrong', 'error_text'])
  const message = readIssueField(record, ['message', '说明', 'reason', 'desc', 'description', 'comment', 'msg'])
  if (!original || !message) return null

  return {
    category: readIssueField(record, ['category', 'type', '类型', 'kind']),
    original,
    suggestion: readIssueField(record, ['suggestion', '建议', 'replacement', 'correct', 'fix', 'revised']),
    message,
  }
}

function normalizeIssueList(parsed: unknown): DeepSeekIssuePayload[] {
  if (!parsed) return []

  if (Array.isArray(parsed)) {
    return parsed.map(normalizeIssuePayload).filter((item): item is DeepSeekIssuePayload => item !== null)
  }

  if (typeof parsed !== 'object') return []

  const record = parsed as Record<string, unknown>
  const listKeys = ['issues', 'Issues', 'items', 'results', 'data', 'problems', '问题', '校对结果', 'suggestions']

  for (const key of listKeys) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value.map(normalizeIssuePayload).filter((item): item is DeepSeekIssuePayload => item !== null)
    }
  }

  const single = normalizeIssuePayload(record)
  return single ? [single] : []
}

function parseDeepSeekContent(content: string): DeepSeekIssuePayload[] {
  const parsed = tryParseJson(content)
  return normalizeIssueList(parsed)
}

function findOriginalPosition(
  text: string,
  original: string,
  occupied: Array<{ start: number; end: number }>,
): { start: number; end: number } | null {
  if (!original) return null

  let from = 0
  while (from <= text.length - original.length) {
    const start = text.indexOf(original, from)
    if (start < 0) return null
    const end = start + original.length
    const overlaps = occupied.some((range) => start < range.end && end > range.start)
    if (!overlaps) return { start, end }
    from = start + 1
  }

  return null
}

function formatDeepSeekErrorMessage(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('insufficient balance') || lower.includes('余额不足')) {
    return 'DeepSeek 账户余额不足，请前往 platform.deepseek.com 充值后再试'
  }
  if (lower.includes('invalid api key') || lower.includes('authentication')) {
    return 'DeepSeek API Key 无效，请检查 .env.local 中的 DEEPSEEK_API_KEY'
  }
  if (lower.includes('rate limit')) {
    return 'DeepSeek 请求过于频繁，请稍后再试'
  }
  return `DeepSeek 请求失败：${raw}`
}

async function requestChatCompletion(userPrompt: string): Promise<string> {
  const apiUrl = getDeepSeekApiUrl()
  const useProxy = apiUrl.startsWith('/api/')
  const apiKey = (import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined)?.trim()

  if (!useProxy && !apiKey) {
    throw createDeepSeekError('未配置 DeepSeek API Key，请在 .env.local 中设置 VITE_DEEPSEEK_API_KEY')
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!useProxy && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: getDeepSeekModel(),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    }),
  })

  let data: ChatCompletionResponse
  try {
    data = (await response.json()) as ChatCompletionResponse
  } catch {
    throw createDeepSeekError('DeepSeek 响应不是有效 JSON，请检查网络或 API 配置')
  }

  if (!response.ok) {
    const detail = data.error?.message ?? `HTTP ${response.status}`
    throw createDeepSeekError(formatDeepSeekErrorMessage(detail), response.status)
  }

  const content = data.choices?.[0]?.message?.content
  if (!content?.trim()) {
    throw createDeepSeekError('DeepSeek 返回内容为空')
  }

  return content
}

async function checkChunkAtOffset(
  fullText: string,
  chunk: string,
  baseOffset: number,
): Promise<DocumentIssue[]> {
  let content = await requestChatCompletion(buildProofreadPrompt(chunk))
  let payloads: DeepSeekIssuePayload[]

  try {
    payloads = parseDeepSeekContent(content)
  } catch {
    // 部分模型仍会输出 markdown 或夹带说明，重试一次并强调 JSON
    content = await requestChatCompletion(
      `${buildProofreadPrompt(chunk)}\n\n请严格只输出一个 JSON 对象，不要 markdown 代码块，不要任何前后说明。格式：{"issues":[]}`,
    )
    try {
      payloads = parseDeepSeekContent(content)
    } catch {
      throw createDeepSeekError('DeepSeek 返回格式无法解析，请重试')
    }
  }

  const chunkText = fullText.slice(baseOffset, baseOffset + chunk.length)
  const occupied: Array<{ start: number; end: number }> = []
  const issues: DocumentIssue[] = []

  for (const payload of payloads) {
    const original = payload.original?.trim()
    const message = payload.message?.trim()
    if (!original || !message) continue

    const localRange = findOriginalPosition(chunkText, original, occupied)
    if (!localRange) continue

    occupied.push(localRange)
    const start = baseOffset + localRange.start
    const end = baseOffset + localRange.end
    const suggestion = trimDuplicateTrailingPunctuation(
      fullText,
      end,
      payload.suggestion ?? '',
    )
    const resolvedOriginal = fullText.slice(start, end)
    if (suggestion === resolvedOriginal) continue
    if (shouldSkipProofreadIssue(resolvedOriginal, suggestion)) continue

    issues.push({
      id: nextDsIssueId(),
      category: mapDeepSeekCategory(payload.category),
      message,
      start,
      end,
      original: resolvedOriginal,
      suggestion,
      autoFixable: true,
    })
  }

  return issues
}

export async function checkWithDeepSeek(text: string): Promise<DocumentIssue[]> {
  if (!text.trim()) return []

  dsIssueSeq = 0
  const chunks = splitTextIntoChunks(text, MAX_CHUNK_CHARS)
  const globalOccupied: Array<{ start: number; end: number }> = []
  const issues: DocumentIssue[] = []

  for (const { chunk, baseOffset } of chunks) {
    const chunkIssues = await checkChunkAtOffset(text, chunk, baseOffset)

    for (const issue of chunkIssues) {
      const overlaps = globalOccupied.some((range) => issue.start < range.end && issue.end > range.start)
      if (overlaps) continue
      globalOccupied.push({ start: issue.start, end: issue.end })
      issues.push(issue)
    }
  }

  return issues.sort((a, b) => a.start - b.start || a.end - b.end)
}
