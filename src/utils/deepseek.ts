import type { DocumentIssue, IssueCategory } from './documentProofread'
import {
  getIssueFingerprint,
  getLineTextAtOffset,
  mergeProofreadIssues,
  proofreadDocument,
  shouldSkipProofreadIssue,
  trimDuplicateTrailingPunctuation,
} from './documentProofread'
import { collectStructuralProofreadIssues } from './documentStructureProofread'
import type { DocumentProofreadGenreId } from '../data/documentProofreadGenres'

export type { DocumentProofreadGenreId }

const DEFAULT_DEV_URL = '/api/deepseek/v1/chat/completions'
const DEFAULT_PROD_URL = 'https://api.deepseek.com/v1/chat/completions'
/** 写文书 / 通用文本默认：偏质量 */
const DEFAULT_WRITE_MODEL = 'deepseek-v4-pro'
/** 公文校对 / 深度审阅默认：偏质量 */
const DEFAULT_PROOFREAD_MODEL = 'deepseek-v4-pro'
/** 局部优化等轻量任务默认：偏速度 */
const DEFAULT_FAST_MODEL = 'deepseek-v4-flash'
/** 标准校对：单次片段上限，保证 original 定位准确 */
const MAX_CHUNK_CHARS = 5_000
/** 深度审阅：更小片段，便于细查逻辑 */
const MAX_DEEP_CHUNK_CHARS = 2_500
/** 深度审阅：全文复核可送入模型的最大字数（含头/中/尾） */
const MAX_HOLISTIC_CHARS = 14_000
/** 深度审阅单次输出上限（含思考时需更大） */
const DEEP_REVIEW_MAX_TOKENS = 24_576

export type ProofreadMode = 'standard' | 'deep'

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

export interface DeepSeekProofreadResult {
  issues: DocumentIssue[]
  usedLocalFallback?: boolean
  mode?: ProofreadMode
}

export interface ProofreadPromptContext {
  genreId: DocumentProofreadGenreId
  genreLabel: string
  customInstructions: string
  /** 复校：仅报硬伤 */
  rescan?: boolean
}

export interface DeepSeekProofreadOptions {
  isTableDocument?: boolean
  mode?: ProofreadMode
  /** 复校：仅报硬伤，抑制风格偏好与可改可不改项 */
  rescan?: boolean
  onProgress?: (message: string) => void
  promptContext?: ProofreadPromptContext
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string; reasoning_content?: string }
    finish_reason?: string | null
  }>
  error?: { message?: string }
}

export interface DeepSeekChatResult {
  content: string
  finishReason: string | null
}

let dsIssueSeq = 0
let deepIssueSeq = 0

function nextDsIssueId(): string {
  dsIssueSeq += 1
  return `ds-${dsIssueSeq}`
}

function nextDeepIssueId(): string {
  deepIssueSeq += 1
  return `deep-${deepIssueSeq}`
}

export function getDeepSeekApiUrl(): string {
  const configured = import.meta.env.VITE_DEEPSEEK_API_URL as string | undefined
  if (configured?.trim()) return configured.trim()
  return import.meta.env.DEV ? DEFAULT_DEV_URL : DEFAULT_PROD_URL
}

/** 通用默认模型（写文书等未单独指定时走这里）→ Pro */
export function getDeepSeekModel(): string {
  const configured = import.meta.env.VITE_DEEPSEEK_MODEL as string | undefined
  return configured?.trim() || DEFAULT_WRITE_MODEL
}

/** 写文书（生成正文）→ 默认 Pro；可用 VITE_DEEPSEEK_WRITE_MODEL 覆盖 */
export function getDeepSeekWriteModel(): string {
  const configured = import.meta.env.VITE_DEEPSEEK_WRITE_MODEL as string | undefined
  return configured?.trim() || getDeepSeekModel()
}

/** 公文智能校对与深度审阅 → 默认 Pro */
export function getDeepSeekProofreadModel(): string {
  const proofreadConfigured = import.meta.env.VITE_DEEPSEEK_PROOFREAD_MODEL as string | undefined
  if (proofreadConfigured?.trim()) return proofreadConfigured.trim()
  return DEFAULT_PROOFREAD_MODEL
}

export function isDeepSeekConfigured(): boolean {
  const url = getDeepSeekApiUrl()
  if (url.startsWith('/api/')) return true
  return !!(import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined)?.trim()
}

function mapDeepSeekCategory(raw?: string): IssueCategory {
  const value = (raw ?? '').toLowerCase()
  if (value.includes('rigor') || value.includes('严谨') || value.includes('模糊') || value.includes('绝对')) {
    return 'rigor'
  }
  if (value.includes('typo') || value.includes('spell') || value.includes('错别字')) return 'typo'
  if (value.includes('punct') || value.includes('标点')) return 'punctuation'
  if (
    value.includes('logic') ||
    value.includes('逻辑') ||
    value.includes('reason') ||
    value.includes('完整') ||
    value.includes('completeness') ||
    value.includes('遗漏')
  ) {
    return 'logic'
  }
  if (value.includes('format') || value.includes('格式') || value.includes('公文')) return 'format'
  if (value.includes('style') || value.includes('tone') || value.includes('表达')) return 'style'
  if (value.includes('grammar') || value.includes('语法') || value.includes('语句')) return 'grammar'
  return 'grammar'
}

