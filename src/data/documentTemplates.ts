import {
  GBT9704_TEMPLATE_CONTENTS,
  SHANGBAO_TONGYONG_TEMPLATE_ID,
} from './gbt9704Templates'
import { normalizeDocumentStructure } from '../utils/documentFormatNormalize'

/**
 * 国企公文模板库（GB/T 9704 法定公文 + 企业事务文书）
 * 正文骨架见 gbt9704Templates.ts，导出排版见 docxFormattedExport.ts
 */

export type DocumentTemplateCategory =
  | 'upstream'
  | 'downstream'
  | 'parallel'
  | 'global'
  | 'enterprise'

export type DocumentTemplateKind = 'statutory' | 'enterprise'

export interface DocumentTemplate {
  id: string
  name: string
  description: string
  category: DocumentTemplateCategory
  kind: DocumentTemplateKind
  accent: string
  /** 占位符用【】标注，载入后可直接编辑 */
  content: string
}

export const DOCUMENT_FORMAT_SPEC =
  '遵循 GB/T 9704-2012：非红头上行/平行文与企业事务文书、红头下行/公布类公文均适用；标题小标宋二号居中；主送黑体三号顶格；正文仿宋三号、首行缩进2字符、28磅行距；一级黑体「一、」、二级楷体「（一）」、三级仿宋「1.」、四级仿宋「（1）」；落款仿宋三号、发文机关署名右空四字、成文日期右空二字且署名在上日期在下；附件在落款之前。'

export const DOCUMENT_TEMPLATE_CATEGORY_LABELS: Record<DocumentTemplateCategory, string> = {
  upstream: '上行文',
  downstream: '下行文',
  parallel: '平行文',
  global: '全局文种',
  enterprise: '企业事务文书',
}

function gbtStatutoryDoc(
  id: string,
  name: string,
  description: string,
  category: DocumentTemplateCategory,
  accent: string,
): DocumentTemplate {
  return {
    id,
    name,
    description,
    category,
    kind: 'statutory',
    accent,
    content: normalizeDocumentStructure(GBT9704_TEMPLATE_CONTENTS[id] ?? ''),
  }
}

