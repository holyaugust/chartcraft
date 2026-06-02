import type { CellAlign, CellMerge, TableMeta, TableState } from '../types/table'

export function cellKey(row: number, col: number): string {
  return `${row},${col}`
}

export interface CellSelection {
  start: { row: number; col: number }
  end: { row: number; col: number }
}

export function normalizeSelection(selection: CellSelection) {
  return {
    r1: Math.min(selection.start.row, selection.end.row),
    c1: Math.min(selection.start.col, selection.end.col),
    r2: Math.max(selection.start.row, selection.end.row),
    c2: Math.max(selection.start.col, selection.end.col),
  }
}

function mergeBounds(m: CellMerge) {
  return {
    r1: m.row,
    c1: m.col,
    r2: m.row + m.rowSpan - 1,
    c2: m.col + m.colSpan - 1,
  }
}

function rectsOverlap(
  a: { r1: number; c1: number; r2: number; c2: number },
  b: { r1: number; c1: number; r2: number; c2: number },
): boolean {
  return !(a.r1 > b.r2 || a.r2 < b.r1 || a.c1 > b.c2 || a.c2 < b.c1)
}

export function findMergeAt(meta: TableMeta, row: number, col: number): CellMerge | null {
  for (const merge of meta.merges) {
    const { r1, c1, r2, c2 } = mergeBounds(merge)
    if (row >= r1 && row <= r2 && col >= c1 && col <= c2) return merge
  }
  return null
}

export function isHiddenByMerge(meta: TableMeta, row: number, col: number): boolean {
  const merge = findMergeAt(meta, row, col)
  return merge !== null && (merge.row !== row || merge.col !== col)
}

export function getCellAlign(meta: TableMeta, row: number, col: number): CellAlign {
  const anchor = findMergeAt(meta, row, col)
  const key = cellKey(anchor?.row ?? row, anchor?.col ?? col)
  const saved = meta.alignments[key]
  if (saved) return saved
  if (row === 0) return 'center'
  if (col === 0) return 'left'
  return 'right'
}

function removeOverlappingMerges(
  meta: TableMeta,
  bounds: { r1: number; c1: number; r2: number; c2: number },
) {
  return meta.merges.filter((merge) => !rectsOverlap(mergeBounds(merge), bounds))
}

export function setSelectionAlign(
  state: TableState,
  selection: CellSelection,
  align: CellAlign,
): TableState {
  const { r1, c1, r2, c2 } = normalizeSelection(selection)
  const alignments = { ...state.meta.alignments }

  for (let row = r1; row <= r2; row++) {
    for (let col = c1; col <= c2; col++) {
      if (isHiddenByMerge(state.meta, row, col)) continue
      const merge = findMergeAt(state.meta, row, col)
      const targetRow = merge?.row ?? row
      const targetCol = merge?.col ?? col
      alignments[cellKey(targetRow, targetCol)] = align
    }
  }

  return { ...state, meta: { ...state.meta, alignments } }
}

export function mergeSelection(state: TableState, selection: CellSelection): TableState {
  const { r1, c1, r2, c2 } = normalizeSelection(selection)
  if (r1 === r2 && c1 === c2) return state

  const topLeftValue = state.data[r1]?.[c1] ?? ''
  const data = state.data.map((row, rowIdx) =>
    row.map((cell, colIdx) => {
      if (rowIdx >= r1 && rowIdx <= r2 && colIdx >= c1 && colIdx <= c2) {
        return rowIdx === r1 && colIdx === c1 ? topLeftValue : ''
      }
      return cell
    }),
  )

  const bounds = normalizeSelection(selection)
  const merges = [
    ...removeOverlappingMerges(state.meta, bounds),
    { row: r1, col: c1, rowSpan: r2 - r1 + 1, colSpan: c2 - c1 + 1 },
  ]

  return { data, meta: { ...state.meta, merges } }
}

export function unmergeAt(state: TableState, row: number, col: number): TableState {
  const merge = findMergeAt(state.meta, row, col)
  if (!merge || (merge.rowSpan === 1 && merge.colSpan === 1)) return state

  return {
    ...state,
    meta: {
      ...state.meta,
      merges: state.meta.merges.filter((m) => m !== merge),
    },
  }
}