function mapDeepReviewCategory(raw?: string): IssueCategory {
  const mapped = mapDeepSeekCategory(raw)
  if (mapped === 'logic' || mapped === 'rigor') return mapped
  // 深度审阅只认 logic/rigor，其余兜底为 logic，避免误标 grammar
  if (
    (raw ?? '').toLowerCase().includes('rigor') ||
    (raw ?? '').includes('严谨') ||
    (raw ?? '').includes('模糊') ||
    (raw ?? '').includes('绝对')
  ) {
    return 'rigor'
  }
  return 'logic'
}

const DEEP_REVIEW_DEFAULT_DIMENSIONS = `请从以下两个维度审阅，只报告确有问题的项：

一、逻辑完整性（category: logic）
- 论述链条是否完整：背景→问题→措施→成效→结论（按文体裁剪）
- 数据、时间、主体、范围、口径前后是否一致
- 因果关系是否成立，结论是否有充分依据
- 是否遗漏关键要素：政策依据、责任主体、时间节点、适用对象、量化目标、保障措施
- 措施是否可执行、可检查，有无「只提目标不提路径」

二、表述严谨性（category: rigor）
- 绝对化、模糊化用语（如「大幅」「显著」「尽快」「有关」「相关」缺少限定）
- 政策、文件、数据引用是否准确，措辞是否符合规范
- 歧义、偷换概念、以偏概全、夸大成效、主体不清
- 数字、比例、比较基准是否与上下文匹配

要求：
1. 优先报告会影响决策、合规或公信力的疑点；同类问题可合并说明，但不要过度收敛到 0 条
2. "original" 尽量为原文连续片段（建议 8～80 字）；全文级问题可标关键词，实在无法定位时 original/suggestion 可为空
3. "suggestion" 为可落地的修改建议或改写示例；仅提醒时可为空，但 message 须说清风险
4. message 用一句话说清「问题是什么 + 为什么重要」
5. 若确实无明显问题，返回 {"issues":[]}`

function buildProofreadPrompt(
  chunk: string,
  isTableDocument: boolean,
  promptContext?: ProofreadPromptContext,
): string {
  const docHint = isTableDocument
    ? '当前片段来自 Word 表格转文本（列以 | 分隔）。重点查错别字、数据前后矛盾、指代不清；不要建议把阿拉伯数字改成汉字数字，不要纠结表格排版。'
    : '当前片段为叙述性公文/汇报材料。除字词外，须按 GB/T 9704-2012 检查标题、主送、层次序号、结语、附件说明、落款等格式，并检查逻辑是否自洽。'

  const genreLabel = promptContext?.genreLabel ?? '通用文稿'
  const instructionBlock =
    promptContext?.customInstructions?.trim() ||
    `请从以下三个维度校对中文文档片段：

一、错别字与用语（category: typo / grammar / punctuation）
- 明显错别字、用词不当、语法错误、标点误用

二、公文格式（category: format）
- 标题、主送机关、层次序号（一、（一）1.（1））、结语、附件说明、落款等是否符合 GB/T 9704-2012
- 可提示缺失要素或格式不规范之处

三、逻辑与表述（category: logic）
- 前后矛盾、数据/时间不一致、指代不明、结论缺少依据、要素遗漏、表述歧义

通用要求：
1. 只报告确实需要修改或读者应留意的问题，不要为改而改
2. "original" 必须是原文中逐字出现的连续片段；整段/全文级问题可将 original 设为相关关键词片段，无具体片段时 original 与 suggestion 可为空字符串
3. "suggestion" 是修改后文本；仅提醒、需人工重写时 suggestion 可为空
4. category 只能是：typo、grammar、punctuation、format、logic
5. 若无问题，返回 {"issues":[]}
6. 不要建议「数字改汉字」的纯风格修改，不要建议仅增删空格`

  const rescanBlock = promptContext?.rescan
    ? `

【复校模式 · 必须遵守】
这是用户采纳/修改后的再次校对。请大幅收紧标准：
1. 只报「不改会错或明显不当」的硬伤：错别字、明显语病、标点错误、前后矛盾、关键格式违规、未填占位符
2. 禁止报：同义替换、语气偏好、可改可不改的润色、换一种写法更好、层次序号风格偏好（除非明显错乱）
3. 拿不准就不要报；若全文仅剩风格问题，返回 {"issues":[]}
4. 同一处不要用不同说法重复挑刺`
    : ''

  return `【文体】${genreLabel}

${instructionBlock}
${rescanBlock}

【片段说明】
${docHint}

【固定输出格式】
只输出 JSON：{"issues":[{"category":"typo","original":"原文片段","suggestion":"建议","message":"简短说明"}]}
不要 markdown 或额外说明。

待校对文本：
"""
${chunk}
"""`
}

