import type { CellNumberFormat } from '../types/table'

export const NUMBER_FORMAT_LABELS: Record<CellNumberFormat, string> = {
  general: '常规',
  number: '数字',
  currency: '货币',
  percent: '百分比',
  date: '日期',
  text: '文本',
}

function parseNumeric(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  const normalized = trimmed.replace(/,/g, '').replace(/[¥$€]/g, '')
  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}

function parseAsDate(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(trimmed)) {
    const d = new Date(trimmed.replace(/\//g, '-'))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const serial = Number(trimmed)
  if (Number.isFinite(serial) && serial > 20000 && serial < 60000) {
    const d = new Date(Date.UTC(1899, 11, 30 + serial))
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

export function formatCellDisplay(value: string, format: CellNumberFormat): string {
  if (!value || value.startsWith('#')) return value

  switch (format) {
    case 'general':
    case 'text':
      return value
    case 'number': {
      const num = parseNumeric(value)
      if (num === null) return value
      return num.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
    }
    case 'currency': {
      const num = parseNumeric(value)
      if (num === null) return value
      return num.toLocaleString('zh-CN', {
        style: 'currency',
        currency: 'CNY',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    }
    case 'percent': {
      const num = parseNumeric(value)
      if (num === null) return value
      const pct = Math.abs(num) <= 1 && !value.includes('%') ? num * 100 : num
      return `${pct.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}%`
    }
    case 'date': {
      const d = parseAsDate(value)
      if (d) return formatDate(d)
      const num = parseNumeric(value)
      if (num !== null) {
        const fromSerial = parseAsDate(String(num))
        if (fromSerial) return formatDate(fromSerial)
      }
      return value
    }
    default:
      return value
  }
}
