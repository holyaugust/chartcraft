export type CellAlign = 'left' | 'center' | 'right'

export interface CellMerge {
  row: number
  col: number
  rowSpan: number
  colSpan: number
}

export interface TableMeta {
  alignments: Record<string, CellAlign>
  merges: CellMerge[]
}

export interface TableState {
  data: TableData
  meta: TableMeta
}

export type TableData = string[][]

export const EMPTY_TABLE_META: TableMeta = { alignments: {}, merges: [] }

export function createTableState(data: TableData): TableState {
  return { data, meta: { alignments: {}, merges: [] } }
}