function buildProofreadSystemPrompt(promptContext?: ProofreadPromptContext): string {
  const genreLabel = promptContext?.genreLabel ?? '通用文稿'
  const rescanHint = promptContext?.rescan
    ? '当前为复校：只报告硬伤，禁止风格偏好与可改可不改的润色；无硬伤时返回空列表。'
    : ''
  return `你是专业的中文${genreLabel}校对专家，熟悉 GB/T 9704-2012 与国企职场文书规范。
须严格按用户确认的校对方案执行，同时检查：①错别字与用语 ②格式规范 ③逻辑与表述。
${rescanHint}
只输出 JSON：{"issues":[{"category":"typo","original":"原文片段","suggestion":"建议","message":"简短说明"}]}。
不要输出 markdown 或额外说明。
表格文本中不要把阿拉伯数字改成汉字数字。`
}

function buildDeepReviewSystemPrompt(promptContext?: ProofreadPromptContext): string {
  const genreLabel = promptContext?.genreLabel ?? '公文与汇报材料'
  return `你是资深${genreLabel}审阅专家，擅长逻辑审计、论证链条检查与政策表述把关。
须同时执行：①用户确认的审阅方案 ②内置的逻辑完整性与表述严谨性检查。
只输出 JSON：{"issues":[{"category":"logic","original":"原文片段","suggestion":"建议","message":"简短说明"}]}。
category 只能是 logic（逻辑完整性）或 rigor（表述严谨）。
不要报告错别字、标点、排版格式问题。
不要输出 markdown 或额外说明。
宁可多报 2～3 条有依据的疑点，也不要因为「拿不准」而返回空列表。`
}

function buildDeepReviewInstructionBlock(promptContext?: ProofreadPromptContext): string {
  const custom = promptContext?.customInstructions?.trim()
  if (!custom) return DEEP_REVIEW_DEFAULT_DIMENSIONS
  return `【用户确认的审阅方案】
${custom}

【必须同时执行的补充检查】
${DEEP_REVIEW_DEFAULT_DIMENSIONS}`
}

function buildDeepReviewChunkPrompt(
  chunk: string,
  isTableDocument: boolean,
  chunkIndex: number,
  chunkTotal: number,
  promptContext?: ProofreadPromptContext,
): string {
  const docHint = isTableDocument
    ? '当前为表格转文本（列以 | 分隔）。重点核对数据前后一致性、统计口径、指代是否清楚。'
    : '当前为叙述性文稿片段。请结合该文体惯例审阅论证与表述，勿只做字词校对。'

  const genreLabel = promptContext?.genreLabel ?? '公文与汇报材料'

  return `【深度审阅 · 片段 ${chunkIndex}/${chunkTotal} · ${genreLabel}】

${buildDeepReviewInstructionBlock(promptContext)}

【片段说明】
${docHint}
本片段是全文第 ${chunkIndex}/${chunkTotal} 段，若问题依赖前后文，请在 message 中注明「需结合上下文」。

【固定输出格式】
只输出 JSON，category 仅 logic 或 rigor。不要 markdown 或额外说明。

待审阅文本：
"""
${chunk}
"""`
}

function buildHolisticReviewText(text: string): string {
  if (text.length <= MAX_HOLISTIC_CHARS) return text

  const normalized = text.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  const headings = lines
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false
      return (
        /^[一二三四五六七八九十百千\d]+[、.．]/.test(line) ||
        /^（[一二三四五六七八九十\d]+）/.test(line) ||
        (/^第[一二三四五六七八九十\d]+[章节部分条]/.test(line) && line.length <= 40) ||
        (line.length <= 28 && !line.endsWith('。') && !line.endsWith('；'))
      )
    })
    .slice(0, 60)

  const head = normalized.slice(0, 4_000)
  const midLen = 3_500
  const midStart = Math.max(0, Math.floor((normalized.length - midLen) / 2))
  const mid = normalized.slice(midStart, midStart + midLen)
  const tail = normalized.slice(-3_500)
  const outline = headings.length > 0 ? headings.join('\n') : '（未能自动提取章节标题）'

  return `【全文约 ${normalized.length} 字；以下为章节大纲 + 开头/中段/结尾节选，请做跨段落逻辑复核】

## 章节/要点大纲
${outline}

## 开头部分
${head}

## 中段部分
${mid}

## 结尾部分
${tail}`
}

