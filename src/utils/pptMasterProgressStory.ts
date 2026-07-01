import type { PptMasterJobRecord } from '../types/pptMaster'

export interface ProgressStoryStep {
  id: string
  label: string
  state: 'done' | 'active' | 'pending'
}

const CREATIVE_STEPS: { id: string; label: string }[] = [
  { id: 'convert', label: '已读取材料' },
  { id: 'plan', label: '正在规划页结构' },
  { id: 'design', label: '正在制定视觉规范' },
  { id: 'render', label: '正在设计各页' },
  { id: 'export', label: '导出可编辑 PPT' },
]

const REPLICA_STEPS: { id: string; label: string }[] = [
  { id: 'prepare', label: '已接收参照页' },
  { id: 'plan', label: '已锁定页顺序' },
  { id: 'render', label: '正在逐页还原' },
  { id: 'export', label: '导出可编辑 PPT' },
]

const STEP_ORDER = ['prepare', 'convert', 'plan', 'design', 'render', 'export', 'done'] as const

function stepIndex(step: string): number {
  const idx = STEP_ORDER.indexOf(step as (typeof STEP_ORDER)[number])
  return idx >= 0 ? idx : 0
}

export function buildMasterProgressStory(
  job: PptMasterJobRecord | null,
  isReplica: boolean,
): ProgressStoryStep[] {
  const template = isReplica ? REPLICA_STEPS : CREATIVE_STEPS
  if (!job) {
    return template.map((item) => ({ ...item, state: 'pending' as const }))
  }

  if (job.status === 'succeeded') {
    return template.map((item) => ({ ...item, state: 'done' as const }))
  }

  if (job.status === 'failed') {
    const current = stepIndex(job.progress.step)
    return template.map((item) => {
      const itemIdx = stepIndex(item.id)
      if (itemIdx < current) return { ...item, state: 'done' as const }
      if (itemIdx === current) return { ...item, state: 'active' as const }
      return { ...item, state: 'pending' as const }
    })
  }

  const current = stepIndex(job.progress.step)
  return template.map((item) => {
    const itemIdx = stepIndex(item.id)
    if (itemIdx < current) return { ...item, state: 'done' }
    if (itemIdx === current) return { ...item, state: 'active' }
    return { ...item, state: 'pending' }
  })
}

export function friendlyProgressHeadline(job: PptMasterJobRecord | null, isReplica: boolean): string {
  if (!job) return isReplica ? '准备还原…' : '准备生成…'
  if (job.status === 'succeeded') return 'PPT 已生成完成'
  if (job.status === 'failed') return '生成未完成'
  if (job.progress.step === 'render') {
    return isReplica ? '正在还原你的 PPT…' : 'AI 正在设计你的 PPT…'
  }
  return isReplica ? '正在处理参照页…' : 'AI 正在设计你的 PPT…'
}
