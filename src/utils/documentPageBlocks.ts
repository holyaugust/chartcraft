import { TABLE_COL_SEP } from './docxTextExtract'
import { detectHeadingLevel, type HeadingLevel } from './documentFormatNormalize'

export interface PageCaret {
  start: number
  end: number
}

export interface PageCell {
  text: string
  start: number
  end: number
}

export interface PageTableRow {
  cells: PageCell[]
  lineStart: number
  lineEnd: number
}

export type DocumentPageBlock =
  | { kind: 'blank'; start: number; end: number }
  | { kind: 'paragraph'; start: number; end: number; text: string }
  | { kind: 'heading'; level: HeadingLevel; start: number; end: number; text: string }
  | { kind: 'table'; start: number; end: number; rows: PageTableRow[] }

export interface PageOffset {
  blockIndex: number
  offsetInBlock: number
  rowIndex: number | null
  cellIndex: number | null
  offsetInCell: number | null
}

interface LineSpan {
  text: string
  start: number
  end: number
}

function splitLines(text: string): LineSpan[] {
  const parts = text.split('\n')
  const lines: LineSpan[] = []
  let pos = 0
  for (let i = 0; i < parts.length; i += 1) {
    const line = parts[i] ?? ''
    const start = pos
    const end = pos + line.length
    lines.push({ text: line, start, end })
    if (i < parts.length - 1) pos = end + 1
  }
  return lines
}

function cellsForLine(line: LineSpan): PageCell[] {
  const parts = line.text.split(TABLE_COL_SEP)
  const cells: PageCell[] = []
  let pos = line.start
  for (let i = 0; i < parts.length; i += 1) {
    const text = parts[i] ?? ''
    const start = pos
    const end = pos + text.length
    cells.push({ text, start, end })
    pos = end + (i < parts.length - 1 ? TABLE_COL_SEP.length : 0)
  }
  return cells
}

function lineBlock(line: LineSpan): DocumentPageBlock {
  if (line.text.length === 0) {
    return { kind: 'blank', start: line.start, end: line.end }
  }
  if (line.text.includes(TABLE_COL_SEP)) {
    return {
      kind: 'table',
      start: line.start,
      end: line.end,
      rows: [{ cells: cellsForLine(line), lineStart: line.start, lineEnd: line.end }],
    }
  }
  const level = detectHeadingLevel(line.text.trim())
  if (level) {
    return { kind: 'heading', level, start: line.start, end: line.end, text: line.text }
  }
  return { kind: 'paragraph', start: line.start, end: line.end, text: line.text }
}

export function parseDocumentPage(text: string): DocumentPageBlock[] {
  const lines = splitLines(text)
  const blocks: DocumentPageBlock[] = []

  for (const line of lines) {
    const block = lineBlock(line)
    const prev = blocks[blocks.length - 1]
    if (block.kind === 'table' && prev?.kind === 'table') {
      prev.rows.push(block.rows[0]!)
      prev.end = block.end
      continue
    }
    blocks.push(block)
  }

  return blocks
}

function blockLines(block: DocumentPageBlock): string[] {
  if (block.kind === 'blank') return ['']
  if (block.kind === 'table') {
    return block.rows.map((row) => row.cells.map((cell) => cell.text).join(TABLE_COL_SEP))
  }
  return [block.text]
}

export function serializeDocumentPage(blocks: DocumentPageBlock[]): string {
  return blocks.flatMap(blockLines).join('\n')
}

export function locatePageOffset(text: string, offset: number): PageOffset {
  const blocks = parseDocumentPage(text)
  const safe = Math.max(0, Math.min(offset, text.length))

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex]!
    if (safe === block.end && safe < text.length && text[safe] === '\n') {
      return {
        blockIndex,
        offsetInBlock: block.end - block.start,
        rowIndex: null,
        cellIndex: null,
        offsetInCell: null,
      }
    }

    if (safe < block.start || safe > block.end) continue

    if (block.kind === 'table') {
      for (let rowIndex = 0; rowIndex < block.rows.length; rowIndex += 1) {
        const row = block.rows[rowIndex]!
        if (safe === row.lineEnd && safe < text.length && text[safe] === '\n') {
          return {
            blockIndex,
            offsetInBlock: safe - block.start,
            rowIndex: null,
            cellIndex: null,
            offsetInCell: null,
          }
        }
        if (safe < row.lineStart || safe > row.lineEnd) continue
        let cellIndex = 0
        let offsetInCell = 0
        for (let i = 0; i < row.cells.length; i += 1) {
          const cell = row.cells[i]!
          if (safe >= cell.start && safe <= cell.end) {
            cellIndex = i
            offsetInCell = safe - cell.start
          }
        }
        return {
          blockIndex,
          offsetInBlock: safe - block.start,
          rowIndex,
          cellIndex,
          offsetInCell,
        }
      }
    }

    return {
      blockIndex,
      offsetInBlock: safe - block.start,
      rowIndex: null,
      cellIndex: null,
      offsetInCell: null,
    }
  }

  const last = Math.max(0, blocks.length - 1)
  return {
    blockIndex: last,
    offsetInBlock: 0,
    rowIndex: null,
    cellIndex: null,
    offsetInCell: null,
  }
}