function buildDeepReviewHolisticPrompt(
  text: string,
  isTableDocument: boolean,
  promptContext?: ProofreadPromptContext,
): string {
  const reviewText = buildHolisticReviewText(text)
  const docHint = isTableDocument
    ? '文档含表格数据，请特别关注全文汇总数据是否与分项一致。'
    : '请从全文结构视角审阅，重点抓跨段矛盾、结构断层与要素遗漏，不限于单段。'

  const genreLabel = promptContext?.genreLabel ?? '公文与汇报材料'

  return `【深度审阅 · 全文逻辑复核 · ${genreLabel}】

${buildDeepReviewInstructionBlock(promptContext)}

在通读以下材料后，额外检查跨章节/跨段落问题（category 仅 logic 或 rigor）：
- 全文结构是否完整，重点是否突出，有无明显断层
- 不同章节之间数据、结论、时间线是否矛盾
- 摘要/总结与正文细节是否一致
- 全文层面是否遗漏必要要素（依据、分工、时限、保障措施等）
- 是否存在贯穿全文的模糊、绝对化或夸大表述

${docHint}

【固定输出格式】
只输出 JSON，category 仅 logic 或 rigor。

待复核材料：
"""
${reviewText}
"""`
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

function stripThinkBlocks(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

function stripMarkdownFence(content: string): string {
  let text = stripThinkBlocks(content)
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

function repairTruncatedJson(text: string): string | null {
  const start = text.indexOf('{')
  if (start < 0) return null

  let fragment = text.slice(start).trimEnd()
  if (fragment.endsWith(',')) {
    fragment = fragment.slice(0, -1)
  }

  const openBrackets = (fragment.match(/\[/g) || []).length
  const closeBrackets = (fragment.match(/\]/g) || []).length
  const openBraces = (fragment.match(/\{/g) || []).length
  const closeBraces = (fragment.match(/\}/g) || []).length

  fragment += ']'.repeat(Math.max(0, openBrackets - closeBrackets))
  fragment += '}'.repeat(Math.max(0, openBraces - closeBraces))
  return fragment
}

function extractIssuesWithRegex(text: string): DeepSeekIssuePayload[] {
  const cleaned = stripMarkdownFence(text)
  const objectPattern =
    /\{[^{}]*"(?:original|原文)"\s*:\s*"((?:\\.|[^"\\])*)"[^{}]*"(?:message|说明|reason|desc|description|comment|msg)"\s*:\s*"((?:\\.|[^"\\])*)"[^{}]*\}/g

  const results: DeepSeekIssuePayload[] = []
  for (const match of cleaned.matchAll(objectPattern)) {
    try {
      const snippet = match[0]
      const parsed = JSON.parse(snippet) as Record<string, unknown>
      const normalized = normalizeIssuePayload(parsed)
      if (normalized) results.push(normalized)
    } catch {
      /* try next match */
    }
  }

  return results
}

function tryParseJson(text: string): unknown {
  const trimmed = stripMarkdownFence(text)
  const attempts = [trimmed, extractJsonSnippet(trimmed), repairTruncatedJson(trimmed)].filter(
    (item): item is string => !!item?.trim(),
  )

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate)
      if (typeof parsed === 'string') {
        return JSON.parse(parsed)
      }
      return parsed
    } catch {
      /* try next strategy */
    }
  }

  throw new Error('invalid json')
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
  if (!message) return null

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
    if (value === null) {
      return []
    }
  }

  const single = normalizeIssuePayload(record)
  return single ? [single] : []
}

function parseDeepSeekContent(content: string): DeepSeekIssuePayload[] {
  try {
    const parsed = tryParseJson(content)
    return normalizeIssueList(parsed)
  } catch {
    const salvaged = extractIssuesWithRegex(content)
    if (salvaged.length > 0) return salvaged
    throw new Error('invalid json')
  }
}

