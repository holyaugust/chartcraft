import { getDeepSeekProofreadModel, requestDeepSeekPlainText } from './deepseek'
import { extractDocumentHeadings } from './documentHeadings'

export type StructureSuggestionTag = '补缺' | '理顺' | '收紧'

export interface StructureSuggestion {
  tag: StructureSuggestionTag
  /** 大致动哪一节，如「二、风险」或「全文」 */
  target: string
  /** 建议正文 */
  text: string
  /** 完整条目（已应用 / 智能优化 / 定位用） */
  raw: string
}

export interface DocumentStructureAnalysisResult {
  summary: string
  outline: string[]
  /** 已收拢进「总体判断」，始终为空；保留字段以兼容旧缓存 */
  logicFlow: string[]
  gaps: string[]
  suggestions: StructureSuggestion[]
  rawMarkdown: string
}

const SUGGESTION_TAGS = new Set<string>(['补缺', '理顺', '收紧'])

const CN_SECTION_NUM = '一二三四五六七八九十百零〇O0-9'

function inferSuggestionTag(text: string): StructureSuggestionTag {
  if (
    /(增设|新增|补上|补写|补充).{0,12}(专节|专章|一节|章节|小节)|缺少|缺失|尚未设置|没有.{0,6}(专节|章节)/u.test(
      text,
    )
  ) {
    return '补缺'
  }
  if (/(删|压缩|精简|套话|润色|冗长|啰嗦|语气|表述过|篇幅)/u.test(text)) {
    return '收紧'
  }
  if (/(合并|拆分|调整顺序|理顺|过渡|挪到|调换|前后矛盾|衔接|归并)/u.test(text)) {
    return '理顺'
  }
  return '理顺'
}

function extractQuotedFragments(text: string): string[] {
  const fragments: string[] = []
  for (const match of text.matchAll(/[「『“"]([^」』”"]{1,40})[」』”"]/gu)) {
    const value = match[1]?.trim()
    if (value) fragments.push(value)
  }
  return fragments
}

function matchSectionTitle(
  needle: string,
  sectionOrder: readonly string[],
): string | null {
  const trimmed = needle.trim()
  if (!trimmed || trimmed === '全文') return null

  const exact = sectionOrder.find((section) => section.trim() === trimmed)
  if (exact) return exact.trim()

  const byInclude = sectionOrder.find((section) => {
    const title = section.trim()
    return title.includes(trimmed) || trimmed.includes(title)
  })
  if (byInclude) return byInclude.trim()

  // 「三」「四」这类仅序号：对齐「三、…」标题
  if (new RegExp(`^[${CN_SECTION_NUM}]+$`, 'u').test(trimmed)) {
    const numbered = sectionOrder.find((section) =>
      new RegExp(`^[${CN_SECTION_NUM}]*${trimmed}[、．.]`, 'u').test(section.trim()),
    )
    if (numbered) return numbered.trim()
  }

  return null
}

function inferSuggestionTarget(
  text: string,
  sectionOrder: readonly string[],
): string {
  if (sectionOrder.length === 0) return '全文'

  const hits: Array<{ title: string; index: number }> = []
  const pushHit = (title: string) => {
    const index = sectionOrder.findIndex((section) => section.trim() === title)
    if (index < 0) return
    if (!hits.some((hit) => hit.index === index)) {
      hits.push({ title, index })
    }
  }

  for (const fragment of extractQuotedFragments(text)) {
    const matched = matchSectionTitle(fragment, sectionOrder)
    if (matched) pushHit(matched)
  }

  for (const section of sectionOrder) {
    const title = section.trim()
    if (title && text.includes(title)) pushHit(title)
  }

  // 正文里的「二、总体思路」式片段
  const numPattern = new RegExp(`[${CN_SECTION_NUM}]+、[^，。；\\s「」『』]{1,24}`, 'gu')
  for (const match of text.matchAll(numPattern)) {
    const matched = matchSectionTitle(match[0], sectionOrder)
    if (matched) pushHit(matched)
  }

  if (hits.length === 0) return '全文'
  hits.sort((a, b) => a.index - b.index)
  return hits[0].title
}

function looksLikeStructuredSuggestionPrefix(raw: string): boolean {
  return /^【(补缺|理顺|收紧)\s*[｜|]/u.test(raw)
}

/** 解析单条梳理建议：优先读【标签｜目标节】；否则从正文推断 */
export function parseStructureSuggestionLine(
  line: string,
  sectionOrder: readonly string[] = [],
): StructureSuggestion {
  const raw = line.replace(/^[-*·\d.、）)\s]+/u, '').trim() || line.trim()
  const match = raw.match(/^【(补缺|理顺|收紧)\s*[｜|]\s*(.+?)】\s*(.+)$/u)
  if (match) {
    return {
      tag: match[1] as StructureSuggestionTag,
      target: match[2].trim() || '全文',
      text: match[3].trim(),
      raw,
    }
  }
  return {
    tag: inferSuggestionTag(raw),
    target: inferSuggestionTarget(raw, sectionOrder),
    text: raw,
    raw,
  }
}

