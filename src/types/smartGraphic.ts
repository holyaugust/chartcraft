export type SmartGraphicCategory =
  | 'featured'
  | 'parallel'
  | 'hierarchy'
  | 'process'
  | 'cycle'
  | 'pyramid'

export type SmartGraphicLayoutKind =
  | 'parallel-horizontal'
  | 'parallel-vertical'
  | 'process-horizontal'
  | 'process-vertical'
  | 'cycle-ring'
  | 'pyramid-tier'
  | 'hierarchy-radial'
  | 'timeline-horizontal'
  | 'business-dashboard-4col'

export type SmartGraphicColumnKind = 'flow' | 'metrics-pair' | 'metrics-split' | 'metrics-row'

export interface SmartGraphicMetric {
  label: string
  value: string
}

export type SmartGraphicColorSchemeId =
  | 'blue'
  | 'teal'
  | 'violet'
  | 'orange'
  | 'slate'
  | 'rose'

export interface SmartGraphicItem {
  title: string
  body: string
  columnKind?: SmartGraphicColumnKind
  flowSteps?: string[]
  metrics?: SmartGraphicMetric[]
}

export interface SmartGraphicState {
  templateId: string
  title: string
  subtitle: string
  items: SmartGraphicItem[]
  colorSchemeId: SmartGraphicColorSchemeId
  footerGroupA?: string
  footerGroupB?: string
  /** 用户上传的参考图（data URL），仅本地草稿用 */
  sourceImageUrl?: string
}

export interface SmartGraphicTemplate {
  id: string
  name: string
  description: string
  category: SmartGraphicCategory
  layout: SmartGraphicLayoutKind
  itemCount: number
  accent: string
  sampleTitle: string
  sampleSubtitle: string
  sampleItems: SmartGraphicItem[]
  sampleFooterGroupA?: string
  sampleFooterGroupB?: string
  canvasHeight?: number
}

export const SMART_GRAPHIC_CATEGORY_LABELS: Record<SmartGraphicCategory, string> = {
  featured: '精选',
  parallel: '并列',
  hierarchy: '总分',
  process: '流程',
  cycle: '循环',
  pyramid: '金字塔',
}

export const DEFAULT_SMART_GRAPHIC_COLOR_SCHEME: SmartGraphicColorSchemeId = 'blue'
