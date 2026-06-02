import type { CellAlign, CellStyle, TableState } from '../types'
import {
  cellKey,
  isHiddenByMerge,
  normalizeSelection,
  styleKey,
  type CellSelection,
} from './tableMeta'

export interface TableClipboardPayload {
  cells: string[][]
  alignments: Record<string, CellAlign>
  cellStyles: Record<string, CellStyle>
}

let internalClipboard: TableClipboardPayload | null = null

export function parseClipboardGrid(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  if (lines.length === 0) return [['']]

  return lines.map((line) => line.split('\t'))
}

export function serializeGridToTsv(grid: string[][]): string {
  return grid.map((row) => row.join('\t')).join('\n')
}

export function extractSelectionPayload(
  state: TableState,
  selection: CellSelection,
): TableClipboardPayload {
  const { r1, c1, r2, c2 } = normalizeSelection(selection)
  const cells: string[][] = []
  const alignments: Record<string, CellAlign> = {}
  const cellStyles: Record<string, CellStyle> = {}

  for (let row = r1; row <= r2; row++) {
    const rowValues: string[] = []
    for (let col = c1; col <= c2; col++) {
      if (isHiddenByMerge(state.meta, row, col)) {
        rowValues.push('')
        continue
      }

      rowValues.push(state.data[row]?.[col] ?? '')

      const relRow = row - r1
      const relCol = col - c1
      const relKey = cellKey(relRow, relCol)
      const key = styleKey(state.meta, row, col)

      if (state.meta.alignments[key]) {
        alignments[relKey] = state.meta.alignments[key]
      }

      const savedStyle = state.meta.cellStyles?.[key]
      if (savedStyle && Object.keys(savedStyle).length > 0) {
        cellStyles[relKey] = { ...savedStyle }
      }
    }
    cells.push(rowValues)
  }

  return { cells, alignments, cellStyles }
}

function ensureTableSize(state: TableState, rows: number, cols: number): TableState {
  let data = state.data.map((row) => [...row])
  const currentCols = data[0]?.length ?? 0

  while (data.length < rows) {
    data.push(Array(Math.max(cols, currentCols, 1)).fill(''))
  }

  if (cols > currentCols) {
    data = data.map((row) => {
      const next = [...row]
      while (next.length < cols) next.push('')
      return next
    })
  }

  return { ...state, data }
}

export function pasteGridAt(
  state: TableState,
  anchor: { row: number; col: number },
  payload: TableClipboardPayload,
): TableState {
  const { cells, alignments, cellStyles } = payload
  if (cells.length === 0) return state

  const maxCols = Math.max(...cells.map((row) => row.length), 1)
  const neededRows = anchor.row + cells.length
  const neededCols = anchor.col + maxCols
  const nextState = ensureTableSize(state, neededRows, neededCols)

  const data = nextState.data.map((row) => [...row])
  const metaAlignments = { ...nextState.meta.alignments }
  const metaCellStyles = { ...(nextState.meta.cellStyles ?? {}) }

  for (let r = 0; r < cells.length; r++) {
    for (let c = 0; c < cells[r].length; c++) {
      const targetRow = anchor.row + r
      const targetCol = anchor.col + c
      if (isHiddenByMerge(nextState.meta, targetRow, targetCol)) continue

      data[targetRow][targetCol] = cells[r][c] ?? ''

      const relKey = cellKey(r, c)
      const targetKey = styleKey(nextState.meta, targetRow, targetCol)

      if (alignments[relKey]) {
        metaAlignments[targetKey] = alignments[relKey]
      }

      if (cellStyles[relKey]) {
        metaCellStyles[targetKey] = { ...cellStyles[relKey] }
      }
    }
  }

  return {
    data,
    meta: {
      ...nextState.meta,
      alignments: metaAlignments,
      cellStyles: metaCellStyles,
    },
  }
}

export function clearSelectionCells(state: TableState, selection: CellSelection): TableState {
  const { r1, c1, r2, c2 } = normalizeSelection(selection)
  const data = state.data.map((row) => [...row])

  for (let row = r1; row <= r2; row++) {
    for (let col = c1; col <= c2; col++) {
      if (isHiddenByMerge(state.meta, row, col)) continue
      if (data[row]) data[row][col] = ''
    }
  }

  return { ...state, data }
}

export function setInternalClipboard(payload: TableClipboardPayload): void {
  internalClipboard = payload
}

export function getInternalClipboard(): TableClipboardPayload | null {
  return internalClipboard
}

export async function writeTextToSystemClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

export async function readTextFromSystemClipboard(): Promise<string> {
  if (navigator.clipboard?.readText) {
    return navigator.clipboard.readText()
  }
  return ''
}
