import { createTableState, type TableState } from './table'

const DEFAULT_ROWS: TableState['data'] = [
  ['月份', '销售额', '利润', '成本'],
  ['1月', '8200', '2100', '6100'],
  ['2月', '9320', '2540', '6780'],
  ['3月', '9010', '2380', '6630'],
  ['4月', '9340', '2890', '6450'],
  ['5月', '12900', '3900', '9000'],
  ['6月', '13300', '4200', '9100'],
]

export interface WorkbookSheet {
  id: string
  name: string
  state: TableState
}

export interface WorkbookState {
  sheets: WorkbookSheet[]
  activeSheetId: string
}

export function newSheetId(): string {
  return `sheet-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createWorkbookFromSheets(
  entries: { name: string; state: TableState }[],
): WorkbookState {
  if (entries.length === 0) {
    return createDefaultWorkbook()
  }
  const sheets = entries.map((entry) => ({
    id: newSheetId(),
    name: entry.name,
    state: entry.state,
  }))
  return { sheets, activeSheetId: sheets[0].id }
}

export function createWorkbookFromTableState(state: TableState, name = '数据'): WorkbookState {
  return createWorkbookFromSheets([{ name, state }])
}

export function createDefaultWorkbook(): WorkbookState {
  return createWorkbookFromSheets([
    {
      name: '数据',
      state: createTableState(DEFAULT_ROWS.map((row) => [...row])),
    },
  ])
}

export function getActiveSheet(workbook: WorkbookState): WorkbookSheet {
  return (
    workbook.sheets.find((sheet) => sheet.id === workbook.activeSheetId) ?? workbook.sheets[0]
  )
}

export function getActiveTableState(workbook: WorkbookState): TableState {
  return getActiveSheet(workbook).state
}

export function createBlankSheetState(): TableState {
  return createTableState([
    ['', '', ''],
    ['', '', ''],
  ])
}

export function generateSheetName(existingNames: string[], base = 'Sheet'): string {
  const taken = new Set(existingNames.map((name) => name.trim()))
  if (!taken.has(base)) return base
  let index = 2
  while (taken.has(`${base}${index}`)) {
    index += 1
  }
  return `${base}${index}`
}

export function isSheetNameTaken(
  sheets: WorkbookSheet[],
  name: string,
  excludeId?: string,
): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  return sheets.some((sheet) => sheet.id !== excludeId && sheet.name === trimmed)
}
