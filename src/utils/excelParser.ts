import * as XLSX from 'xlsx'
import type { TableData } from '../types'

export function parseExcelFile(file: File): Promise<TableData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<string[]>(firstSheet, {
          header: 1,
          defval: '',
          raw: false,
        }) as TableData

        const cleaned = json
          .map((row) => row.map((cell) => String(cell ?? '').trim()))
          .filter((row) => row.some((cell) => cell !== ''))

        if (cleaned.length < 2) {
          reject(new Error('Excel 文件至少需要包含表头和一行数据'))
          return
        }

        resolve(cleaned)
      } catch {
        reject(new Error('无法解析 Excel 文件，请确认文件格式正确'))
      }
    }

    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsArrayBuffer(file)
  })
}

export function exportToExcel(data: TableData, filename = 'chart-data.xlsx') {
  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '数据')
  XLSX.writeFile(wb, filename)
}
