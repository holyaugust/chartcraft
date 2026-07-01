import type { PptBeautifyScreen } from '../types/pptBeautify'

export interface PptBeautifyScenarioCard {
  id: PptBeautifyScreen
  title: string
  summary: string
  duration: string
  fitFor: string
  icon: 'sparkles' | 'image' | 'library' | 'template'
}

export const PPT_BEAUTIFY_SCENARIO_CARDS: PptBeautifyScenarioCard[] = [
  {
    id: 'ai-wizard',
    title: 'AI 智能设计',
    summary: '上传 Word/PDF，选择视觉风格，AI 逐页生成设计稿',
    duration: '约 5–15 分钟',
    fitFor: '立项报告 · 工作汇报 · 方案提案',
    icon: 'sparkles',
  },
  {
    id: 'replica-wizard',
    title: '从截图还原',
    summary: '上传 PPT 页面截图，高保真还原为可编辑文件',
    duration: '按页数，约 1–3 分钟/页',
    fitFor: '复刻已有版式 · 千帆封面截图',
    icon: 'image',
  },
  {
    id: 'qianfan',
    title: '千帆文库模板',
    summary: '选用百度文库智能 PPT 模板，一键成稿',
    duration: '约 3–10 分钟',
    fitFor: '文库官方模板风 · 快速出稿',
    icon: 'library',
  },
  {
    id: 'template-export',
    title: '大纲 + 模板导出',
    summary: '先生成结构大纲，再套用内置/企业模板导出',
    duration: '约 1–5 分钟',
    fitFor: '公司固定模板 · 结构化导出',
    icon: 'template',
  },
]

export interface PptBeautifyPathCompareRow {
  label: string
  ai: string
  replica: string
  qianfan: string
  template: string
}

export const PPT_BEAUTIFY_PATH_COMPARE: PptBeautifyPathCompareRow[] = [
  {
    label: '输入',
    ai: 'Word / PDF',
    replica: 'PPT 截图',
    qianfan: 'Word / PDF',
    template: 'Word / 文本',
  },
  {
    label: '效果',
    ai: 'AI 原创视觉稿',
    replica: '贴近截图版式',
    qianfan: '文库模板风',
    template: '固定 HTML 模板',
  },
  {
    label: '耗时',
    ai: '5–15 分钟',
    replica: '按页数',
    qianfan: '3–10 分钟',
    template: '1–5 分钟',
  },
  {
    label: '需本地服务',
    ai: '是',
    replica: '是',
    qianfan: '是',
    template: '部分',
  },
]

export const PPT_BEAUTIFY_SCREEN_LABELS: Record<Exclude<PptBeautifyScreen, 'landing'>, string> = {
  'ai-wizard': 'AI 智能设计',
  'replica-wizard': '从截图还原',
  qianfan: '千帆文库模板',
  'template-export': '大纲 + 模板导出',
}
