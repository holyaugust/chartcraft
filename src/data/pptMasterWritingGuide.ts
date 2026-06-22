export interface PptMasterWritingExample {
  text: string
  caption: string
}

export interface PptMasterFieldGuide {
  title: string
  subtitle: string
  affects: string[]
  notFor: string[]
  tips: string[]
  placeholder: string
}

/** 生成要求：结构 + 视觉微调，统一写在同一输入框 */
export const PPT_MASTER_PROMPT_GUIDE: PptMasterFieldGuide = {
  title: '生成要求',
  subtitle: '说明怎么组织内容，也可补充视觉偏好（留白、气质、品牌色等）—— 左侧预设风格仍为基础',
  affects: [
    '页数、章节与叙述顺序',
    '面向谁、强调哪些结论',
    '视觉微调：如大留白、参考 Keynote、主色 #2563eb',
  ],
  notFor: ['正文数据本身（来自上传材料）', '完全替代左侧预设风格'],
  tips: [
    '结构 + 视觉可写在一起，如「10 页面向管理层，大留白、少装饰」',
    '预设风格管整体基调，此处写个性化补充即可',
  ],
  placeholder:
    '例：8–10 页，按「背景-方案-计划」分章；大留白、稳重专业，品牌主色 #2563eb…',
}

export const PPT_MASTER_STYLE_NOTE_EXAMPLES: PptMasterWritingExample[] = [
  { text: '参考 Apple Keynote，大留白、少元素', caption: '视觉 · 极简' },
  { text: '稳重专业，卡片分区清晰，少装饰', caption: '视觉 · 商务' },
  { text: '企业品牌色 #2563eb 为主，扁平简洁', caption: '视觉 · 品牌色' },
]

export const PPT_MASTER_PROMPT_EXAMPLES: PptMasterWritingExample[] = [
  { text: '10 页以内，第一页封面、最后一页致谢，中间分 3 章', caption: '结构 · 页数' },
  { text: '面向管理层，先写核心结论，再展开论据', caption: '结构 · 受众' },
  { text: '按「背景-现状-方案-计划」四段式组织', caption: '结构 · 章节' },
  { text: '每页 bullet 不超过 4 条，保留关键数据', caption: '结构 · 密度' },
]

export function mergePromptExamples(
  styleSpecific: PptMasterWritingExample[],
  limit = 4,
): PptMasterWritingExample[] {
  const seen = new Set<string>()
  const merged: PptMasterWritingExample[] = []
  for (const item of [...styleSpecific, ...PPT_MASTER_PROMPT_EXAMPLES, ...PPT_MASTER_STYLE_NOTE_EXAMPLES]) {
    if (seen.has(item.text)) continue
    seen.add(item.text)
    merged.push(item)
    if (merged.length >= limit) break
  }
  return merged
}
