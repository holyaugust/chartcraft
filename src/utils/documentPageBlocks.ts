import { TABLE_COL_SEP } from './docxTextExtract'
import {
  detectHeadingLevel,
  looksLikeLeadingDocumentTitle,
  looksLikeManuscriptAddresseeLine,
  looksLikeManuscriptSignatureLine,
  type HeadingLevel,
} from './documentFormatNormalize'

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
  | { kind: 'title'; start: number; end: number; text: string }
  | { kind: 'addressee'; start: number; end: number; text: string }
  | { kind: 'signature'; start: number; end: number; text: string }
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
  let seenContent = false

  for (const line of lines) {
    const block = lineBlock(line)
    if (
      !seenContent &&
      block.kind === 'paragraph' &&
      looksLikeLeadingDocumentTitle(block.text) &&
      !looksLikeManuscriptSignatureLine(block.text) &&
      !looksLikeManuscriptAddresseeLine(block.text)
    ) {
      blocks.push({ kind: 'title', start: block.start, end: block.end, text: block.text })
      seenContent = true
      continue
    }
    if (block.kind === 'paragraph' && looksLikeManuscriptAddresseeLine(block.text)) {
      blocks.push({ kind: 'addressee', start: block.start, end: block.end, text: block.text })
      seenContent = true
      continue
    }
    if (block.kind !== 'blank') seenContent = true
    const prev = blocks[blocks.length - 1]
    if (block.kind === 'table' && prev?.kind === 'table') {
      prev.rows.push(block.rows[0]!)
      prev.end = block.end
      continue
    }
    blocks.push(block)
  }

  return markTrailingSignatures(blocks)
}

function isAnnexOrCopyLine(block: DocumentPageBlock): boolean {
  if (!('text' in block)) return false
  return /^(附件|抄送|分送)[：:]/u.test(block.text.trim())
}

