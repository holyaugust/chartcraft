/** PPT 美化 — 分阶段能力标记 */
export type PptBeautifyPhase = 1 | 2 | 3 | 4

export interface PptCoverContent {
  title: string
  subtitle: string
  author: string
  date: string
}

export interface PptCoverTheme {
  id: string
  name: string
  description: string
  /** 模板 pptx 文件名（位于 /ppt-beautify/covers/） */
  templateFile: string
  preview: {
    background: string
    accent: string
    titleColor: string
    subtitleColor: string
    footerColor: string
    decoration?: string
    /** 正文页 HTML 预览配色（与 full 模板 pptx 一致） */
    content: {
      pageBackground: string
      headerBackground: string
      headerTitleColor: string
      bodyBackground: string
      bodyColor: string
      bulletAccent: string
      /** 页面背景装饰光斑 */
      meshDecoration: string
      /** 主色，用于序号徽章渐变 */
      primaryColor: string
      cardBorder: string
    }
  }
}

/** 第二阶段：企业自定义封面/页型模板 */
export interface PptEnterpriseTemplate {
  id: string
  name: string
  fileName: string
  /** 标注的页面类型，如 cover / content / section */
  pageTypes: string[]
  uploadedAt: number
  /** 仅元数据持久化；二进制存 IndexedDB */
}

/** 第三阶段预留：全局主题替换配置 */
export interface PptGlobalThemePatch {
  primaryColor?: string
  fontName?: string
}

/** 全文美化导出模式 */
export type FullBeautifyExportMode = 'editable' | 'visual'

export const FULL_BEAUTIFY_EXPORT_MODE_LABELS: Record<FullBeautifyExportMode, string> = {
  editable: '可编辑',
  visual: '高保真',
}

export const PPT_BEAUTIFY_PHASE_LABELS: Record<PptBeautifyPhase, string> = {
  1: '文档大纲',
  2: '封面美化',
  3: '全文美化',
  4: '元素与主题',
}

export const DEFAULT_PPT_COVER_CONTENT: PptCoverContent = {
  title: '经管学院《暑期社会调查》',
  subtitle: '暑期社会调查调查报告',
  author: '汇报人',
  date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
}