function gbtEnterpriseDoc(
  id: string,
  name: string,
  description: string,
  accent: string,
): DocumentTemplate {
  return {
    id,
    name,
    description,
    category: 'enterprise',
    kind: 'enterprise',
    accent,
    content: normalizeDocumentStructure(GBT9704_TEMPLATE_CONTENTS[id] ?? ''),
  }
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  gbtStatutoryDoc('doc-qingshi', '请示', 'GB/T 9704-2012 非红头：一事一请，请求上级审批、同意或支持', 'upstream', '#dc2626'),
  gbtStatutoryDoc('doc-baogao', '报告', 'GB/T 9704-2012 非红头：汇报工作、说明情况、反馈进展', 'upstream', '#ea580c'),
  gbtStatutoryDoc(
    SHANGBAO_TONGYONG_TEMPLATE_ID,
    '上报专项报告/请示（通用版）',
    'GB/T 9704-2012 非红头：子公司向集团上报专项报告、股权/资产处置、立项请示等',
    'upstream',
    '#b45309',
  ),
  gbtStatutoryDoc('doc-yian', '议案', 'GB/T 9704-2012 非红头：提交董事会、股东会审议的专项议案', 'upstream', '#c2410c'),
  gbtStatutoryDoc('doc-tongzhi', '通知', 'GB/T 9704-2012 红头：部署工作、转发文件、制度发布、会议通知', 'downstream', '#2563eb'),
  gbtStatutoryDoc('doc-tongbao', '通报', 'GB/T 9704-2012 红头：表彰先进、通报批评、披露问题', 'downstream', '#7c3aed'),
  gbtStatutoryDoc('doc-pifu', '批复', 'GB/T 9704-2012 红头：答复下级请示、议案', 'downstream', '#0891b2'),
  gbtStatutoryDoc('doc-jueding', '决定', 'GB/T 9704-2012 红头：重大决策、机构调整、人事奖惩', 'downstream', '#be123c'),
  gbtStatutoryDoc('doc-yijian', '意见', 'GB/T 9704-2012 红头：对工作提出指导意见、改进要求', 'downstream', '#0d9488'),
  gbtStatutoryDoc('doc-han', '函', 'GB/T 9704-2012 非红头：商洽工作、询问答复、对外对接', 'parallel', '#4f46e5'),
  gbtStatutoryDoc('doc-jueyi', '决议', 'GB/T 9704-2012 红头：会议表决通过的重大事项', 'global', '#991b1b'),
  gbtStatutoryDoc('doc-mingling', '命令（令）', 'GB/T 9704-2012 红头：重大奖惩、强制事项', 'global', '#7f1d1d'),
  gbtStatutoryDoc('doc-gongbao', '公报', 'GB/T 9704-2012 公布：重大事项公开披露', 'global', '#b45309'),
  gbtStatutoryDoc('doc-gonggao', '公告', 'GB/T 9704-2012 公布：面向社会公开告知', 'global', '#a16207'),
  gbtStatutoryDoc('doc-tonggao', '通告', 'GB/T 9704-2012 公布：行业/辖区内公开告知', 'global', '#ca8a04'),
  gbtStatutoryDoc('doc-jiyao', '纪要', 'GB/T 9704-2012：董事会、党委会、总经理办公会等会议纪要', 'global', '#059669'),
  gbtEnterpriseDoc('ent-gongzuo-zongjie', '工作总结', 'GB/T 9704-2012 非红头：年度/季度/专项工作总结', '#6366f1'),
  gbtEnterpriseDoc('ent-gongzuo-jihua', '工作计划', 'GB/T 9704-2012 非红头：年度/季度/专项工作计划与实施方案', '#8b5cf6'),
  gbtEnterpriseDoc('ent-diaoyan-baogao', '专项调研报告', 'GB/T 9704-2012 非红头：专题调研、实地走访、行业分析', '#0284c7'),
  gbtEnterpriseDoc('ent-kexing-baogao', '可行性研究报告', 'GB/T 9704-2012 非红头：投资、股权处置、重大改革可行性论证', '#0369a1'),
  gbtEnterpriseDoc('ent-qingkuang-shuoming', '情况说明', 'GB/T 9704-2012 非红头：就特定事项向内部或上级说明情况', '#64748b'),
  gbtEnterpriseDoc('ent-zhuanxiang-shuoming', '专项说明', 'GB/T 9704-2012 非红头：审计、检查、问询等专项事项说明', '#475569'),
  gbtEnterpriseDoc('ent-shiwu-qingshi', '工作请示（事务类）', 'GB/T 9704-2012 非红头：日常事务性请示', '#f97316'),
  gbtEnterpriseDoc('ent-gongzuo-huibao', '工作汇报', 'GB/T 9704-2012 非红头：阶段性工作汇报、专项工作反馈', '#fb923c'),
  gbtEnterpriseDoc('ent-duban-baogao', '督办报告', 'GB/T 9704-2012 非红头：上级督办事项落实情况报告', '#16a34a'),
  gbtEnterpriseDoc('ent-jindu-baogao', '进度报告', 'GB/T 9704-2012 非红头：项目/任务进度跟踪报告', '#22c55e'),
  gbtEnterpriseDoc('ent-qingshi-taizhang', '请示批复台账', 'GB/T 9704-2012 非红头：请示与批复对应关系台账', '#0ea5e9'),
  gbtEnterpriseDoc('ent-jiyao-duban', '会议纪要督办单', 'GB/T 9704-2012 非红头：将会议纪要事项分解为督办任务', '#14b8a6'),
  gbtEnterpriseDoc('ent-fengxian-baogao', '风险评估报告', 'GB/T 9704-2012 非红头：投资、并购、重大经营事项风险评估', '#e11d48'),
  gbtEnterpriseDoc('ent-hegui-shencha', '合规审查报告', 'GB/T 9704-2012 非红头：制度、合同、重大决策合规审查', '#be185d'),
]

export function getDocumentTemplateById(id: string): DocumentTemplate | undefined {
  return DOCUMENT_TEMPLATES.find((template) => template.id === id)
}

export function getDocumentTemplateCategoryLabel(category: DocumentTemplateCategory): string {
  return DOCUMENT_TEMPLATE_CATEGORY_LABELS[category]
}

export function getDocumentTemplateKindLabel(kind: DocumentTemplateKind): string {
  return kind === 'statutory' ? '法定公文' : '事务文书'
}
