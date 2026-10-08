import type { DocumentIssue } from './documentProofread'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export interface TextHighlightRange {
  start: number
  end: number
  /** 是否已采纳该条校对 */
  adopted?: boolean
}

type HighlightVariant = 'proofread-pending' | 'proofread-adopted' | 'ai-write'

interface HighlightSegment {
  start: number
  end: number
  variant: HighlightVariant
}

function clampRange(content: string, start: number, end: number): { start: number; end: number } {
  const safeStart = Math.max(0, Math.min(start, content.length))
  const safeEnd = Math.max(safeStart, Math.min(end, content.length))
  return { start: safeStart, end: safeEnd }
}

function buildSegments(
  content: string,
  range: TextHighlightRange | null,
  aiRanges: TextHighlightRange[],
): HighlightSegment[] {
  const segments: HighlightSegment[] = []

  if (range) {
    const { start, end } = clampRange(content, range.start, range.end)
    if (start < end) {
      segments.push({
        start,
        end,
        variant: range.adopted ? 'proofread-adopted' : 'proofread-pending',
      })
    }
  }

  for (const item of aiRanges) {
    const { start, end } = clampRange(content, item.start, item.end)
    if (start < end) {
      segments.push({
        start,
        end,
        variant: item.adopted ? 'proofread-adopted' : 'ai-write',
      })
    }
  }

  return segments
}

function variantClass(variant: HighlightVariant): string {
  if (variant === 'ai-write') return 'document-ai-write-highlight'
  if (variant === 'proofread-adopted') return 'document-issue-highlight adopted'
  return 'document-issue-highlight pending'
}

function buildHighlightedSlice(
  content: string,
  sliceStart: number,
  sliceEnd: number,
  segments: HighlightSegment[],
): string {
  if (sliceStart >= sliceEnd) return ''

  const points = new Set<number>([sliceStart, sliceEnd])
  for (const segment of segments) {
    if (segment.end <= sliceStart || segment.start >= sliceEnd) continue
    points.add(Math.max(sliceStart, segment.start))
    points.add(Math.min(sliceEnd, segment.end))
  }

  const sortedPoints = [...points].sort((a, b) => a - b)
  let html = ''

  for (let i = 0; i < sortedPoints.length - 1; i += 1) {
    const start = sortedPoints[i]
    const end = sortedPoints[i + 1]
    if (start >= end) continue

    const covering = segments.filter((segment) => segment.start <= start && segment.end >= end)
    const active =
      covering.find((segment) => segment.variant.startsWith('proofread')) ??
      covering.find((segment) => segment.variant === 'ai-write')

    const slice = escapeHtml(content.slice(start, end))
    html += active ? `<mark class="${variantClass(active.variant)}">${slice}</mark>` : slice
  }

  return html
}

export function buildHighlightedHtml(
  content: string,
  range: TextHighlightRange | null,
  aiRanges: TextHighlightRange[] = [],
): string {
  const segments = buildSegments(content, range, aiRanges)
  if (segments.length === 0) return escapeHtml(content)
  return buildHighlightedSlice(content, 0, content.length, segments)
}

/**
 * 编辑器高亮层 HTML：必须与 textarea 的 pre-wrap 文本流一致。
 * 不要按行拆成 block，否则换行/光标会与真实编辑位置错位。
 */
export function buildEditorDisplayHtml(
  content: string,
  range: TextHighlightRange | null,
  aiRanges: TextHighlightRange[] = [],
): string {
  if (!content) return ''
  return buildHighlightedHtml(content, range, aiRanges)
}

/** 将 textarea 滚动到指定字符区间（兼容自动换行的长行，尽量居中显示） */
export function scrollTextareaToRange(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number,
): void {
  if (textarea.clientWidth <= 0 || textarea.clientHeight <= 0) return

  const style = window.getComputedStyle(textarea)
  const mirror = document.createElement('div')

  // 镜像宽度必须与 textarea 的「内容+padding」一致（即 clientWidth）。
  // 勿再叠加 border：clientWidth 已不含 border，加上会缩小行宽、换行错位，滚动目标偏离。
  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.pointerEvents = 'none'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.overflowWrap = 'break-word'
  mirror.style.wordBreak = style.wordBreak || 'break-word'
  mirror.style.boxSizing = 'border-box'
  mirror.style.width = `${textarea.clientWidth}px`
  mirror.style.padding = style.padding
  mirror.style.border = '0'
  mirror.style.font = style.font
  mirror.style.fontSize = style.fontSize
  mirror.style.fontFamily = style.fontFamily
  mirror.style.fontWeight = style.fontWeight
  mirror.style.fontStyle = style.fontStyle
  mirror.style.lineHeight = style.lineHeight
  mirror.style.letterSpacing = style.letterSpacing
  mirror.style.tabSize = style.tabSize

  const value = textarea.value
  const safeStart = Math.max(0, Math.min(start, value.length))
  const safeEnd = Math.max(safeStart, Math.min(end, value.length))
  const before = escapeHtml(value.slice(0, safeStart))
  const mid = escapeHtml(value.slice(safeStart, safeEnd) || ' ')
  const after = escapeHtml(value.slice(safeEnd))

  mirror.innerHTML = `${before}<span id="locate-marker">${mid}</span>${after}`
  document.body.appendChild(mirror)

  const marker = mirror.querySelector('#locate-marker')
  // offsetTop 已相对 padding edge，勿再加 paddingTop，否则滚动偏下
  const markerTop = marker instanceof HTMLElement ? marker.offsetTop : 0
  const markerHeight = marker instanceof HTMLElement ? marker.offsetHeight : 0

  document.body.removeChild(mirror)

  const visibleHeight = textarea.clientHeight
  const maxScroll = Math.max(0, textarea.scrollHeight - visibleHeight)
  const centeredTop = markerTop - (visibleHeight - markerHeight) / 2

  textarea.scrollTop = Math.min(maxScroll, Math.max(0, centeredTop))
}