/** 目标节在正文目录中的最早位置；全文/未匹配排到最后 */
export function suggestionTargetOrderIndex(
  target: string,
  sectionOrder: readonly string[],
): number {
  const trimmed = target.trim()
  if (!trimmed || trimmed === '全文' || sectionOrder.length === 0) {
    return Number.POSITIVE_INFINITY
  }
  let best = Number.POSITIVE_INFINITY
  sectionOrder.forEach((section, index) => {
    const title = section.trim()
    if (!title) return
    if (trimmed === title || trimmed.includes(title) || title.includes(trimmed)) {
      best = Math.min(best, index)
    }
  })
  return best
}

/** 按正文章节先后排序；全文与未匹配目标靠后 */
export function sortStructureSuggestions(
  items: StructureSuggestion[],
  sectionOrder: readonly string[] = [],
): StructureSuggestion[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const orderDiff =
        suggestionTargetOrderIndex(a.item.target, sectionOrder) -
        suggestionTargetOrderIndex(b.item.target, sectionOrder)
      if (orderDiff !== 0) return orderDiff
      return a.index - b.index
    })
    .map((entry) => entry.item)
}

const STRUCTURAL_SIGNAL =
  /(专节|专章|空壳|归并|调序|调整顺序|过渡段|增设|合并.{0,12}节|拆分.{0,8}(节|章)|补充.{0,10}(专节|专章|模块|一节)|缺.{0,10}(专节|专章|模块|章节)|删除重复段落|压缩整节)/u

const HARD_STRUCTURE_SIGNAL =
  /(增设|补充).{0,12}(专节|专章|模块)|缺.{0,12}(专节|专章|模块|章节)|合并.{0,16}节|拆分.{0,12}(节|章)|空壳|归并|调序|调整顺序|章节顺序|明显(断档|跳跃|脱节).{0,24}过渡/u

const SENTENCE_POLISH_SIGNAL =
  /(拆成两句|拆为两句|分为两句|一长句|句号断开|标点|用词|近义|语气|润色|精简表述|语义重复|改为「|删去「|开展实施|逻辑更清楚)/u

const NO_STRUCTURE_ISSUE_TEXT = '暂无明显结构调整建议'
const NO_STRUCTURE_ISSUE_RE = /暂无(明显)?结构|未见明显结构|没有明显结构/

function noStructureIssueSuggestion(): StructureSuggestion {
  return {
    tag: '理顺',
    target: '全文',
    text: NO_STRUCTURE_ISSUE_TEXT,
    raw: `【理顺｜全文】${NO_STRUCTURE_ISSUE_TEXT}`,
  }
}

/** 「暂无明显结构调整建议」等占位句，不算真实建议 */
export function isNoIssueStructureSuggestion(item: StructureSuggestion): boolean {
  return NO_STRUCTURE_ISSUE_RE.test(item.text.trim())
}

export function countActionableStructureSuggestions(
  items: readonly StructureSuggestion[],
): number {
  return items.filter((item) => !isNoIssueStructureSuggestion(item)).length
}

