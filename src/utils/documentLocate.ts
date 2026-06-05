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

export function buildHighlightedHtml(content: string, range: TextHighlightRange | null): string {
  if (!range || range.start >= range.end) {
    return escapeHtml(content)
  }

  const { start, end, adopted = false } = range
  const safeStart = Math.max(0, Math.min(start, content.length))
  const safeEnd = Math.max(safeStart, Math.min(end, content.length))
  const markClass = adopted ? 'document-issue-highlight adopted' : 'document-issue-highlight pending'

  return (
    escapeHtml(content.slice(0, safeStart)) +
    `<mark class="${markClass}">${escapeHtml(content.slice(safeStart, safeEnd))}</mark>` +
    escapeHtml(content.slice(safeEnd))
  )
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

  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.pointerEvents = 'none'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.wordBreak = 'break-word'
  mirror.style.overflowWrap = 'break-word'
  mirror.style.boxSizing = 'border-box'
  mirror.style.width = `${textarea.clientWidth}px`
  mirror.style.padding = style.padding
  mirror.style.border = style.border
  mirror.style.font = style.font
  mirror.style.fontSize = style.fontSize
  mirror.style.fontFamily = style.fontFamily
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
  const markerTop = marker instanceof HTMLElement ? marker.offsetTop : 0
  const markerHeight = marker instanceof HTMLElement ? marker.offsetHeight : 0

  document.body.removeChild(mirror)

  const paddingTop = Number.parseFloat(style.paddingTop) || 0
  const visibleHeight = textarea.clientHeight
  const maxScroll = Math.max(0, textarea.scrollHeight - visibleHeight)
  const centeredTop = markerTop + paddingTop - (visibleHeight - markerHeight) / 2

  textarea.scrollTop = Math.min(maxScroll, Math.max(0, centeredTop))
}

/** 将编辑器滚入视口，并同步 backdrop 滚动 */
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

  textarea.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function findTextRange(content: string, text: string): { start: number; end: number } | null {
  if (!text) return null

  const exact = content.indexOf(text)
  if (exact >= 0) {
    return { start: exact, end: exact + text.length }
  }

  const trimmed = text.trim()
  if (trimmed && trimmed !== text) {
    const idx = content.indexOf(trimmed)
    if (idx >= 0) return { start: idx, end: idx + trimmed.length }
  }

  if (text.length > 24) {
    const anchor = text.slice(0, 20)
    const anchorIdx = content.indexOf(anchor)
    if (anchorIdx >= 0) {
      return { start: anchorIdx, end: Math.min(anchorIdx + text.length, content.length) }
    }
  }

  return null
}

export function resolveIssueRange(
  content: string,
  issue: DocumentIssue,
): { start: number; end: number } | null {
  if (issue.start < issue.end && issue.end <= content.length) {
    const slice = content.slice(issue.start, issue.end)
    if (slice === issue.original || (issue.suggestion && slice === issue.suggestion)) {
      return { start: issue.start, end: issue.end }
    }
  }

  const fromOriginal = issue.original ? findTextRange(content, issue.original) : null
  if (fromOriginal) return fromOriginal

  // 已采纳后正文为 suggestion，需回退匹配
  if (issue.suggestion) {
    return findTextRange(content, issue.suggestion)
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

export function locateIssueInTextarea(
  textarea: HTMLTextAreaElement,
  issue: DocumentIssue,
  content: string,
): { start: number; end: number } | null {
  const range = resolveIssueRange(content, issue)
  if (!range) return null

  const { start, end } = range

  textarea.focus({ preventScroll: true })
  textarea.setSelectionRange(start, start)
  scrollEditorToIssueRange(textarea, start, end)

  return range
}