/** 在纸张滚动容器内把标记滚到可视区域中间。不用 scrollIntoView，以免带动窗口。 */
export function scrollPageToRange(container: HTMLElement, marker: HTMLElement): void {
  const containerRect = container.getBoundingClientRect()
  const markerRect = marker.getBoundingClientRect()
  const markerTop = markerRect.top - containerRect.top + container.scrollTop
  const markerHeight = markerRect.height
  const visibleHeight = container.clientHeight
  const maxScroll = Math.max(0, container.scrollHeight - visibleHeight)
  const centeredTop = markerTop - (visibleHeight - markerHeight) / 2
  container.scrollTop = Math.min(maxScroll, Math.max(0, centeredTop))
}

/** 将编辑器滚到指定区间，并同步 backdrop；勿用 scrollIntoView，以免带动页面/侧栏滚动 */
export function scrollEditorToIssueRange(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number,
  backdrop?: HTMLElement | null,
): void {
  scrollTextareaToRange(textarea, start, end)

  if (backdrop) {
    backdrop.scrollTop = textarea.scrollTop
    backdrop.scrollLeft = textarea.scrollLeft
  }
}

function normalizeLocateChars(text: string): string {
  return text
    .replace(/[\u201c\u201d\u2018\u2019]/g, (ch) => ('\u201c\u201d'.includes(ch) ? '"' : "'"))
    .replace(/[，]/g, ',')
    .replace(/[。]/g, '.')
    .replace(/[：]/g, ':')
    .replace(/[；]/g, ';')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[、]/g, ',')
    .replace(/[\uFF10-\uFF19]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/\s+/g, '')
}

function pickNearestRange(
  ranges: Array<{ start: number; end: number }>,
  preferredStart?: number,
): { start: number; end: number } | null {
  if (ranges.length === 0) return null
  if (preferredStart == null || preferredStart < 0) return ranges[0]
  let best = ranges[0]
  let bestDist = Math.abs(best.start - preferredStart)
  for (let i = 1; i < ranges.length; i += 1) {
    const dist = Math.abs(ranges[i].start - preferredStart)
    if (dist < bestDist) {
      best = ranges[i]
      bestDist = dist
    }
  }
  return best
}

function collectExactRanges(content: string, text: string): Array<{ start: number; end: number }> {
  if (!text) return []
  const ranges: Array<{ start: number; end: number }> = []
  let from = 0
  while (from <= content.length - text.length) {
    const start = content.indexOf(text, from)
    if (start < 0) break
    ranges.push({ start, end: start + text.length })
    from = start + 1
  }
  return ranges
}

/** 在正文中查找片段；preferredStart 用于多处命中时靠近旧偏移 */
export function findTextRange(
  content: string,
  text: string,
  preferredStart?: number,
): { start: number; end: number } | null {
  if (!text) return null

  const exact = pickNearestRange(collectExactRanges(content, text), preferredStart)
  if (exact) return exact

  const trimmed = text.trim()
  if (trimmed && trimmed !== text) {
    const byTrim = pickNearestRange(collectExactRanges(content, trimmed), preferredStart)
    if (byTrim) return byTrim
  }

  // 忽略空白与常见中英文标点差异（采纳其它项或 AI 原文略有出入时）
  const needle = normalizeLocateChars(text)
  if (needle.length >= 2) {
    const map: number[] = []
    let compact = ''
    for (let i = 0; i < content.length; i += 1) {
      const ch = content[i]
      const normalized = normalizeLocateChars(ch)
      if (!normalized) continue
      for (const unit of normalized) {
        map.push(i)
        compact += unit
      }
    }

    const ranges: Array<{ start: number; end: number }> = []
    let fromCompact = 0
    while (fromCompact <= compact.length - needle.length) {
      const at = compact.indexOf(needle, fromCompact)
      if (at < 0) break
      const start = map[at]
      const end = map[at + needle.length - 1] + 1
      if (start != null && end != null) ranges.push({ start, end })
      fromCompact = at + 1
    }
    const fuzzy = pickNearestRange(ranges, preferredStart)
    if (fuzzy) return fuzzy
  }

  if (text.length >= 12) {
    const prefix = text.slice(0, Math.min(24, text.length))
    const byPrefix = pickNearestRange(collectExactRanges(content, prefix), preferredStart)
    if (byPrefix) {
      return {
        start: byPrefix.start,
        end: Math.min(content.length, byPrefix.start + text.length),
      }
    }
  }

  return null
}