/** 句级润色 / 无关痛痒建议：结构梳理侧不展示 */
export function isLowValueStructureSuggestion(item: StructureSuggestion): boolean {
  const text = item.text.trim()
  if (!text) return true
  if (NO_STRUCTURE_ISSUE_RE.test(text)) return false

  const hasStructural = STRUCTURAL_SIGNAL.test(text)
  const hasPolish = SENTENCE_POLISH_SIGNAL.test(text)
  if (hasPolish && !hasStructural) return true

  // 「收紧」若只是语气/用词，无结构动作 → 丢弃
  if (item.tag === '收紧' && !hasStructural) return true

  return false
}

/** 结构硬伤：缺节/并节/调序/空壳归并/明显断档补过渡 */
export function isHardStructureSuggestion(item: StructureSuggestion): boolean {
  const text = item.text.trim()
  if (!text || NO_STRUCTURE_ISSUE_RE.test(text)) return false
  if (HARD_STRUCTURE_SIGNAL.test(text)) return true
  return item.tag === '补缺' && STRUCTURAL_SIGNAL.test(text)
}

function suggestionDedupeKey(item: StructureSuggestion): string {
  return `${item.tag}::${item.target.trim()}`
}

/** 同标签+同目标节只留第一条；仅保留硬伤，全无则坍缩为「暂无明显」 */
export function finalizeStructureSuggestions(
  items: StructureSuggestion[],
  sectionOrder: readonly string[] = [],
): StructureSuggestion[] {
  const usable = items.filter((item) => !isLowValueStructureSuggestion(item))
  const hard = usable.filter((item) => isHardStructureSuggestion(item))
  if (hard.length === 0) return [noStructureIssueSuggestion()]

  const seen = new Set<string>()
  const deduped: StructureSuggestion[] = []
  for (const item of hard) {
    const key = suggestionDedupeKey(item)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
  }
  return sortStructureSuggestions(deduped, sectionOrder)
}

