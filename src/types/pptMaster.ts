export type PptMasterJobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export type PptMasterStyle =
  | 'business'
  | 'tech'
  | 'academic'
  | 'editorial'
  | 'minimal'
  | 'dark'
  | 'creative'
  | 'warm'
  | 'luxury'
  | 'gov'

export interface PptMasterJobProgress {
  step: string
  percent: number
  message: string
}

export interface PptMasterJobRecord {
  job_id: string
  status: PptMasterJobStatus
  created_at: string
  updated_at: string
  prompt: string
  style: PptMasterStyle
  style_note?: string
  primary_color?: string
  source_name: string
  progress: PptMasterJobProgress
  error?: string | null
  slide_count?: number | null
  logs: string[]
}

export interface PptMasterHealth {
  ok: boolean
  ppt_master_home: string
  ppt_master_ready: boolean
  llm_configured: boolean
  render_mode: string
  plan_model: string
  visual_model: string
  qianfan_configured?: boolean
  version: string
}

export const PPT_MASTER_STYLES: PptMasterStyle[] = [
  'business',
  'tech',
  'academic',
  'editorial',
  'minimal',
  'dark',
  'creative',
  'warm',
  'luxury',
  'gov',
]

export const PPT_MASTER_STYLE_LABELS: Record<PptMasterStyle, string> = {
  business: '商务汇报',
  tech: '科技蓝',
  academic: '学术绿',
  editorial: '杂志 editorial',
  minimal: '极简灰白',
  dark: '深色数据',
  creative: '创意渐变',
  warm: '暖色品牌',
  luxury: '轻奢金',
  gov: '政务正式',
}

export const PPT_MASTER_STYLE_HINTS: Record<PptMasterStyle, string> = {
  business: '青绿渐变 · 董事会汇报',
  tech: '深蓝科技 · 产品发布',
  academic: '学术绿 · 调研报告',
  editorial: '杂志排版 · 大留白',
  minimal: '灰白极简 · 低干扰',
  dark: '深色看板 · 数据密集',
  creative: '紫粉渐变 · 品牌故事',
  warm: '暖橙珊瑚 · 营销传播',
  luxury: '黑金轻奢 · 高端提案',
  gov: '红蓝正式 · 政策汇报',
}

export type PptOutlineGenerateMode = 'outline' | 'ppt-master'

export const PPT_OUTLINE_GENERATE_MODE_LABELS: Record<PptOutlineGenerateMode, string> = {
  outline: '文本大纲',
  'ppt-master': 'AI 设计稿',
}

export const PPT_OUTLINE_GENERATE_MODE_HINTS: Record<PptOutlineGenerateMode, string> = {
  outline: '快速规划结构 → 阶段 2–4 模板美化',
  'ppt-master': 'Sidecar 逐页 AI 成稿 → 生成后直接下载',
}

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value.trim())
}

export function normalizeHexColor(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return isValidHexColor(withHash) ? withHash.toLowerCase() : ''
}

export function formatPptMasterStyleSummary(
  style: PptMasterStyle,
  styleNote?: string,
  primaryColor?: string,
): string {
  const parts = [PPT_MASTER_STYLE_LABELS[style]]
  const color = normalizeHexColor(primaryColor ?? '')
  if (color) parts.push(`主色 ${color}`)
  if (styleNote?.trim()) parts.push('已附加自定义描述')
  return parts.join(' · ')
}
