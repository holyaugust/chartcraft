import type { ParsedChartData, TableData } from '../types'
import { getCellNumericForChart, getComputedTable } from './formulaEngine'

function parseNumber(value: string): number {
  return getCellNumericForChart(value)
}

export function parseTableData(data: TableData): ParsedChartData | null {
  const computed = getComputedTable(data)
  if (computed.length < 2 || computed[0].length < 2) return null

  const headers = computed[0]
  const rows = computed.slice(1).filter((row) => row.some((cell) => cell.trim() !== '' && !cell.startsWith('#')))

  if (rows.length === 0) return null

  const categories = rows.map((row) => row[0]?.trim() || '')
  const series: { name: string; data: number[] }[] = []

  for (let col = 1; col < headers.length; col++) {
    const name = headers[col]?.trim() || `系列${col}`
    const values = rows.map((row) => parseNumber(row[col] ?? ''))
    if (values.some((v) => v !== 0) || rows.every((row) => (row[col] ?? '').trim() !== '')) {
      series.push({ name, data: values })
    }
  }

  if (series.length === 0) return null

  const scatterPoints =
    series.length >= 2
      ? categories.map((name, i) => ({
          name,
          value: [series[0].data[i], series[1].data[i]] as [number, number],
        }))
      : undefined

  return { categories, series, scatterPoints }
}

export function validateTableData(data: TableData): string | null {
  if (data.length < 2) return '至少需要表头和一行数据'
  if (data[0].length < 2) return '至少需要一列分类和一列数值'
  const parsed = parseTableData(data)
  if (!parsed) return '无法解析数据，请检查数值列格式'
  return null
}
