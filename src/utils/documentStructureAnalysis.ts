import { getDeepSeekProofreadModel, requestDeepSeekPlainText } from './deepseek'

export interface DocumentStructureAnalysisResult {
  summary: string
  outline: string[]
  logicFlow: string[]
  gaps: string[]
  suggestions: string[]
  rawMarkdown: string
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/)
  return fenced ? fenced[1].trim() : trimmed
}

function extractSection(markdown: string, title: string): string[] {
  const pattern = new RegExp(
    `##\\s*${title}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`,
    'u',
  )
  const match = markdown.match(pattern)
  if (!match) return []
  return match[1]
    .split('\n')
    .map((line) => line.replace(/^[-*·]\s*/, '').trim())
    .filter(Boolean)
}

function extractHeadingsLocally(text: string, limit = 40): string[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const headings: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (
      /^第[一二三四五六七八九十\d]+[章节部分篇]/u.test(trimmed) ||
      /^[一二三四五六七八九十]+[、．.]/u.test(trimmed) ||
      /^（[一二三四五六七八九十]）/u.test(trimmed) ||
      /^\d+[、．.]\s*\S/u.test(trimmed) ||
      /^#{1,3}\s+\S/u.test(trimmed)
    ) {
      headings.push(trimmed.replace(/^#+\s*/, ''))
      if (headings.length >= limit) break
    }
  }
  return headings
}

function clipDocument(text: string, maxChars = 14000): string {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (normalized.length <= maxChars) return normalized
  const head = Math.floor(maxChars * 0.55)
  const tail = Math.floor(maxChars * 0.3)
  const midLen = maxChars - head - tail - 40
  const midStart = Math.max(0, Math.floor((normalized.length - midLen) / 2))
  return `${normalized.slice(0, head)}\n\n……（中间省略）……\n\n${normalized.slice(midStart, midStart + midLen)}\n\n……（后文接续）……\n\n${normalized.slice(-tail)}`
}

function parseStructureMarkdown(raw: string): DocumentStructureAnalysisResult {
  const markdown = stripCodeFence(raw)
  const summaryLines = extractSection(markdown, '总体判断')
  const outline = extractSection(markdown, '结构大纲')
  const logicFlow = extractSection(markdown, '逻辑链条')
  const gaps = extractSection(markdown, '结构缺口')
  const suggestions = extractSection(markdown, '梳理建议')

  return {
    summary: summaryLines.join('\n') || markdown.slice(0, 280),
    outline,
    logicFlow,
    gaps,
    suggestions,
    rawMarkdown: markdown,
  }
}

/** AI 梳理全文结构与论证逻辑（只分析，不改正文） */
export async function analyzeDocumentStructure(
  content: string,
  options: { genreLabel?: string } = {},
): Promise<DocumentStructureAnalysisResult> {
  const text = content.trim()
  if (!text) {
    throw new Error('正文为空，无法梳理结构')
  }

  const genreLabel = options.genreLabel?.trim() || '职场文书'
  const localHeadings = extractHeadingsLocally(text)
  const clipped = clipDocument(text)

  const systemPrompt = `你是中文${genreLabel}结构与论证梳理专家。
任务是帮助作者看清全文骨架与逻辑，而不是做错别字校对。
只输出 Markdown，使用且仅使用以下二级标题（顺序固定）：
## 总体判断
## 结构大纲
## 逻辑链条
## 结构缺口
## 梳理建议
要求：
1. 「总体判断」用 2～4 句概括主题、文种匹配度、整体是否顺畅
2. 「结构大纲」用条目列出当前实际章节/层次（可据正文归纳，不必照搬错误标题）；一级顶格，二级前加两个空格，三级前加四个空格
3. 「逻辑链条」用条目按推进顺序写清论证步骤（提出问题→分析→结论/建议等），标出断裂处；每条尽量短、一句一事
4. 「结构缺口」只写确实缺失或错位的模块；没有则写「未见明显结构缺口」
5. 「梳理建议」给 3～6 条可执行的结构调整建议（如合并、拆分、补节、调整顺序），不要改写成全文
6. 不要做错别字/标点校对，不要输出 JSON，不要代码块`

  const userPrompt = `请梳理以下文档的结构与逻辑。

【本地提取到的标题线索】
${localHeadings.length > 0 ? localHeadings.map((item, i) => `${i + 1}. ${item}`).join('\n') : '（未识别到明显标题，请自行从正文归纳）'}

【正文】
"""
${clipped}
"""
`

  const raw = await requestDeepSeekPlainText({
    systemPrompt,
    userPrompt,
    model: getDeepSeekProofreadModel(),
    temperature: 0.25,
    maxTokens: 4096,
    thinking: 'disabled',
    continueOnLength: true,
    maxContinuations: 2,
  })

  const parsed = parseStructureMarkdown(raw)
  if (!parsed.rawMarkdown.trim()) {
    throw new Error('未能生成结构梳理结果，请重试')
  }
  return parsed
}

export interface StructureSuggestionPatch {
  suggestion: string
  original: string
  replacement: string
  note: string
}

function parseSuggestionPatchJson(
  raw: string,
): Omit<StructureSuggestionPatch, 'suggestion'> | null {
  const jsonMatch = stripCodeFence(raw).match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      original?: string
      replacement?: string
      note?: string
    }
    const original = parsed.original?.trim() ?? ''
    const replacement = parsed.replacement?.trim() ?? ''
    if (!original || !replacement || original === replacement) return null
    return {
      original,
      replacement,
      note: parsed.note?.trim() || '将按预览修改正文对应片段',
    }
  } catch {
    return null
  }
}

