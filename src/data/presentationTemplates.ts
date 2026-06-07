import type { PresentationTemplate } from '../types/presentation'

const SOE_BLUE = '1E3A8A'
const SOE_GOLD = 'B45309'
const SOE_BG = 'F8FAFC'

export const PRESENTATION_TEMPLATES: PresentationTemplate[] = [
  {
    id: 'ppt-gongzuo-huibao',
    name: '工作汇报',
    description: '年度/季度/月度工作总结，成效—问题—计划结构',
    sceneHint: '适用于部门常规工作汇报、阶段性总结，突出数据成效与下一步安排。',
    suggestedStructure: '封面 → 工作概述 → 主要成效（2～3页）→ 存在问题 → 下步计划 → 致谢',
    theme: {
      primaryColor: SOE_BLUE,
      accentColor: SOE_GOLD,
      backgroundColor: SOE_BG,
      titleFontFace: 'Microsoft YaHei',
      bodyFontFace: 'Microsoft YaHei',
    },
  },
  {
    id: 'ppt-zhuanti-huibao',
    name: '专题汇报',
    description: '专项工作、项目推进、调研成果专题汇报',
    sceneHint: '适用于单一主题深度汇报，强调背景、做法、成效与建议。',
    suggestedStructure: '封面 → 背景与意义 → 工作做法 → 阶段成效 → 经验启示 → 下一步建议 → 致谢',
    theme: {
      primaryColor: '0F766E',
      accentColor: '0369A1',
      backgroundColor: SOE_BG,
      titleFontFace: 'Microsoft YaHei',
      bodyFontFace: 'Microsoft YaHei',
    },
  },
  {
    id: 'ppt-shuzhi',
    name: '述职汇报',
    description: '干部述职、岗位履职、年度考核陈述',
    sceneHint: '适用于个人述职，突出履职情况、廉洁自律与改进方向。',
    suggestedStructure: '封面 → 岗位职责 → 履职情况 → 亮点工作 → 不足与改进 → 结束页',
    theme: {
      primaryColor: '4338CA',
      accentColor: SOE_GOLD,
      backgroundColor: SOE_BG,
      titleFontFace: 'Microsoft YaHei',
      bodyFontFace: 'Microsoft YaHei',
    },
  },
]

export function getPresentationTemplateById(id: string): PresentationTemplate | undefined {
  return PRESENTATION_TEMPLATES.find((item) => item.id === id)
}