function shiftMetaForRowRemoval(meta: TableMeta, removedRow: number): TableMeta {
  const alignments: Record<string, CellAlign> = {}
  for (const [key, align] of Object.entries(meta.alignments)) {
    const [rowStr, colStr] = key.split(',')
    const row = Number(rowStr)
    const col = Number(colStr)
    if (row === removedRow) continue
    alignments[cellKey(row > removedRow ? row - 1 : row, col)] = align
  }

  const merges: CellMerge[] = []
  for (const merge of meta.merges) {
    const { r2 } = mergeBounds(merge)
    if (removedRow >= merge.row && removedRow <= r2) {
      if (merge.rowSpan === 1) continue
      const nextSpan = merge.rowSpan - 1
      if (nextSpan <= 0) continue
      merges.push({
        ...merge,
        row: merge.row > removedRow ? merge.row - 1 : merge.row,
        rowSpan: nextSpan,
      })
      continue
    }
    merges.push({
      ...merge,
      row: merge.row > removedRow ? merge.row - 1 : merge.row,
    })
  }

  return { alignments, merges }
}

function shiftMetaForColRemoval(meta: TableMeta, removedCol: number): TableMeta {
  const alignments: Record<string, CellAlign> = {}
  for (const [key, align] of Object.entries(meta.alignments)) {
    const [rowStr, colStr] = key.split(',')
    const row = Number(rowStr)
    const col = Number(colStr)
    if (col === removedCol) continue
    alignments[cellKey(row, col > removedCol ? col - 1 : col)] = align
  }

  const merges: CellMerge[] = []
  for (const merge of meta.merges) {
    const { c2 } = mergeBounds(merge)
    if (removedCol >= merge.col && removedCol <= c2) {
      if (merge.colSpan === 1) continue
      const nextSpan = merge.colSpan - 1
      if (nextSpan <= 0) continue
      merges.push({
        ...merge,
        col: merge.col > removedCol ? merge.col - 1 : merge.col,
        colSpan: nextSpan,
      })
      continue
    }
    merges.push({
      ...merge,
      col: merge.col > removedCol ? merge.col - 1 : merge.col,
    })
  }

  return { alignments, merges }
}

export function addTableRow(state: TableState): TableState {
  const cols = state.data[0]?.length ?? 2
  return { ...state, data: [...state.data, Array(cols).fill('')] }
}

export function removeTableRow(state: TableState): TableState {
  if (state.data.length <= 2) return state
  const removedRow = state.data.length - 1
  return {
    data: state.data.slice(0, -1),
    meta: shiftMetaForRowRemoval(state.meta, removedRow),
  }
}

export function addTableCol(state: TableState): TableState {
  return {
    ...state,
    data: state.data.map((row) => [...row, '']),
  }
}

export function removeTableCol(state: TableState): TableState {
  if ((state.data[0]?.length ?? 0) <= 2) return state
  const removedCol = (state.data[0]?.length ?? 1) - 1
  return {
    data: state.data.map((row) => row.slice(0, -1)),
    meta: shiftMetaForColRemoval(state.meta, removedCol),
  }
}

export function transposeTableState(state: TableState): TableState {
  if (state.data.length === 0) return state

  const maxCols = Math.max(...state.data.map((row) => row.length))
  const normalized = state.data.map((row) => {
    const padded = [...row]
    while (padded.length < maxCols) padded.push('')
    return padded
  })

  const data = Array.from({ length: maxCols }, (_, col) =>
    normalized.map((row) => row[col] ?? ''),
  )

  const alignments: Record<string, CellAlign> = {}
  for (const [key, align] of Object.entries(state.meta.alignments)) {
    const [rowStr, colStr] = key.split(',')
    alignments[cellKey(Number(colStr), Number(rowStr))] = align
  }

  const merges = state.meta.merges.map((merge) => ({
    row: merge.col,
    col: merge.row,
    rowSpan: merge.colSpan,
    colSpan: merge.rowSpan,
  }))

  return { data, meta: { alignments, merges } }
}

export function isCellSelected(selection: CellSelection | null, row: number, col: number): boolean {
  if (!selection) return false
  const { r1, c1, r2, c2 } = normalizeSelection(selection)
  return row >= r1 && row <= r2 && col >= c1 && col <= c2
}

export function selectionSize(selection: CellSelection): number {
  const { r1, c1, r2, c2 } = normalizeSelection(selection)
  return (r2 - r1 + 1) * (c2 - c1 + 1)
}