function rangesConflict(
  start: number,
  end: number,
  occupied: Array<{ start: number; end: number }>,
): boolean {
  return occupied.some((range) => start < range.end && end > range.start)
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
    if (start < 0) break
    const end = start + original.length
    if (!rangesConflict(start, end, occupied)) return { start, end }
    from = start + 1
  }

  // 空白差异导致无法精确命中时：用去空白后的子串回映到原文
  const needle = original.replace(/\s+/g, '')
  if (needle.length >= 8) {
    let compactIndex = 0
    const map: number[] = []
    for (let i = 0; i < text.length; i += 1) {
      if (/\s/.test(text[i])) continue
      map[compactIndex] = i
      compactIndex += 1
    }
    const haystack = text.replace(/\s+/g, '')
    let fromCompact = 0
    while (fromCompact <= haystack.length - needle.length) {
      const at = haystack.indexOf(needle, fromCompact)
      if (at < 0) break
      const start = map[at]
      const endExclusive = map[at + needle.length - 1] + 1
      if (start != null && endExclusive != null && !rangesConflict(start, endExclusive, occupied)) {
        return { start, end: endExclusive }
      }
      fromCompact = at + 1
    }
  }

  // 再退化为前缀定位（至少 12 字），便于挂上高亮
  if (original.length >= 16) {
    const prefix = original.slice(0, Math.min(36, original.length))
    let fromPrefix = 0
    while (fromPrefix <= text.length - prefix.length) {
      const start = text.indexOf(prefix, fromPrefix)
      if (start < 0) break
      const end = Math.min(text.length, start + original.length)
      if (!rangesConflict(start, end, occupied)) return { start, end }
      fromPrefix = start + 1
    }
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

async function requestChatCompletion(
  userPrompt: string,
  options?: {
    jsonMode?: boolean
    systemPrompt?: string
    temperature?: number
    maxTokens?: number
    thinking?: 'enabled' | 'disabled'
  },
): Promise<string> {
  const apiUrl = getDeepSeekApiUrl()
  const useProxy = apiUrl.startsWith('/api/')
  const apiKey = (import.meta.env.VITE_DEEPSEEK_API_KEY as string | undefined)?.trim()
  const jsonMode = options?.jsonMode !== false

  if (!useProxy && !apiKey) {
    throw createDeepSeekError('未配置 DeepSeek API Key，请在 .env.local 中设置 VITE_DEEPSEEK_API_KEY')
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (!useProxy && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  const body: Record<string, unknown> = {
    model: getDeepSeekProofreadModel(),
    messages: [
      { role: 'system', content: options?.systemPrompt ?? buildProofreadSystemPrompt() },
      { role: 'user', content: userPrompt },
    ],
    temperature: options?.temperature ?? 0.2,
    max_tokens: options?.maxTokens ?? 8192,
  }
  if (jsonMode) {
    body.response_format = { type: 'json_object' }
  }
  if (options?.thinking) {
    body.thinking = { type: options.thinking }
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
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

  const choice = data.choices?.[0]
  const content = choice?.message?.content
  if (!content?.trim()) {
    const hasReasoning = Boolean(choice?.message?.reasoning_content?.trim())
    if (hasReasoning && choice?.finish_reason === 'length') {
      throw createDeepSeekError(
        '模型思考过程占满了输出长度，审阅结果被截断。请重试或在设置中增大校对输出上限',
      )
    }
    throw createDeepSeekError('DeepSeek 返回内容为空')
  }

  return content
}

export interface DeepSeekTextOptions {
  systemPrompt: string
  userPrompt: string
  temperature?: number
  maxTokens?: number
  /** 不传则用 getDeepSeekModel()；局部润色等场景可指定 flash */
  model?: string
  /**
   * V4 默认 thinking=enabled，思考 tokens 计入 max_tokens，易把正文截断。
   * 局部优化等短生成应传 disabled。
   */
  thinking?: 'enabled' | 'disabled'
  /** finish_reason=length 时自动续写（最多续写 maxContinuations 次） */
  continueOnLength?: boolean
  maxContinuations?: number
}

/** 局部优化等轻量任务 → 默认 Flash */
export function getDeepSeekFastModel(): string {
  const configured = import.meta.env.VITE_DEEPSEEK_FAST_MODEL as string | undefined
  return configured?.trim() || DEFAULT_FAST_MODEL
}

export interface DeepSeekVisionOptions {
  systemPrompt: string
  userPrompt: string
  imageDataUrl: string
  temperature?: number
  maxTokens?: number
}

export function getDeepSeekVisionModel(): string {
  const configured = import.meta.env.VITE_DEEPSEEK_VISION_MODEL as string | undefined
  return configured?.trim() || DEFAULT_FAST_MODEL
}

/** 仅当显式开启且使用支持 image_url 的模型/端点时才走视觉 API */
export function isDeepSeekVisionEnabled(): boolean {
  const flag = import.meta.env.VITE_DEEPSEEK_VISION_ENABLED as string | undefined
  return flag === 'true' || flag === '1'
}

export function isDeepSeekVisionUnsupportedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()
  return (
    lower.includes('image_url') ||
    lower.includes('unknown variant') ||
    lower.includes('multimodal') ||
    lower.includes('vision')
  )
}

async function postDeepSeekChat(body: Record<string, unknown>): Promise<DeepSeekChatResult> {
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
    body: JSON.stringify(body),
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

  const choice = data.choices?.[0]
  const content = choice?.message?.content?.trim() ?? ''
  const finishReason = choice?.finish_reason ?? null

  if (!content) {
    const hasReasoning = Boolean(choice?.message?.reasoning_content?.trim())
    if (hasReasoning && finishReason === 'length') {
      throw createDeepSeekError(
        '模型思考过程占满了输出长度，正文被截断。请关闭思考模式或增大 max_tokens 后重试',
      )
    }
    throw createDeepSeekError('DeepSeek 返回内容为空')
  }

  return { content, finishReason }
}

function buildPlainTextRequestBody(
  options: DeepSeekTextOptions,
  messages: Array<{ role: string; content: string }>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: options.model?.trim() || getDeepSeekModel(),
    messages,
    temperature: options.temperature ?? 0.5,
    max_tokens: options.maxTokens ?? 8192,
  }
  if (options.thinking) {
    body.thinking = { type: options.thinking }
  }
  return body
}

/** 通用 DeepSeek 文本生成（非 JSON 校对模式） */
export async function requestDeepSeekPlainText(options: DeepSeekTextOptions): Promise<string> {
  const baseMessages = [
    { role: 'system', content: options.systemPrompt },
    { role: 'user', content: options.userPrompt },
  ]

  let result = await postDeepSeekChat(buildPlainTextRequestBody(options, baseMessages))
  let full = result.content

  const maxContinuations = options.maxContinuations ?? 3
  let continuations = 0
  while (
    options.continueOnLength &&
    result.finishReason === 'length' &&
    continuations < maxContinuations
  ) {
    continuations += 1
    result = await postDeepSeekChat(
      buildPlainTextRequestBody(options, [
        ...baseMessages,
        { role: 'assistant', content: full },
        {
          role: 'user',
          content:
            '上一段输出因长度限制被截断。请紧接着续写未完成部分：只输出续写内容，不要重复已有文字，并完整收束。',
        },
      ]),
    )
    full += result.content
  }

  return full
}

/** DeepSeek 多模态：图片 + 文本 */
export async function requestDeepSeekVision(options: DeepSeekVisionOptions): Promise<string> {
  const result = await postDeepSeekChat({
    model: getDeepSeekVisionModel(),
    messages: [
      { role: 'system', content: options.systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: options.imageDataUrl } },
          { type: 'text', text: options.userPrompt },
        ],
      },
    ],
    temperature: options.temperature ?? 0.3,
    max_tokens: options.maxTokens ?? 4096,
    thinking: { type: 'disabled' },
  })
  return result.content
}

