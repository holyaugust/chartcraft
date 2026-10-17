import type { FormatFixItem } from './documentFormatAdjust'
import type { TextHighlightRange } from './documentLocate'

export interface FormatRevisionHunk {
  start: number
  end: number
  replacement: string
}

type LineOp = { kind: 'eq' | 'del' | 'ins'; text: string }

function lineStartOffsets(lines: string[]): number[] {
  const offsets: number[] = []
  let pos = 0
  for (const line of lines) {
    offsets.push(pos)
    pos += line.length + 1
  }
  return offsets
}

function diffLineOps(before: string[], after: string[]): LineOp[] {
  const n = before.length
  const m = after.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] = before[i] === after[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }

  const ops: LineOp[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      ops.push({ kind: 'eq', text: before[i]! })
      i += 1
      j += 1
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      ops.push({ kind: 'del', text: before[i]! })
      i += 1
    } else {
      ops.push({ kind: 'ins', text: after[j]! })
      j += 1
    }
  }
  while (i < n) {
    ops.push({ kind: 'del', text: before[i]! })
    i += 1
  }
  while (j < m) {
    ops.push({ kind: 'ins', text: after[j]! })
    j += 1
  }
  return ops
}

/** 按行对比排版前后，得到可在正文上画删除线/插入的修订块 */
export function buildFormatRevisionHunks(before: string, after: string): FormatRevisionHunk[] {
  const source = before.replace(/\r\n/g, '\n')
  const target = after.replace(/\r\n/g, '\n')
  if (source === target) return []

  const beforeLines = source.split('\n')
  const ops = diffLineOps(beforeLines, target.split('\n'))
  const offsets = lineStartOffsets(beforeLines)
  const hunks: FormatRevisionHunk[] = []

  let lineIndex = 0
  let delStart: number | null = null
  let delEnd = 0
  let inserted: string[] = []

  const flush = () => {
    if (delStart == null && inserted.length === 0) return
    const start = delStart ?? offsets[lineIndex] ?? source.length
    const end = delStart == null ? start : delEnd
    const consumedNewline = end > start && source[end - 1] === '\n'
    const atEnd = lineIndex >= beforeLines.length
    let replacement = ''
    if (inserted.length > 0) {
      replacement = inserted.join('\n')
      if (consumedNewline || (delStart == null && !atEnd)) replacement += '\n'
      if (delStart == null && atEnd && source.length > 0 && !source.endsWith('\n')) {
        replacement = `\n${inserted.join('\n')}`
      }
    }
    if (start !== end || replacement) hunks.push({ start, end, replacement })
    delStart = null
    delEnd = 0
    inserted = []
  }

  for (const op of ops) {
    if (op.kind === 'eq') {
      flush()
      lineIndex += 1
      continue
    }
    if (op.kind === 'del') {
      const start = offsets[lineIndex] ?? source.length
      const isLast = lineIndex === beforeLines.length - 1
      const end = isLast ? start + op.text.length : start + op.text.length + 1
      if (delStart == null) delStart = start
      delEnd = end
      lineIndex += 1
      continue
    }
    inserted.push(op.text)
  }
  flush()
  return hunks
}

export function applyRevisionHunks(text: string, hunks: FormatRevisionHunk[]): string {
  const ordered = [...hunks].sort((a, b) => b.start - a.start)
  let next = text
  for (const hunk of ordered) {
    next = `${next.slice(0, hunk.start)}${hunk.replacement}${next.slice(hunk.end)}`
  }
  return next
}

/** 在当前正文里定位一条排版提示 */
export function locateFormatIssue(
  content: string,
  item: Pick<FormatFixItem, 'kind' | 'detail' | 'samples'>,
): TextHighlightRange | null {
  const text = content.replace(/\r\n/g, '\n')
  if (item.kind === 'blank_lines') {
    const match = text.match(/\n{3,}/)
    if (!match || match.index == null) return null
    return { start: match.index, end: match.index + match[0].length }
  }
  if (item.kind === 'indent') {
    const match = text.match(/^[ \t\u3000]+/m)
    if (!match || match.index == null) return null
    return { start: match.index, end: match.index + match[0].length }
  }
  if (item.kind === 'trailing_space') {
    const match = text.match(/[ \t]+$/m)
    if (!match || match.index == null) return null
    return { start: match.index, end: match.index + match[0].length }
  }
  if (item.kind === 'hierarchy') {
    const sample = item.samples?.[0]?.original
    const index = sample ? text.indexOf(sample) : -1
    if (index >= 0 && sample) return { start: index, end: index + sample.length }
  }
  if (item.detail.includes('阿拉伯数字')) {
    const match = text.match(/^[ \t\u3000]*[0-9]+[、.．][^\n]*/m)
    if (!match || match.index == null) return null
    return { start: match.index, end: match.index + match[0].length }
  }
  return null
}