/** 兼容旧缓存的 string[] 与已结构化对象，并按正文先后排序 */
export function normalizeStructureSuggestions(
  value: unknown,
  sectionOrder: readonly string[] = [],
): StructureSuggestion[] {
  if (!Array.isArray(value)) return []
  const parsed: StructureSuggestion[] = []
  for (const item of value) {
    if (typeof item === 'string') {
      const trimmed = item.trim()
      if (trimmed) parsed.push(parseStructureSuggestionLine(trimmed, sectionOrder))
      continue
    }
    if (!item || typeof item !== 'object') continue
    const record = item as Partial<StructureSuggestion>
    const text = typeof record.text === 'string' ? record.text.trim() : ''
    const raw =
      typeof record.raw === 'string' && record.raw.trim()
        ? record.raw.trim()
        : text
    if (!text && !raw) continue
    const body = text || raw
    const hasPrefix = looksLikeStructuredSuggestionPrefix(raw)
    let tag =
      typeof record.tag === 'string' && SUGGESTION_TAGS.has(record.tag)
        ? (record.tag as StructureSuggestionTag)
        : null
    let target =
      typeof record.target === 'string' && record.target.trim()
        ? record.target.trim()
        : ''

    // 旧结果常落成「理顺｜全文」占位：无前缀时按正文重推断
    if (!hasPrefix && (!tag || !target || (tag === '理顺' && target === '全文'))) {
      const inferred = parseStructureSuggestionLine(body, sectionOrder)
      tag = inferred.tag
      target = inferred.target
    } else {
      if (!tag) tag = parseStructureSuggestionLine(body, sectionOrder).tag
      if (!target) target = '全文'
    }

    parsed.push({
      tag,
      target,
      text: body,
      raw: raw || text,
    })
  }
  return finalizeStructureSuggestions(parsed, sectionOrder)
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

function clipDocument(text: string, maxChars = 14000): string {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (normalized.length <= maxChars) return normalized
  const head = Math.floor(maxChars * 0.55)
  const tail = Math.floor(maxChars * 0.3)
  const midLen = maxChars - head - tail - 40
  const midStart = Math.max(0, Math.floor((normalized.length - midLen) / 2))
  return `${normalized.slice(0, head)}\n\n……（中间省略）……\n\n${normalized.slice(midStart, midStart + midLen)}\n\n……（后文接续）……\n\n${normalized.slice(-tail)}`
}

function sectionOrderFromOutline(outline: string[]): string[] {
  return outline.map((item) => item.trim()).filter(Boolean)
}

function parseStructureMarkdown(
  raw: string,
  sectionOrder: readonly string[] = [],
): DocumentStructureAnalysisResult {
  const markdown = stripCodeFence(raw)
  const summaryLines = extractSection(markdown, '总体判断')
  const outline = extractSection(markdown, '结构大纲')
  const order =
    sectionOrder.length > 0 ? sectionOrder : sectionOrderFromOutline(outline)
  const suggestions = normalizeStructureSuggestions(
    extractSection(markdown, '梳理建议'),
    order,
  )

  return {
    summary: summaryLines.join('\n') || markdown.slice(0, 280),
    outline,
    logicFlow: [],
    // 缺口已并入「梳理建议」的补缺类；保留字段兼容旧缓存，新结果恒为空
    gaps: [],
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
  const localHeadings = extractDocumentHeadings(text, 40).map((item) => item.title)
  const clipped = clipDocument(text)

  const systemPrompt = `你是中文${genreLabel}结构与论证梳理专家。
任务是帮助作者看清全文骨架与结构安排，而不是做错别字校对。
只输出 Markdown，使用且仅使用以下二级标题（顺序固定）：
## 总体判断
## 结构大纲
## 梳理建议
要求：
1. 「总体判断」用 2～4 句概括主题、文种匹配度；其中须用 1～2 句说明论证/叙述是否顺畅，若有明显跳跃可点明何处缺过渡（勿另开逻辑链条章节）
2. 「结构大纲」用条目列出当前实际章节/层次（可据正文归纳，不必照搬错误标题）；一级顶格，二级前加两个空格，三级前加四个空格
3. 「梳理建议」默认可以为空：没有结构硬伤时只输出一条「暂无明显结构调整建议」，禁止「可优化但非必要」的建议，禁止为凑数硬提。仅当存在硬伤才写具体条目（可多条），硬伤仅限：缺关键专节/模块；章节须合并/拆分/调序；节与节明显断档/跳跃须补过渡段；空壳节堆砌或大段结构重复须归并。缺模块用【补缺｜…】，勿另开「结构缺口」章节。禁止：拆句、标点、近义替换、个别用词、纯语气润色、「补一句更顺」类轻建议、错别字（留给校对）。有硬伤时按正文从前往后输出；每条必须以【补缺｜目标节】或【理顺｜目标节】或【收紧｜目标节】开头；目标节尽量照抄【本地标题线索】；不要改写成全文
4. 不要输出「结构缺口」「逻辑链条」章节，不要做错别字/标点校对，不要输出 JSON，不要代码块`

  const userPrompt = `请梳理以下文档的结构。

【本地标题线索】
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

  const parsed = parseStructureMarkdown(raw, localHeadings)
  if (!parsed.rawMarkdown.trim()) {
    throw new Error('未能生成结构梳理结果，请重试')
  }
  return {
    ...parsed,
    suggestions: sortStructureSuggestions(
      parsed.suggestions,
      localHeadings.length > 0
        ? localHeadings
        : sectionOrderFromOutline(parsed.outline),
    ),
  }
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
  /** 建议文案 → 写入正文后的片段，用于再次定位 */
  appliedSnippets: Record<string, string>
  analyzedAt: number
  genreLabel?: string | null
}

function normalizeAppliedSnippets(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  const next: Record<string, string> = {}
  for (const [key, snippet] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key === 'string' && typeof snippet === 'string' && snippet.trim()) {
      next[key] = snippet
    }
  }
  return next
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
        logicFlow: [],
        gaps: Array.isArray(parsed.report.gaps) ? parsed.report.gaps : [],
        suggestions: normalizeStructureSuggestions(
          parsed.report.suggestions,
          sectionOrderFromOutline(
            Array.isArray(parsed.report.outline) ? parsed.report.outline : [],
          ),
        ),
        rawMarkdown: parsed.report.rawMarkdown ?? '',
      },
      appliedSuggestions: Array.isArray(parsed.appliedSuggestions)
        ? parsed.appliedSuggestions.filter((item): item is string => typeof item === 'string')
        : [],
      appliedSnippets: normalizeAppliedSnippets(parsed.appliedSnippets),
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
