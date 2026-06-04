import * as XLSX from 'xlsx'
import type { CellAlign, CellStyle, TableData, TableState } from '../types'
import { createTableState } from '../types'
import { getCellAlign, getCellStyle } from './tableMeta'
import { isFormula } from './formulaEngine'
import { saveFile } from './saveFile'

type XlsxStyle = {
  font?: {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    sz?: number
    name?: string
  }
  alignment?: {
    horizontal?: string
    vertical?: string
  }
}

function mapHorizontalAlign(value?: string): CellAlign | null {
  switch (value) {
    case 'center':
    case 'centre':
      return 'center'
    case 'right':
      return 'right'
    case 'left':
      return 'left'
    default:
      return null
  }
}

function importCellMeta(cell: XLSX.CellObject): {
  align?: CellAlign
  style?: Partial<CellStyle>
} {
  const styleObject = cell.s as XlsxStyle | undefined
  if (!styleObject || typeof styleObject !== 'object') return {}

  const result: { align?: CellAlign; style?: Partial<CellStyle> } = {}
  const align = mapHorizontalAlign(styleObject.alignment?.horizontal)
  if (align) result.align = align

  const font = styleObject.font
  if (font) {
    const style: Partial<CellStyle> = {}
    if (font.bold) style.bold = true
    if (font.italic) style.italic = true
    if (font.underline) style.underline = true
    if (typeof font.sz === 'number' && Number.isFinite(font.sz)) {
      style.fontSize = font.sz
    }
    if (Object.keys(style).length > 0) result.style = style
  }

  return result
}

function cellValueFromSheet(cell: XLSX.CellObject | undefined): string {
  if (!cell) return ''
  if (cell.f) return `=${cell.f}`
  if (cell.w != null) return String(cell.w)
  if (cell.v != null) return String(cell.v)
  return ''
}

function sheetToTableState(sheet: XLSX.WorkSheet): TableState {
  const ref = sheet['!ref']
  if (!ref) return createTableState([['']])

  const range = XLSX.utils.decode_range(ref)
  const data: TableData = []
  const alignments: Record<string, CellAlign> = {}
  const cellStyles: Record<string, CellStyle> = {}

  for (let row = range.s.r; row <= range.e.r; row++) {
    const rowValues: string[] = []
    for (let col = range.s.c; col <= range.e.c; col++) {
      const addr = XLSX.utils.encode_cell({ r: row, c: col })
      const cell = sheet[addr] as XLSX.CellObject | undefined
      rowValues.push(cellValueFromSheet(cell))

      const imported = cell ? importCellMeta(cell) : {}
      const key = `${row},${col}`
      if (imported.align) alignments[key] = imported.align
      if (imported.style) cellStyles[key] = imported.style
    }
    data.push(rowValues)
  }

  const cleaned = data
    .map((row) =>
      row.map((cell) => {
        const raw = String(cell ?? '')
        return raw.startsWith('=') ? raw : raw.trim()
      }),
    )
    .filter((row, index) => index === 0 || row.some((cell) => cell !== ''))

  if (cleaned.length < 2) {
    throw new Error('Excel 文件至少需要包含表头和一行数据')
  }

  const merges = (sheet['!merges'] ?? []).map((merge) => ({
    row: merge.s.r,
    col: merge.s.c,
    rowSpan: merge.e.r - merge.s.r + 1,
    colSpan: merge.e.c - merge.s.c + 1,
  }))

  return {
    data: cleaned,
    meta: { alignments, cellStyles, merges },
  }
}

function buildExportCellStyle(style: CellStyle, align: CellAlign): XlsxStyle | undefined {
  const xlsxStyle: XlsxStyle = {
    alignment: {
      horizontal: align === 'center' ? 'center' : align === 'right' ? 'right' : 'left',
      vertical: 'center',
    },
  }

  const font: NonNullable<XlsxStyle['font']> = {}
  if (style.bold) font.bold = true
  if (style.italic) font.italic = true
  if (style.underline) font.underline = true
  if (style.fontSize) font.sz = style.fontSize
  if (Object.keys(font).length > 0) xlsxStyle.font = font

  return xlsxStyle
}

