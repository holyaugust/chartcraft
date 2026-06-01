import type { BarStyleId, ColorSchemeId } from '../types'

export interface ColorScheme {
  id: ColorSchemeId
  label: string
  colors: string[]
}

export const COLOR_SCHEMES: ColorScheme[] = [
  {
    id: 'default',
    label: '极光紫',
    colors: ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308'],
  },
  {
    id: 'ocean',
    label: '海洋蓝',
    colors: ['#0ea5e9', '#06b6d4', '#14b8a6', '#3b82f6', '#0284c7', '#0891b2'],
  },
  {
    id: 'sunset',
    label: '落日橙',
    colors: ['#f97316', '#fb923c', '#ef4444', '#f43f5e', '#eab308', '#f59e0b'],
  },
  {
    id: 'forest',
    label: '森林绿',
    colors: ['#22c55e', '#16a34a', '#84cc16', '#14b8a6', '#059669', '#65a30d'],
  },
  {
    id: 'vivid',
    label: '鲜明彩',
    colors: ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#a855f7'],
  },
  {
    id: 'pastel',
    label: '柔和粉',
    colors: ['#a5b4fc', '#c4b5fd', '#f9a8d4', '#fda4af', '#fdba74', '#fde047'],
  },
  {
    id: 'business',
    label: '商务蓝',
    colors: ['#1e40af', '#2563eb', '#475569', '#64748b', '#0f766e', '#334155'],
  },
  {
    id: 'mono',
    label: '简约灰',
    colors: ['#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#1e293b'],
  },
]

export const BAR_STYLE_LABELS: Record<BarStyleId, string> = {
  rounded: '圆角',
  flat: '直角',
  gradient: '渐变',
  capsule: '胶囊',
  outline: '描边',
  shadow: '阴影',
}

export function getColors(schemeId: ColorSchemeId): string[] {
  return COLOR_SCHEMES.find((s) => s.id === schemeId)?.colors ?? COLOR_SCHEMES[0].colors
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`
}

export function lightenColor(hex: string, amount = 0.35): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount)
}

export function alphaColor(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
