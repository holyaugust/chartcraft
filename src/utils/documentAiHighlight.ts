import type { TextHighlightRange } from './documentLocate'

function mergeRanges(ranges: TextHighlightRange[]): TextHighlightRange[] {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const merged: TextHighlightRange[] = [{ ...sorted[0] }]
  for (let i = 1; i < sorted.length; i += 1) {
    const last = merged[merged.length - 1]
    const cur = sorted[i]
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end)
    } else {
      merged.push({ ...cur })
    }
  }
  return merged
}

function lineOffset(lines: string[], lineIndex: number): number {
  let offset = 0
  for (let i = 0; i < lineIndex; i += 1) {
    offset += lines[i].length + 1
  }
  return offset
}

/** 对比 AI 生成前后文本，返回「新稿中变更/新增」的字符区间 */
export function computeAiWriteHighlightRanges(before: string, after: string): TextHighlightRange[] {
  if (!after) return []
  if (!before.trim()) return [{ start: 0, end: after.length }]
  if (before === after) return []

  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')

  let prefix = 0
  while (prefix < beforeLines.length && prefix < afterLines.length && beforeLines[prefix] === afterLines[prefix]) {
    prefix += 1
  }

  let suffix = 0
  while (
    suffix < beforeLines.length - prefix &&
    suffix < afterLines.length - prefix &&
    beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
  ) {
    suffix += 1
  }

  const changedStart = prefix
  const changedEnd = afterLines.length - suffix
  if (changedStart >= changedEnd) return []

  const start = lineOffset(afterLines, changedStart)
  const end = changedEnd >= afterLines.length ? after.length : lineOffset(afterLines, changedEnd)

  return mergeRanges([{ start, end }])
}
