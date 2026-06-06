/**
 * GB/T 9704-2012 国企公文导出规范常量
 * 模板正文见 gbt9704Templates.ts
 */

export {
  SHANGBAO_TONGYONG_TEMPLATE_ID,
  SHANGBAO_TONGYONG_CONTENT,
  GBT9704_TEMPLATE_CONTENTS,
  getGbt9704TemplateContent,
} from './gbt9704Templates'

/** 版心页边距 twips：上37 下35 左28 右26 mm */
export const GBT9704_PAGE_MARGINS = {
  top: 2098,
  bottom: 1984,
  left: 1587,
  right: 1474,
  header: 851,
  footer: 992,
} as const

/** 固定行距 28 磅 */
export const GBT9704_LINE_SPACING = 560

/** 三号 = 16pt = 32 half-points */
export const GBT9704_SIZE_BODY = 32

/** 二号 = 22pt = 44 half-points（标题） */
export const GBT9704_SIZE_TITLE = 44

/** 一级标题 */
export const GBT9704_SIZE_HEADING1 = 32

/** 二级标题 */
export const GBT9704_SIZE_HEADING2 = 30

/** 发文机关署名：右空 4 字（OOXML 百分之一字符宽） */
export const GBT9704_SIGNATURE_ORG_RIGHT_CHARS = 400

/** 成文日期：右空 2 字 */
export const GBT9704_SIGNATURE_DATE_RIGHT_CHARS = 200

/** 落款前空三行（3 × 28 磅行距，twips） */
export const GBT9704_SIGNATURE_SPACE_BEFORE = GBT9704_LINE_SPACING * 3

export const GBT9704_EXPORT_SPEC_NOTE =
  'GB/T 9704-2012：A4 左侧装订；页边距上37/下35/左28/右26mm；28磅行距；正文仿宋三号首行缩进2字符；标题小标宋二号居中；主送黑体三号顶格；一级黑体「一、」、二级楷体「（一）」、三级仿宋「1.」、四级仿宋「（1）」；落款：发文机关署名右空四字、成文日期右空二字且署名在上日期在下；附件在落款之前；红头文件含文号秘级；公布类含公告/通告/公报。'
