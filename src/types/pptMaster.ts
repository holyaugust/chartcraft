export type PptMasterJobStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export type PptMasterStyle = 'business' | 'editorial' | 'minimal' | 'dark'

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
  version: string
}

export const PPT_MASTER_STYLE_LABELS: Record<PptMasterStyle, string> = {
  business: '商务汇报',
  editorial: '杂志 editorial',
  minimal: '极简灰白',
  dark: '深色数据',
}

export type PptOutlineGenerateMode = 'outline' | 'ppt-master'

export const PPT_OUTLINE_GENERATE_MODE_LABELS: Record<PptOutlineGenerateMode, string> = {
  outline: '标准大纲',
  'ppt-master': '智能设计稿',
}
