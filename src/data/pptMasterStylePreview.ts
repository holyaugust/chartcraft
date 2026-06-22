import type { PptMasterStyle } from '../types/pptMaster'
import type { PptMasterWritingExample } from './pptMasterWritingGuide'

export interface PptMasterStylePreview {
  description: string
  scene: string
  preview: {
    slideBackground: string
    headerBackground: string
    accent: string
    titleColor: string
    bodyColor: string
    cardBackground: string
    decoration?: string
  }
  styleNoteExamples: PptMasterWritingExample[]
  promptExamples: PptMasterWritingExample[]
}

export const PPT_MASTER_STYLE_PREVIEWS: Record<PptMasterStyle, PptMasterStylePreview> = {
  business: {
    description: '青绿渐变搭配白色卡片，层次清晰，适合董事会汇报与年度总结。',
    scene: '工作汇报 · 项目复盘 · 经营分析',
    preview: {
      slideBackground: 'linear-gradient(135deg, #0f766e 0%, #134e4a 100%)',
      headerBackground: 'linear-gradient(125deg, #0f766e 0%, #14b8a6 100%)',
      accent: '#14b8a6',
      titleColor: '#ffffff',
      bodyColor: '#1e293b',
      cardBackground: 'rgba(255,255,255,0.96)',
      decoration: 'radial-gradient(circle at 88% 18%, rgba(20,184,166,0.35) 0%, transparent 50%)',
    },
    styleNoteExamples: [
      { text: '稳重专业，少装饰多数据', caption: '高密度商务信息页' },
      { text: '参考 McKinsey 咨询风格，卡片分区清晰', caption: '咨询报告式分区' },
    ],
    promptExamples: [
      { text: '10 页以内，突出核心结论与行动项', caption: '页数 + 强调结论' },
      { text: '面向管理层，先结论后论据', caption: '受众 + 叙述顺序' },
    ],
  },
  tech: {
    description: '深蓝底配青色高亮，几何线条与玻璃感卡片，适合产品发布与技术方案。',
    scene: '产品发布 · 技术方案 · 创新汇报',
    preview: {
      slideBackground: 'linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)',
      headerBackground: 'linear-gradient(125deg, #1e40af 0%, #06b6d4 100%)',
      accent: '#06b6d4',
      titleColor: '#f8fafc',
      bodyColor: '#1e293b',
      cardBackground: 'rgba(255,255,255,0.94)',
      decoration: 'radial-gradient(circle at 92% 12%, rgba(6,182,212,0.4) 0%, transparent 45%)',
    },
    styleNoteExamples: [
      { text: '偏 Apple Keynote，大留白', caption: '极简 Keynote 气质' },
      { text: '多用图标与流程图，科技感强', caption: '技术方案视觉' },
    ],
    promptExamples: [
      { text: '面向开发者，强调架构与性能', caption: '受众 + 技术重点' },
      { text: '12 页，按「背景-方案-路线图」结构', caption: '产品发布结构' },
    ],
  },
  academic: {
    description: '森林绿主色搭配金色点缀，规整学术排版，适合调研报告与学院汇报。',
    scene: '调研报告 · 课题答辩 · 学术分享',
    preview: {
      slideBackground: 'linear-gradient(135deg, #14532d 0%, #1f6b4f 100%)',
      headerBackground: 'linear-gradient(125deg, #166534 0%, #2d8a62 100%)',
      accent: '#fbbf24',
      titleColor: '#ffffff',
      bodyColor: '#1e293b',
      cardBackground: 'rgba(255,255,255,0.95)',
      decoration: 'radial-gradient(circle at 85% 20%, rgba(251,191,36,0.3) 0%, transparent 50%)',
    },
    styleNoteExamples: [
      { text: '严谨学术风，引用与数据块分明', caption: '论文/调研排版' },
      { text: '绿色为主，图表区域留足空间', caption: '数据图表优先' },
    ],
    promptExamples: [
      { text: '按「摘要-方法-结果-讨论」组织', caption: '学术四段式' },
      { text: '8–10 页，语言正式，保留术语', caption: '页数 + 语言风格' },
    ],
  },
  editorial: {
    description: '杂志式大标题与宽留白，石色底配橙色点缀，适合品牌故事与深度内容。',
    scene: '品牌故事 · 深度专题 · 文化展示',
    preview: {
      slideBackground: 'linear-gradient(135deg, #44403c 0%, #1c1917 100%)',
      headerBackground: 'linear-gradient(125deg, #292524 0%, #57534e 100%)',
      accent: '#f97316',
      titleColor: '#fafaf9',
      bodyColor: '#292524',
      cardBackground: 'rgba(250,250,249,0.96)',
      decoration: 'radial-gradient(circle at 10% 90%, rgba(249,115,22,0.25) 0%, transparent 45%)',
    },
    styleNoteExamples: [
      { text: '像杂志封面一样强调标题字重', caption: '大标题 + 强排版' },
      { text: '大图占位 + 短句，少 bullet', caption: '叙事型低列表密度' },
    ],
    promptExamples: [
      { text: '叙事感强，每页一个核心观点', caption: '一页一观点' },
      { text: '面向媒体/客户，语气克制有质感', caption: '受众 + 语气' },
    ],
  },
  minimal: {
    description: '灰白背景、细线与克制排版，信息密度低，适合简洁专业的场合。',
    scene: '内部简报 · 极简提案 · 清晰传达',
    preview: {
      slideBackground: 'linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%)',
      headerBackground: '#ffffff',
      accent: '#334155',
      titleColor: '#0f172a',
      bodyColor: '#334155',
      cardBackground: '#ffffff',
      decoration: 'linear-gradient(90deg, #334155 0%, #334155 72px, transparent 72px)',
    },
    styleNoteExamples: [
      { text: '瑞士极简，仅水平分隔线', caption: '极简线条风' },
      { text: '黑白灰为主，一种 accent 色即可', caption: '克制配色' },
    ],
    promptExamples: [
      { text: '每页不超过 3 条要点', caption: '低密度信息' },
      { text: '去掉装饰，突出文字层次', caption: '内容优先' },
    ],
  },
  dark: {
    description: '深色看板风格，青色数据高亮，对比强，适合数据分析与运营复盘。',
    scene: '数据看板 · 运营复盘 · 指标汇报',
    preview: {
      slideBackground: 'linear-gradient(135deg, #0b1220 0%, #111827 100%)',
      headerBackground: 'linear-gradient(125deg, #0f172a 0%, #1e293b 100%)',
      accent: '#38bdf8',
      titleColor: '#f8fafc',
      bodyColor: '#e2e8f0',
      cardBackground: 'rgba(17,24,39,0.92)',
      decoration: 'radial-gradient(circle at 80% 15%, rgba(56,189,248,0.25) 0%, transparent 50%)',
    },
    styleNoteExamples: [
      { text: 'Bloomberg 式信息密度，图表优先', caption: '数据看板风' },
      { text: '深色底，数字与 KPI 高亮', caption: '指标高亮' },
    ],
    promptExamples: [
      { text: '突出同比/环比与关键指标', caption: '数据 emphasis' },
      { text: '10 页，先总览后分模块数据', caption: '总览 + 分模块' },
    ],
  },
  creative: {
    description: '紫粉橙渐变与不对称布局，视觉张力强，适合营销传播与创意提案。',
    scene: '营销方案 · 创意提案 · 活动发布',
    preview: {
      slideBackground: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
      headerBackground: 'linear-gradient(125deg, #6d28d9 0%, #f97316 100%)',
      accent: '#f97316',
      titleColor: '#ffffff',
      bodyColor: '#1e293b',
      cardBackground: 'rgba(255,255,255,0.95)',
      decoration: 'radial-gradient(circle at 15% 85%, rgba(251,191,36,0.35) 0%, transparent 40%)',
    },
    styleNoteExamples: [
      { text: '大胆渐变，可不对称构图', caption: '创意视觉张力' },
      { text: '偏年轻化，适合社交媒体主题', caption: '年轻营销风' },
    ],
    promptExamples: [
      { text: '8 页，讲清活动创意与传播节奏', caption: '营销活动结构' },
      { text: '面向 Z 世代，语气活泼但不失专业', caption: '受众 + 语气' },
    ],
  },
  warm: {
    description: '暖橙与琥珀色调，圆角友好卡片，适合消费者品牌与团队文化分享。',
    scene: '品牌传播 · 团队文化 · 用户故事',
    preview: {
      slideBackground: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
      headerBackground: 'linear-gradient(125deg, #c2410c 0%, #fbbf24 100%)',
      accent: '#fbbf24',
      titleColor: '#fff7ed',
      bodyColor: '#431407',
      cardBackground: 'rgba(255,247,237,0.96)',
      decoration: 'radial-gradient(circle at 90% 80%, rgba(251,191,36,0.35) 0%, transparent 45%)',
    },
    styleNoteExamples: [
      { text: '温暖亲和，圆角卡片', caption: '友好品牌感' },
      { text: '适合消费品牌，配图区域大一些', caption: '大图 + 故事感' },
    ],
    promptExamples: [
      { text: '讲用户故事与品牌价值', caption: '品牌叙事' },
      { text: '6–8 页，结尾留联系方式/行动号召', caption: '页数 + CTA' },
    ],
  },
  luxury: {
    description: '黑金配色、精致留白，低调奢华，适合高端提案与金融路演。',
    scene: '高端提案 · 金融路演 · 精品品牌',
    preview: {
      slideBackground: 'linear-gradient(135deg, #1c1917 0%, #0a0a0a 100%)',
      headerBackground: 'linear-gradient(125deg, #171717 0%, #292524 100%)',
      accent: '#d4af37',
      titleColor: '#fafaf9',
      bodyColor: '#e7e5e4',
      cardBackground: 'rgba(41,37,36,0.95)',
      decoration: 'radial-gradient(circle at 50% 0%, rgba(212,175,55,0.2) 0%, transparent 55%)',
    },
    styleNoteExamples: [
      { text: '黑金轻奢，细线边框', caption: '高端金融风' },
      { text: '少字多留白，像高端腕表广告', caption: '奢侈品广告感' },
    ],
    promptExamples: [
      { text: '面向投资人，强调壁垒与回报', caption: '路演受众 + 重点' },
      { text: '不超过 12 页，数据精准克制', caption: '页数 + 数据密度' },
    ],
  },
  gov: {
    description: '红蓝正式配色，结构规整、编号清晰，适合政策解读与公文式汇报。',
    scene: '政策解读 · 公文汇报 · 机构通报',
    preview: {
      slideBackground: 'linear-gradient(135deg, #991b1b 0%, #1e3a5f 100%)',
      headerBackground: 'linear-gradient(125deg, #1e3a5f 0%, #1e40af 100%)',
      accent: '#dc2626',
      titleColor: '#ffffff',
      bodyColor: '#1e293b',
      cardBackground: 'rgba(255,255,255,0.96)',
      decoration: 'linear-gradient(180deg, rgba(220,38,38,0.15) 0%, transparent 40%)',
    },
    styleNoteExamples: [
      { text: '庄重正式，红头文件感', caption: '公文视觉' },
      { text: '条款式排版，一级二级标题分明', caption: '层级清晰' },
    ],
    promptExamples: [
      { text: '按「背景-政策-落实-保障」四段式', caption: '政策汇报结构' },
      { text: '语言规范，适合机关单位汇报', caption: '正式公文语气' },
    ],
  },
}

export function resolveStylePreviewColors(
  style: PptMasterStyle,
  primaryColor?: string,
): PptMasterStylePreview['preview'] {
  const base = PPT_MASTER_STYLE_PREVIEWS[style].preview
  const color = primaryColor?.trim()
  if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) return base
  return {
    ...base,
    accent: color,
    slideBackground: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
    headerBackground: `linear-gradient(125deg, ${color} 0%, ${color}dd 100%)`,
    decoration: `radial-gradient(circle at 88% 18%, ${color}55 0%, transparent 50%)`,
  }
}