function markTrailingSignatures(blocks: DocumentPageBlock[]): DocumentPageBlock[] {
  let index = blocks.length - 1
  while (index >= 0 && (blocks[index]!.kind === 'blank' || isAnnexOrCopyLine(blocks[index]!))) {
    index -= 1
  }
  const last = index
  let first = last + 1
  while (index >= 0) {
    const block = blocks[index]!
    if (block.kind === 'blank') {
      index -= 1
      continue
    }
    if (block.kind === 'paragraph' && looksLikeManuscriptSignatureLine(block.text)) {
      first = index
      index -= 1
      continue
    }
    break
  }
  if (first > last) return blocks
  return blocks.map((block, blockIndex) => {
    if (blockIndex < first || blockIndex > last) return block
    if (block.kind !== 'paragraph' || !looksLikeManuscriptSignatureLine(block.text)) return block
    return { kind: 'signature', start: block.start, end: block.end, text: block.text }
  })
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

export type PageCommand = 'insertText' | 'enter' | 'backspace' | 'delete' | 'tab'

interface CaretSpot {
  lineStart: number
  lineEnd: number
  inTable: boolean
  row: PageTableRow | null
  rowIndex: number
  cellIndex: number
  isLastRow: boolean
  isOnlyRow: boolean
  cellCount: number
}

function caretSpot(text: string, offset: number): CaretSpot {
  const blocks = parseDocumentPage(text)
  for (const block of blocks) {
    if (offset < block.start || offset > block.end) continue
    if (block.kind !== 'table') {
      return {
        lineStart: block.start,
        lineEnd: block.end,
        inTable: false,
        row: null,
        rowIndex: 0,
        cellIndex: 0,
        isLastRow: false,
        isOnlyRow: false,
        cellCount: 0,
      }
    }
    for (let rowIndex = 0; rowIndex < block.rows.length; rowIndex += 1) {
      const row = block.rows[rowIndex]!
      if (offset < row.lineStart || offset > row.lineEnd) continue
      let cellIndex = 0
      for (let i = 0; i < row.cells.length; i += 1) {
        if (row.cells[i]!.start <= offset) cellIndex = i
      }
      return {
        lineStart: row.lineStart,
        lineEnd: row.lineEnd,
        inTable: true,
        row,
        rowIndex,
        cellIndex,
        isLastRow: rowIndex === block.rows.length - 1,
        isOnlyRow: block.rows.length === 1,
        cellCount: row.cells.length,
      }
    }
  }
  return {
    lineStart: 0,
    lineEnd: text.length,
    inTable: false,
    row: null,
    rowIndex: 0,
    cellIndex: 0,
    isLastRow: false,
    isOnlyRow: false,
    cellCount: 0,
  }
}

function same(text: string, caret: PageCaret): { text: string; caret: PageCaret } {
  return { text, caret }
}

function point(text: string, offset: number): { text: string; caret: PageCaret } {
  return { text, caret: { start: offset, end: offset } }
}

function emptyRow(cellCount: number): string {
  return Array.from({ length: Math.max(cellCount, 2) }, () => '').join(TABLE_COL_SEP)
}

function separatorContains(row: PageTableRow, index: number): boolean {
  for (let i = 0; i < row.cells.length - 1; i += 1) {
    const start = row.cells[i]!.end
    const end = row.cells[i + 1]!.start
    if (index >= start && index < end) return true
  }
  return false
}

function insertEmptyTableRow(text: string, lineEnd: number, cellCount: number): { text: string; caret: PageCaret } {
  const next = `${text.slice(0, lineEnd)}\n${emptyRow(cellCount)}${text.slice(lineEnd)}`
  return point(next, lineEnd + 1)
}

function deleteTableRow(text: string, spot: CaretSpot): { text: string; caret: PageCaret } {
  const row = spot.row
  if (!row) return point(text, spot.lineStart)
  if (spot.isOnlyRow) {
    return point(text.slice(0, row.lineStart) + text.slice(row.lineEnd), row.lineStart)
  }
  if (spot.isLastRow) {
    const next = text.slice(0, row.lineStart - 1) + text.slice(row.lineEnd)
    const caret = Math.min(row.lineStart, next.length)
    return point(next, caret)
  }
  return point(text.slice(0, row.lineStart) + text.slice(row.lineEnd + 1), row.lineStart)
}

function applyEnter(text: string, offset: number): { text: string; caret: PageCaret } {
  const spot = caretSpot(text, offset)
  if (spot.inTable) return insertEmptyTableRow(text, spot.lineEnd, spot.cellCount)
  return point(`${text.slice(0, offset)}\n${text.slice(offset)}`, offset + 1)
}

function applyBackspace(text: string, offset: number): { text: string; caret: PageCaret } {
  const spot = caretSpot(text, offset)
  if (spot.inTable && spot.row) {
    const cell = spot.row.cells[spot.cellIndex]
    if (cell && offset === cell.start) {
      const allEmpty = spot.row.cells.every((item) => item.text.length === 0)
      if (allEmpty && spot.cellIndex === 0) return deleteTableRow(text, spot)
      return point(text, offset)
    }
    if (separatorContains(spot.row, offset - 1)) return point(text, offset)
  } else if (offset === spot.lineStart && offset > 0) {
    const previous = caretSpot(text, offset - 1)
    if (previous.inTable) return point(text, offset)
    return point(text.slice(0, offset - 1) + text.slice(offset), offset - 1)
  }
  if (offset <= 0) return point(text, 0)
  return point(text.slice(0, offset - 1) + text.slice(offset), offset - 1)
}

function applyDelete(text: string, offset: number): { text: string; caret: PageCaret } {
  if (offset >= text.length) return point(text, offset)
  const spot = caretSpot(text, offset)
  if (spot.inTable && spot.row) {
    const cell = spot.row.cells[spot.cellIndex]
    if (cell && offset === cell.end && spot.cellIndex < spot.row.cells.length - 1) {
      return point(text, offset)
    }
    if (separatorContains(spot.row, offset)) return point(text, offset)
  }
  if (offset === spot.lineEnd && text[offset] === '\n') {
    const next = caretSpot(text, offset + 1)
    if (next.inTable) return point(text, offset)
    return point(text.slice(0, offset) + text.slice(offset + 1), offset)
  }
  return point(text.slice(0, offset) + text.slice(offset + 1), offset)
}

function applyTab(text: string, offset: number, caret: PageCaret): { text: string; caret: PageCaret } {
  const spot = caretSpot(text, offset)
  if (!spot.inTable || !spot.row) return same(text, caret)
  if (spot.cellIndex < spot.row.cells.length - 1) {
    const nextCell = spot.row.cells[spot.cellIndex + 1]!
    return point(text, nextCell.start)
  }
  if (!spot.isLastRow) {
    const blocks = parseDocumentPage(text)
    const table = blocks.find((block) => block.kind === 'table' && block.start <= offset && offset <= block.end)
    if (table?.kind === 'table') {
      const nextRow = table.rows[spot.rowIndex + 1]
      if (nextRow) return point(text, nextRow.cells[0]!.start)
    }
  }
  return insertEmptyTableRow(text, spot.lineEnd, spot.cellCount)
}

export function applyPageCommand(
  text: string,
  caret: PageCaret,
  command: PageCommand,
  insertText = '',
): { text: string; caret: PageCaret } {
  if (command === 'tab') {
    const offset = Math.max(0, Math.min(caret.end, text.length))
    return applyTab(text, offset, caret)
  }

  let current = text
  let offset = caret.start
  if (caret.start < caret.end) {
    current = current.slice(0, caret.start) + current.slice(caret.end)
    offset = caret.start
  }
  offset = Math.max(0, Math.min(offset, current.length))

  if (command === 'insertText') {
    const next = current.slice(0, offset) + insertText + current.slice(offset)
    return point(next, offset + insertText.length)
  }
  if (command === 'enter') return applyEnter(current, offset)
  if (command === 'backspace') return applyBackspace(current, offset)
  return applyDelete(current, offset)
}
