import type { TableData } from '../types'

export function transposeTable(data: TableData): TableData {
  if (data.length === 0) return data

  const maxCols = Math.max(...data.map((row) => row.length))
  const normalized = data.map((row) => {
    const padded = [...row]
    while (padded.length < maxCols) padded.push('')
    return padded
  })

  return Array.from({ length: maxCols }, (_, col) =>
    normalized.map((row) => row[col] ?? ''),
  )
}