async function requestDeepReviewCompletion(
  userPrompt: string,
  jsonMode: boolean,
  promptContext?: ProofreadPromptContext,
): Promise<string> {
  const shared = {
    jsonMode,
    systemPrompt: buildDeepReviewSystemPrompt(promptContext),
    temperature: 0.2,
    maxTokens: DEEP_REVIEW_MAX_TOKENS,
  } as const

  try {
    // 深度审阅开启思考，提升逻辑挖掘质量；额度已加大
    return await requestChatCompletion(userPrompt, {
      ...shared,
      thinking: 'enabled',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // 思考占满或空返回时，降级为关闭思考再试，保证能出结果
    if (
      message.includes('返回内容为空') ||
      message.includes('思考过程占满') ||
      message.includes('无法解析')
    ) {
      return requestChatCompletion(userPrompt, {
        ...shared,
        thinking: 'disabled',
      })
    }
    throw err
  }
}

async function checkChunkAtOffset(
  fullText: string,
  chunk: string,
  baseOffset: number,
  isTableDocument: boolean,
  promptContext?: ProofreadPromptContext,
): Promise<DocumentIssue[]> {
  const strictSuffix =
    '\n\n请严格只输出一个 JSON 对象，不要 markdown 代码块，不要任何前后说明。格式：{"issues":[]}'
  const attempts: Array<{ prompt: string; jsonMode: boolean }> = [
    { prompt: buildProofreadPrompt(chunk, isTableDocument, promptContext), jsonMode: true },
    {
      prompt: `${buildProofreadPrompt(chunk, isTableDocument, promptContext)}${strictSuffix}`,
      jsonMode: true,
    },
    {
      prompt: `${buildProofreadPrompt(chunk, isTableDocument, promptContext)}${strictSuffix}`,
      jsonMode: false,
    },
  ]

  let lastParseError: Error | null = null
  for (const attempt of attempts) {
    try {
      const content = await requestChatCompletion(attempt.prompt, {
        jsonMode: attempt.jsonMode,
        systemPrompt: buildProofreadSystemPrompt(promptContext),
        thinking: 'disabled',
      })
      const payloads = parseDeepSeekContent(content)
      return mapPayloadsToIssues(fullText, chunk, baseOffset, payloads, isTableDocument, nextDsIssueId)
    } catch (err) {
      if (err instanceof Error && err.message === 'invalid json') {
        lastParseError = err
        continue
      }
      throw err
    }
  }

  throw lastParseError ?? new Error('invalid json')
}

async function checkDeepChunkAtOffset(
  fullText: string,
  chunk: string,
  baseOffset: number,
  isTableDocument: boolean,
  chunkIndex: number,
  chunkTotal: number,
  promptContext?: ProofreadPromptContext,
): Promise<DocumentIssue[]> {
  const strictSuffix =
    '\n\n请严格只输出一个 JSON 对象，不要 markdown 代码块，不要任何前后说明。格式：{"issues":[]}'
  const prompt = buildDeepReviewChunkPrompt(
    chunk,
    isTableDocument,
    chunkIndex,
    chunkTotal,
    promptContext,
  )
  const attempts: Array<{ prompt: string; jsonMode: boolean }> = [
    { prompt, jsonMode: true },
    { prompt: `${prompt}${strictSuffix}`, jsonMode: true },
    { prompt: `${prompt}${strictSuffix}`, jsonMode: false },
  ]

  let lastParseError: Error | null = null
  for (const attempt of attempts) {
    try {
      const content = await requestDeepReviewCompletion(
        attempt.prompt,
        attempt.jsonMode,
        promptContext,
      )
      const payloads = parseDeepSeekContent(content)
      return mapPayloadsToIssues(fullText, chunk, baseOffset, payloads, isTableDocument, nextDeepIssueId, {
        deepReview: true,
      })
    } catch (err) {
      if (err instanceof Error && err.message === 'invalid json') {
        lastParseError = err
        continue
      }
      throw err
    }
  }

  throw lastParseError ?? new Error('invalid json')
}

async function checkHolisticDeepReview(
  fullText: string,
  isTableDocument: boolean,
  promptContext?: ProofreadPromptContext,
): Promise<DocumentIssue[]> {
  const strictSuffix =
    '\n\n请严格只输出一个 JSON 对象，不要 markdown 代码块，不要任何前后说明。格式：{"issues":[]}'
  const prompt = buildDeepReviewHolisticPrompt(fullText, isTableDocument, promptContext)
  const attempts: Array<{ prompt: string; jsonMode: boolean }> = [
    { prompt, jsonMode: true },
    { prompt: `${prompt}${strictSuffix}`, jsonMode: true },
    { prompt: `${prompt}${strictSuffix}`, jsonMode: false },
  ]

  let lastParseError: Error | null = null
  for (const attempt of attempts) {
    try {
      const content = await requestDeepReviewCompletion(
        attempt.prompt,
        attempt.jsonMode,
        promptContext,
      )
      const payloads = parseDeepSeekContent(content)
      return mapPayloadsToIssues(
        fullText,
        fullText,
        0,
        payloads,
        isTableDocument,
        nextDeepIssueId,
        { deepReview: true },
      )
    } catch (err) {
      if (err instanceof Error && err.message === 'invalid json') {
        lastParseError = err
        continue
      }
      throw err
    }
  }

  throw lastParseError ?? new Error('invalid json')
}

function mapPayloadsToIssues(
  fullText: string,
  chunk: string,
  baseOffset: number,
  payloads: DeepSeekIssuePayload[],
  isTableDocument: boolean,
  nextId: () => string,
  options?: { deepReview?: boolean },
): DocumentIssue[] {
  const deepReview = options?.deepReview ?? false
  const chunkText = fullText.slice(baseOffset, baseOffset + chunk.length)
  const occupied: Array<{ start: number; end: number }> = []
  const issues: DocumentIssue[] = []

  for (const payload of payloads) {
    const original = payload.original?.trim() ?? ''
    const message = payload.message?.trim()
    if (!message) continue

    const category = deepReview
      ? mapDeepReviewCategory(payload.category)
      : mapDeepSeekCategory(payload.category)
    const suggestion = payload.suggestion?.trim() ?? ''

    if (!original) {
      issues.push({
        id: nextId(),
        category,
        message,
        start: 0,
        end: 0,
        original: '',
        suggestion,
        autoFixable: false,
      })
      continue
    }

    // 先在当前片段找，找不到再在全文找（深度审阅常见跨段引用）
    const localRange = findOriginalPosition(chunkText, original, [])
    let start = -1
    let end = -1
    if (localRange) {
      start = baseOffset + localRange.start
      end = baseOffset + localRange.end
    } else {
      const globalRange = findOriginalPosition(fullText, original, occupied)
      if (globalRange) {
        start = globalRange.start
        end = globalRange.end
      }
    }

    if (start < 0 || end <= start || rangesConflict(start, end, occupied)) {
      // 深度审阅：定位失败也不丢弃，降级为全文级提醒
      if (deepReview) {
        issues.push({
          id: nextId(),
          category,
          message: `${message}（涉及：${original.length > 36 ? `${original.slice(0, 36)}…` : original}）`,
          start: 0,
          end: 0,
          original,
          suggestion,
          autoFixable: false,
        })
      }
      continue
    }

    occupied.push({ start, end })

    const trimmedSuggestion = trimDuplicateTrailingPunctuation(fullText, end, suggestion)
    const resolvedOriginal = fullText.slice(start, end)

    // 深度审阅：即使 suggestion 为空，仍保留逻辑提醒（常需人工改写）
    if (!trimmedSuggestion || trimmedSuggestion === resolvedOriginal) {
      if (deepReview) {
        issues.push({
          id: nextId(),
          category,
          message,
          start,
          end,
          original: resolvedOriginal,
          suggestion: trimmedSuggestion === resolvedOriginal ? '' : trimmedSuggestion,
          autoFixable: false,
        })
      }
      continue
    }

    const lineText = getLineTextAtOffset(fullText, start)
    if (
      !deepReview &&
      shouldSkipProofreadIssue(resolvedOriginal, trimmedSuggestion, { lineText, isTableDocument })
    ) {
      continue
    }

    issues.push({
      id: nextId(),
      category,
      message,
      start,
      end,
      original: resolvedOriginal,
      suggestion: trimmedSuggestion,
      autoFixable: true,
    })
  }

  return issues
}

async function runStandardAiReview(
  text: string,
  isTableDocument: boolean,
  promptContext?: ProofreadPromptContext,
): Promise<{ issues: DocumentIssue[]; parseFailed: boolean }> {
  dsIssueSeq = 0
  const chunks = splitTextIntoChunks(text, MAX_CHUNK_CHARS)
  const globalOccupied: Array<{ start: number; end: number }> = []
  const aiIssues: DocumentIssue[] = []
  let parseFailed = false

  for (const { chunk, baseOffset } of chunks) {
    try {
      const chunkIssues = await checkChunkAtOffset(
        text,
        chunk,
        baseOffset,
        isTableDocument,
        promptContext,
      )

      for (const issue of chunkIssues) {
        if (issue.start < issue.end) {
          const overlaps = globalOccupied.some(
            (range) => issue.start < range.end && issue.end > range.start,
          )
          if (overlaps) continue
          globalOccupied.push({ start: issue.start, end: issue.end })
        }
        aiIssues.push(issue)
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'invalid json') {
        parseFailed = true
        continue
      }
      throw err
    }
  }

  return { issues: aiIssues, parseFailed }
}

async function runDeepAiReview(
  text: string,
  isTableDocument: boolean,
  onProgress?: (message: string) => void,
  promptContext?: ProofreadPromptContext,
): Promise<{ issues: DocumentIssue[]; parseFailed: boolean }> {
  deepIssueSeq = 0
  const chunks = splitTextIntoChunks(text, MAX_DEEP_CHUNK_CHARS)
  const globalOccupied: Array<{ start: number; end: number }> = []
  const aiIssues: DocumentIssue[] = []
  let parseFailed = false

  for (let index = 0; index < chunks.length; index += 1) {
    const { chunk, baseOffset } = chunks[index]
    onProgress?.(`深度审阅：逐段分析 ${index + 1}/${chunks.length}…`)

    try {
      const chunkIssues = await checkDeepChunkAtOffset(
        text,
        chunk,
        baseOffset,
        isTableDocument,
        index + 1,
        chunks.length,
        promptContext,
      )

      for (const issue of chunkIssues) {
        if (issue.start < issue.end) {
          const overlaps = globalOccupied.some(
            (range) => issue.start < range.end && issue.end > range.start,
          )
          if (overlaps) continue
          globalOccupied.push({ start: issue.start, end: issue.end })
        }
        aiIssues.push(issue)
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'invalid json') {
        parseFailed = true
        continue
      }
      throw err
    }
  }

  onProgress?.('深度审阅：全文逻辑复核…')
  try {
    const holisticIssues = await checkHolisticDeepReview(text, isTableDocument, promptContext)
    const seen = new Set(aiIssues.map((issue) => getIssueFingerprint(issue)))
    for (const issue of holisticIssues) {
      const fingerprint = getIssueFingerprint(issue)
      if (seen.has(fingerprint)) continue

      if (issue.start < issue.end) {
        const overlaps = globalOccupied.some(
          (range) => issue.start < range.end && issue.end > range.start,
        )
        // 全文复核与片段区间重叠时：若 message 不同仍保留（降为全文级提醒），避免丢跨段洞察
        if (overlaps) {
          aiIssues.push({
            ...issue,
            id: nextDeepIssueId(),
            start: 0,
            end: 0,
            autoFixable: false,
            message: `${issue.message}（跨段复核）`,
          })
          seen.add(getIssueFingerprint(aiIssues[aiIssues.length - 1]))
          continue
        }
        globalOccupied.push({ start: issue.start, end: issue.end })
      }
      seen.add(fingerprint)
      aiIssues.push(issue)
    }
  } catch (err) {
    if (err instanceof Error && err.message === 'invalid json') {
      parseFailed = true
    } else {
      throw err
    }
  }

  return { issues: aiIssues, parseFailed }
}

function mergeStructuralIssues(issues: DocumentIssue[], text: string): DocumentIssue[] {
  const structural = collectStructuralProofreadIssues(text)
  const fingerprints = new Set(issues.map((issue) => getIssueFingerprint(issue)))

  for (const issue of structural) {
    const fingerprint = getIssueFingerprint(issue)
    if (fingerprints.has(fingerprint)) continue
    fingerprints.add(fingerprint)
    issues.push(issue)
  }

  return issues
}

export async function checkWithDeepSeek(
  text: string,
  options: DeepSeekProofreadOptions = {},
): Promise<DeepSeekProofreadResult> {
  if (!text.trim()) return { issues: [] }

  const mode = options.mode ?? 'standard'
  const isTableDocument = options.isTableDocument ?? false
  const promptContext = options.promptContext

  // 校对统一走 AI；仅在 AI 解析失败时回退本地规则，并保留结构类检查
  if (mode === 'deep') {
    const aiResult = await runDeepAiReview(text, isTableDocument, options.onProgress, promptContext)
    const combinedIssues = mergeProofreadIssues(text, aiResult.issues, { isTableDocument })
    return {
      issues: mergeStructuralIssues(combinedIssues, text),
      usedLocalFallback: aiResult.parseFailed || undefined,
      mode,
    }
  }

  const effectiveContext = promptContext
    ? { ...promptContext, rescan: Boolean(options.rescan || promptContext.rescan) }
    : promptContext
  const aiResult = await runStandardAiReview(text, isTableDocument, effectiveContext)
  const combinedIssues = mergeProofreadIssues(text, aiResult.issues, { isTableDocument })

  if (aiResult.parseFailed && aiResult.issues.length === 0) {
    const localIssues = proofreadDocument(text, { autoFormat: false }).issues
    const withLocalFallback = mergeProofreadIssues(text, [...combinedIssues, ...localIssues], {
      isTableDocument,
    })
    return {
      issues: mergeStructuralIssues(withLocalFallback, text),
      usedLocalFallback: true,
      mode,
    }
  }

  return {
    issues: mergeStructuralIssues(combinedIssues, text),
    usedLocalFallback: aiResult.parseFailed || undefined,
    mode,
  }
}