/** 针对单条梳理建议生成局部改写补丁（不直接改正文，供用户确认） */
export async function proposeStructureSuggestionPatch(
  content: string,
  suggestion: string,
  options: { genreLabel?: string } = {},
): Promise<StructureSuggestionPatch> {
  const text = content.trim()
  const tip = suggestion.trim()
  if (!text) throw new Error('正文为空，无法优化')
  if (!tip) throw new Error('建议为空')

  const genreLabel = options.genreLabel?.trim() || '职场文书'
  const clipped = clipDocument(text, 12000)

  const systemPrompt = `你是中文${genreLabel}结构优化专家。用户已认可一条「结构梳理」建议，请据此生成局部正文改写补丁。
只输出一个 JSON 对象（不要 markdown）：
{"original":"原文中将被替换的连续片段","replacement":"按建议改写后的完整片段","note":"一句话说明改动要点"}
规则：
1. original 必须是原文中真实存在的连续子串；优先覆盖与建议直接相关的一到数段，不要整篇原文
2. replacement 只落实该条建议，勿借机全文重写；保持文种语气与层次序号风格
3. 若建议是「补节/补段」，可在合适位置用 replacement 扩写，但 original 仍须锚定邻近原文
4. 未知事实用×××；除 JSON 外不要输出任何说明`

  const raw = await requestDeepSeekPlainText({
    systemPrompt,
    userPrompt: `结构建议：
"""
${tip}
"""

原文：
"""
${clipped}
"""

请输出完整 JSON：`,
    model: getDeepSeekProofreadModel(),
    temperature: 0.3,
    maxTokens: 6144,
    thinking: 'disabled',
    continueOnLength: true,
    maxContinuations: 2,
  })

  const patch = parseSuggestionPatchJson(raw)
  if (!patch) {
    throw new Error('未能生成可预览的改写方案，请换一条建议或先手动选中相关段落')
  }
  if (!text.includes(patch.original)) {
    throw new Error('生成的原文片段无法在正文中定位，请重试或手动调整')
  }

  return {
    suggestion: tip,
    ...patch,
  }
}