export function resolveIssueRange(
  content: string,
  issue: DocumentIssue,
): { start: number; end: number } | null {
  const hintStart = issue.start < issue.end ? issue.start : undefined

  if (issue.start < issue.end && issue.end <= content.length) {
    const slice = content.slice(issue.start, issue.end)
    if (slice === issue.original || (issue.suggestion && slice === issue.suggestion)) {
      return { start: issue.start, end: issue.end }
    }
    // 偏移附近仍像原片段时，允许小范围漂移（采纳其它项后常见）
    if (issue.original && issue.original.length >= 2) {
      const windowStart = Math.max(0, issue.start - 80)
      const windowEnd = Math.min(content.length, issue.end + 80)
      const windowText = content.slice(windowStart, windowEnd)
      const local = findTextRange(windowText, issue.original, issue.start - windowStart)
      if (local) {
        return { start: windowStart + local.start, end: windowStart + local.end }
      }
    }
  }

  const fromOriginal = issue.original ? findTextRange(content, issue.original, hintStart) : null
  if (fromOriginal) return fromOriginal

  // 已采纳后正文为 suggestion，需回退匹配
  if (issue.suggestion) {
    return findTextRange(content, issue.suggestion, hintStart)
  }

  return null
}

export function getIssueSnippet(content: string, issue: DocumentIssue, radius = 24): string {
  const range = resolveIssueRange(content, issue)
  if (!range) return issue.message

  const { start, end } = range
  const startPos = Math.max(0, start - radius)
  const endPos = Math.min(content.length, end + radius)
  const prefix = startPos > 0 ? '…' : ''
  const suffix = endPos < content.length ? '…' : ''

  return `${prefix}${content.slice(startPos, endPos)}${suffix}`
}

/** 单字命中时扩展到连续汉字词，便于高亮可见（不改变采纳替换范围） */
export function expandRangeToCjkWord(
  content: string,
  range: { start: number; end: number },
): { start: number; end: number } {
  if (range.end - range.start !== 1) return range
  const ch = content[range.start]
  if (!ch || !/[\u4e00-\u9fff]/u.test(ch)) return range

  let start = range.start
  let end = range.end
  while (start > 0 && /[\u4e00-\u9fff]/u.test(content[start - 1]!)) start -= 1
  while (end < content.length && /[\u4e00-\u9fff]/u.test(content[end]!)) end += 1
  return { start, end }
}

export function locateIssueInTextarea(
  textarea: HTMLTextAreaElement,
  issue: DocumentIssue,
  content: string,
): { start: number; end: number } | null {
  const range = resolveIssueRange(content, issue)
  if (!range) return null

  const visual = expandRangeToCjkWord(content, range)

  textarea.focus({ preventScroll: true })
  textarea.setSelectionRange(range.start, range.end)
  scrollEditorToIssueRange(textarea, visual.start, visual.end)

  return range
}

function stripStructureLabelNoise(text: string): string {
  return text
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/^第[一二三四五六七八九十\d]+[章节部分篇]\s*/u, '')
    .replace(/^[一二三四五六七八九十]+[、．.]\s*/u, '')
    // AI 大纲常写成「（一）、标题」，正文多为「（一）标题」
    .replace(/^（[一二三四五六七八九十\d]+）[、．.]?\s*/u, '')
    .replace(/^\(([一二三四五六七八九十\d]+)\)[、．.]?\s*/u, '')
    .replace(/^\d+[、．.]\s*/u, '')
    .replace(/^[（(]\d+[）)][、．.]?\s*/u, '')
    .replace(/^(提出问题|分析问题|分析|结论|建议|背景|现状|对策|措施)[:：]\s*/u, '')
    .trim()
}

function headingMatchKey(text: string): string {
  return normalizeLocateChars(stripStructureLabelNoise(text))
}

function looksLikeHeadingLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  return (
    /^第[一二三四五六七八九十\d]+[章节部分篇]/u.test(trimmed) ||
    /^[一二三四五六七八九十]+[、．.]/u.test(trimmed) ||
    /^（[一二三四五六七八九十\d]+）/u.test(trimmed) ||
    /^\([一二三四五六七八九十\d]+\)/u.test(trimmed) ||
    /^\d+[、．.]\s*\S/u.test(trimmed) ||
    /^#{1,3}\s+\S/u.test(trimmed)
  )
}

/**
 * 将大纲标题锚定到正文标题行：优先整行/行首匹配，避免「总体思路」
 * 误命中「二、……总体思路和主要方向」这类父标题。
 */
export function locateOutlineHeadingInContent(
  content: string,
  title: string,
): { start: number; end: number } | null {
  const raw = title.replace(/\s+/g, ' ').trim()
  if (!raw || !content.trim()) return null

  const wanted = headingMatchKey(raw)
  if (!wanted || wanted.length < 2) return null

  const normalized = content.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')

  // Pass 1: 标题核完全一致的标题行
  let offset = 0
  for (const line of lines) {
    const key = headingMatchKey(line)
    if (key && key === wanted && looksLikeHeadingLine(line)) {
      const lead = line.match(/^\s*/)?.[0].length ?? 0
      return { start: offset + lead, end: offset + line.length }
    }
    offset += line.length + 1
  }

  // Pass 2: 去编号后相等，即使正文行号形式略有不同
  offset = 0
  for (const line of lines) {
    const key = headingMatchKey(line)
    if (key && key === wanted) {
      const lead = line.match(/^\s*/)?.[0].length ?? 0
      return { start: offset + lead, end: offset + line.length }
    }
    offset += line.length + 1
  }

  // Pass 3: 回退到通用定位，但只接受落在标题行行首附近的命中
  const loose = locateStructureItemInContent(normalized, raw)
  if (!loose) return null
  const lineStart = normalized.lastIndexOf('\n', Math.max(0, loose.start - 1)) + 1
  const lineEnd = normalized.indexOf('\n', loose.start)
  const line = normalized.slice(lineStart, lineEnd < 0 ? normalized.length : lineEnd)
  if (!looksLikeHeadingLine(line)) return null
  // 命中点应靠近行首（允许少量空白/编号宽度）
  if (loose.start - lineStart > 24) return null
  return { start: lineStart + (line.match(/^\s*/)?.[0].length ?? 0), end: lineStart + line.length }
}

/** 将结构梳理条目（大纲/逻辑/建议等）锚定到正文区间 */
export function locateStructureItemInContent(
  content: string,
  item: string,
): { start: number; end: number } | null {
  const raw = item.replace(/\s+/g, ' ').trim()
  if (!raw || !content.trim()) return null

  const candidates: string[] = []
  const pushCandidate = (value: string) => {
    const next = value.replace(/\s+/g, ' ').trim()
    if (next.length < 2) return
    if (!candidates.includes(next)) candidates.push(next)
  }

  pushCandidate(raw)
  pushCandidate(stripStructureLabelNoise(raw))

  for (const match of raw.matchAll(/[「『“"]([^」』”"]{2,80})[」』”"]/gu)) {
    pushCandidate(match[1] ?? '')
  }

  for (const part of raw.split(/[→⇒：:;；。|｜]/u)) {
    pushCandidate(stripStructureLabelNoise(part))
  }

  const core = stripStructureLabelNoise(raw) || raw
  for (const len of [28, 20, 14, 10, 8, 6]) {
    if (core.length >= len) pushCandidate(core.slice(0, len))
  }

  candidates.sort((a, b) => b.length - a.length)

  for (const candidate of candidates) {
    const hit = findTextRange(content, candidate)
    if (!hit) continue
    // 短命中时略扩展，便于高亮可见
    const span = Math.max(hit.end - hit.start, Math.min(candidate.length, 36))
    return {
      start: hit.start,
      end: Math.min(content.length, hit.start + span),
    }
  }

  return null
}

/** 在编辑器中选中并滚动到指定区间 */
export function locateRangeInTextarea(
  textarea: HTMLTextAreaElement,
  range: { start: number; end: number },
  content: string,
): { start: number; end: number } {
  const visual = expandRangeToCjkWord(content, range)
  textarea.focus({ preventScroll: true })
  textarea.setSelectionRange(range.start, range.end)
  scrollEditorToIssueRange(textarea, visual.start, visual.end)
  return range
}

/** 正文变更后按原文/建议重算各问题偏移，避免点击定位失效 */
export function refreshIssueRanges(content: string, issues: DocumentIssue[]): DocumentIssue[] {
  return issues.map((issue) => {
    const range = resolveIssueRange(content, issue)
    if (!range) return issue
    if (range.start === issue.start && range.end === issue.end) return issue
    return { ...issue, start: range.start, end: range.end }
  })
}
