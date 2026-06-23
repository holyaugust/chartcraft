export type QianfanPptJobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export type QianfanPageRange = '1-10' | '11-20' | '21-30' | '31-40' | '40+'

export type QianfanLayoutMode = '1' | '2'

export type QianfanGenMode = 1 | 2

export interface QianfanPptTheme {
  tpl_id: number
  style_id: number
  style_name_list: string[]
  color_list: string[]
  main_img_url: string
}

export interface QianfanPptJobProgress {
  step: string
  percent: number
  message: string
}

export interface QianfanPptJobRecord {
  job_id: string
  status: QianfanPptJobStatus
  created_at: string
  updated_at: string
  prompt: string
  source_name: string
  engine: string
  tpl_id?: number | null
  style_id?: number | null
  page_range: string
  layout: string
  gen_mode: number
  progress: QianfanPptJobProgress
  error?: string | null
  slide_count?: number | null
  logs: string[]
}

export interface QianfanPptHealth {
  ok: boolean
  api_configured: boolean
  version: string
}

export const QIANFAN_PAGE_RANGE_OPTIONS: { value: QianfanPageRange; label: string }[] = [
  { value: '1-10', label: '1–10 页' },
  { value: '11-20', label: '11–20 页' },
  { value: '21-30', label: '21–30 页' },
  { value: '31-40', label: '31–40 页' },
  { value: '40+', label: '40 页以上' },
]

export const QIANFAN_LAYOUT_OPTIONS: { value: QianfanLayoutMode; label: string }[] = [
  { value: '1', label: '简约模式' },
  { value: '2', label: '专业模式' },
]

export const QIANFAN_GEN_MODE_OPTIONS: { value: QianfanGenMode; label: string; hint: string }[] = [
  { value: 1, label: '智能润色', hint: '在材料基础上优化表达与结构' },
  { value: 2, label: '严格依从', hint: '尽量忠实于源文档（建议提供公网 resource_url）' },
]

export function qianfanThemeLabel(theme: QianfanPptTheme): string {
  const name = theme.style_name_list.find(Boolean)
  if (name) return name
  return `模板 ${theme.tpl_id}`
}

export function qianfanThemeKey(theme: QianfanPptTheme): string {
  return `${theme.style_id}-${theme.tpl_id}`
}