/** 将已确认的补丁应用到正文 */
export function applyStructureSuggestionPatch(
  content: string,
  patch: Pick<StructureSuggestionPatch, 'original' | 'replacement'>,
): { content: string; start: number; end: number } | null {
  const index = content.indexOf(patch.original)
  if (index < 0) return null
  const next =
    content.slice(0, index) + patch.replacement + content.slice(index + patch.original.length)
  return {
    content: next,
    start: index,
    end: index + patch.replacement.length,
  }
}

const STRUCTURE_STORAGE_KEY = 'chartcraft-document-structure'

export interface StoredStructureAnalysis {
  contentFingerprint: string
  report: DocumentStructureAnalysisResult
  appliedSuggestions: string[]
  analyzedAt: number
  genreLabel?: string | null
}

/** 正文指纹：用于判断缓存是否仍对应当前文档 */
export function fingerprintDocumentContent(content: string): string {
  const text = content.replace(/\r\n/g, '\n').trim()
  if (!text) return ''
  let hash = 2166136261
  const step = Math.max(1, Math.floor(text.length / 400))
  for (let i = 0; i < text.length; i += step) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= text.length
  hash = Math.imul(hash, 16777619)
  return `${text.length}:${(hash >>> 0).toString(16)}:${text.slice(0, 48)}:${text.slice(-48)}`
}

export function loadStoredStructureAnalysis(): StoredStructureAnalysis | null {
  try {
    const raw = localStorage.getItem(STRUCTURE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredStructureAnalysis>
    if (!parsed.report || typeof parsed.report !== 'object') return null
    if (typeof parsed.contentFingerprint !== 'string' || !parsed.contentFingerprint) return null
    if (typeof parsed.analyzedAt !== 'number') return null
    return {
      contentFingerprint: parsed.contentFingerprint,
      report: {
        summary: parsed.report.summary ?? '',
        outline: Array.isArray(parsed.report.outline) ? parsed.report.outline : [],
        logicFlow: Array.isArray(parsed.report.logicFlow) ? parsed.report.logicFlow : [],
        gaps: Array.isArray(parsed.report.gaps) ? parsed.report.gaps : [],
        suggestions: Array.isArray(parsed.report.suggestions) ? parsed.report.suggestions : [],
        rawMarkdown: parsed.report.rawMarkdown ?? '',
      },
      appliedSuggestions: Array.isArray(parsed.appliedSuggestions)
        ? parsed.appliedSuggestions.filter((item): item is string => typeof item === 'string')
        : [],
      analyzedAt: parsed.analyzedAt,
      genreLabel: parsed.genreLabel ?? null,
    }
  } catch {
    return null
  }
}

export function saveStoredStructureAnalysis(payload: StoredStructureAnalysis): void {
  try {
    localStorage.setItem(STRUCTURE_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearStoredStructureAnalysis(): void {
  try {
    localStorage.removeItem(STRUCTURE_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** 从大纲条目推断展示层级（1～3） */
export function detectOutlineLevel(item: string): 1 | 2 | 3 {
  const leading = item.match(/^(\s+)/)?.[1].length ?? 0
  const text = item.trim()
  if (leading >= 4) return 3
  if (leading >= 2) return 2
  if (
    /^第[一二三四五六七八九十\d]+[章节部分篇]/u.test(text) ||
    /^[一二三四五六七八九十]+[、．.]/u.test(text) ||
    /^#{1}\s+\S/u.test(text)
  ) {
    return 1
  }
  if (
    /^（[一二三四五六七八九十\d]+）/u.test(text) ||
    /^\d+[、．.]\s*\S/u.test(text) ||
    /^#{2}\s+\S/u.test(text)
  ) {
    return 2
  }
  if (/^[（(]\d+[）)]/u.test(text) || /^#{3}\s+\S/u.test(text)) return 3
  return 1
}

export function formatStructureAnalyzedAt(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp))
  } catch {
    return new Date(timestamp).toLocaleString()
  }
}