function tableStateToWorksheet(state: TableState): XLSX.WorkSheet {
  const { data, meta } = state
  const ws: XLSX.WorkSheet = {}

  let maxRow = 0
  let maxCol = 0

  data.forEach((row, rowIdx) => {
    row.forEach((value, colIdx) => {
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })
      maxRow = Math.max(maxRow, rowIdx)
      maxCol = Math.max(maxCol, colIdx)

      const trimmed = String(value ?? '')
      const align = getCellAlign(meta, rowIdx, colIdx)
      const style = getCellStyle(meta, rowIdx, colIdx)
      const xlsxStyle = buildExportCellStyle(style, align)

      if (isFormula(trimmed)) {
        ws[addr] = {
          f: trimmed.slice(1),
          t: 'n',
          ...(xlsxStyle ? { s: xlsxStyle } : {}),
        }
        return
      }

      const asNumber = Number(trimmed.replace(/[,，%％\s]/g, ''))
      if (trimmed !== '' && Number.isFinite(asNumber) && /^-?\d+(\.\d+)?$/.test(trimmed.replace(/[,，\s]/g, ''))) {
        ws[addr] = {
          v: asNumber,
          t: 'n',
          ...(xlsxStyle ? { s: xlsxStyle } : {}),
        }
        return
      }

      ws[addr] = {
        v: trimmed,
        t: 's',
        ...(xlsxStyle ? { s: xlsxStyle } : {}),
      }
    })
  })

  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: maxRow, c: maxCol },
  })

  if (meta.merges.length > 0) {
    ws['!merges'] = meta.merges.map((merge) => ({
      s: { r: merge.row, c: merge.col },
      e: {
        r: merge.row + merge.rowSpan - 1,
        c: merge.col + merge.colSpan - 1,
      },
    }))
  }

  return ws
}

export interface ExcelSheetInfo {
  name: string
  rowCount: number
  colCount: number
}

export interface ExcelWorkbookPreview {
  sheetNames: string[]
  sheets: ExcelSheetInfo[]
}

function readWorkbookFromFile(file: File): Promise<XLSX.WorkBook> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, {
          type: 'array',
          cellFormula: true,
          cellStyles: true,
        })
        resolve(workbook)
      } catch (err) {
        reject(err instanceof Error ? err : new Error('无法解析 Excel 文件，请确认文件格式正确'))
      }
    }

    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

function sheetDimensions(sheet: XLSX.WorkSheet): { rowCount: number; colCount: number } {
  const ref = sheet['!ref']
  if (!ref) return { rowCount: 0, colCount: 0 }
  const range = XLSX.utils.decode_range(ref)
  return {
    rowCount: range.e.r - range.s.r + 1,
    colCount: range.e.c - range.s.c + 1,
  }
}

export async function previewExcelFile(file: File): Promise<ExcelWorkbookPreview> {
  const workbook = await readWorkbookFromFile(file)
  const sheets = workbook.SheetNames.map((name) => {
    const { rowCount, colCount } = sheetDimensions(workbook.Sheets[name])
    return { name, rowCount, colCount }
  })
  return { sheetNames: workbook.SheetNames, sheets }
}

export async function parseExcelFile(file: File, sheetName?: string): Promise<TableState> {
  const sheets = await parseExcelSheets(file, sheetName ? [sheetName] : undefined)
  return sheets[0].state
}

export async function parseExcelSheets(
  file: File,
  sheetNames?: string[],
): Promise<{ name: string; state: TableState }[]> {
  const workbook = await readWorkbookFromFile(file)
  const names =
    sheetNames && sheetNames.length > 0
      ? sheetNames.filter((name) => workbook.SheetNames.includes(name))
      : workbook.SheetNames

  if (names.length === 0) {
    throw new Error('Excel 文件中没有可用的工作表')
  }

  const results: { name: string; state: TableState }[] = []
  const skipped: string[] = []

  for (const name of names) {
    try {
      results.push({ name, state: sheetToTableState(workbook.Sheets[name]) })
    } catch (err) {
      skipped.push(
        `${name}（${err instanceof Error ? err.message : '无法解析'}）`,
      )
    }
  }

  if (results.length === 0) {
    throw new Error(
      skipped.length > 0
        ? `没有可导入的工作表：${skipped.join('；')}`
        : '没有可导入的工作表',
    )
  }

  return results
}

export async function exportToExcel(
  state: TableState,
  filename = 'chart-data.xlsx',
): Promise<boolean> {
  const ws = tableStateToWorksheet(state)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '数据')
  const buffer = XLSX.write(wb, {
    bookType: 'xlsx',
    type: 'array',
    cellStyles: true,
  })
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  return saveFile(blob, {
    suggestedName: filename,
    description: 'Excel 工作簿',
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
  })
}
