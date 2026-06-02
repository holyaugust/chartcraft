export type CellAlign = 'left' | 'center' | 'right'

export type CellNumberFormat = 'general' | 'number' | 'currency' | 'percent' | 'date' | 'text'

export interface CellStyle {
  fontFamily?: string
  fontSize?: number
  bold?: boolean
  italic?: boolean
  underline?: boolean
  numberFormat?: CellNumberFormat
}

export interface CellMerge {
  row: number
  col: number
  rowSpan: number
  colSpan: number
}

export interface TableMeta {
  alignments: Record<string, CellAlign>
  cellStyles: Record<string, CellStyle>
  merges: CellMerge[]
}

export interface TableState {
  data: TableData
  meta: TableMeta
}

export type TableData = string[][]

export const EMPTY_TABLE_META: TableMeta = { alignments: {}, cellStyles: {}, merges: [] }

export function createTableState(data: TableData): TableState {
  return { data, meta: { alignments: {}, cellStyles: {}, merges: [] } }
}
