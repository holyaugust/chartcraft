import {
  GBT9704_TEMPLATE_CONTENTS,
  SHANGBAO_TONGYONG_TEMPLATE_ID,
} from './gbt9704Templates'
import { WORKPLACE_TEMPLATE_CONTENTS } from './workplaceTemplateContents'
import { normalizeDocumentStructure } from '../utils/documentFormatNormalize'

/**
 * 职场公文模板库
 * - 日常办公文书（通知、汇报、总结、会议等）
 * - 党政机关标准公文（GB/T 9704 法定文种 + 企业事务文书）
 */

/** 职场公文七大子类（首期只做这一类） */
export type DocumentTemplateSubcategory =
  | 'notice'
  | 'request-report'
  | 'summary-plan'
  | 'meeting'
  | 'statutory'
  | 'external'
  | 'regulation'

/** 党政机关标准公文内的行文分类 */
export type StatutoryDocClass =
  | 'upstream'
  | 'downstream'
  | 'parallel'
  | 'global'
  | 'enterprise'

export type DocumentTemplateKind = 'statutory' | 'enterprise' | 'workplace'

export interface DocumentTemplate {
  id: string
  name: string
  description: string
  subcategory: DocumentTemplateSubcategory
  kind: DocumentTemplateKind
  accent: string
  /** 是否按 GB/T 9704 排版导出 */
  gbtFormatted: boolean
  /** 仅 statutory 子类：上行文 / 下行文等 */
  statutoryClass?: StatutoryDocClass
  content: string
}

/** @deprecated 使用 DocumentTemplateSubcategory */
export type DocumentTemplateCategory = DocumentTemplateSubcategory

export const WORKPLACE_SUBCATEGORY_LABELS: Record<DocumentTemplateSubcategory, string> = {
  notice: '通知公告类',
  'request-report': '请示汇报类',
  'summary-plan': '总结计划类',
  meeting: '会议会务类',
  statutory: '党政机关标准公文',
  external: '对外往来文书',
  regulation: '制度规章类',
}

/** @deprecated 使用 WORKPLACE_SUBCATEGORY_LABELS */
export const DOCUMENT_TEMPLATE_CATEGORY_LABELS = WORKPLACE_SUBCATEGORY_LABELS

export const STATUTORY_CLASS_LABELS: Record<StatutoryDocClass, string> = {
  upstream: '上行文',
  downstream: '下行文',
  parallel: '平行文',
  global: '全局文种',
  enterprise: '事务文书',
}

export const DOCUMENT_FORMAT_SPEC =
  '职场公文支持日常办公格式与 GB/T 9704-2012 国标排版：标题居中、主送顶格、正文仿宋三号、层次标题「一、（一）1.（1）」、落款右对齐；红头/非红头按文种自动适配。'

export const WORKPLACE_FORMAT_SPEC =
  '日常办公文书：标题居中加粗、主送顶格、正文首行缩进、层次序号规范、落款单位与日期；导出为通用 Word 版式。'

function gbtStatutoryDoc(
  id: string,
  name: string,
  description: string,
  statutoryClass: StatutoryDocClass,
  accent: string,
): DocumentTemplate {
  return {
    id,
    name,
    description,
    subcategory: 'statutory',
    statutoryClass,
    kind: 'statutory',
    gbtFormatted: true,
    accent,
    content: normalizeDocumentStructure(GBT9704_TEMPLATE_CONTENTS[id] ?? ''),
  }
}

function gbtEnterpriseDoc(
  id: string,
  name: string,
  description: string,
  subcategory: DocumentTemplateSubcategory,
  accent: string,
): DocumentTemplate {
  return {
    id,
    name,
    description,
    subcategory,
    statutoryClass: 'enterprise',
    kind: 'enterprise',
    gbtFormatted: true,
    accent,
    content: normalizeDocumentStructure(GBT9704_TEMPLATE_CONTENTS[id] ?? ''),
  }
}

function workplaceDoc(
  id: string,
  name: string,
  description: string,
  subcategory: DocumentTemplateSubcategory,
  accent: string,
): DocumentTemplate {
  return {
    id,
    name,
    description,
    subcategory,
    kind: 'workplace',
    gbtFormatted: false,
    accent,
    content: normalizeDocumentStructure(WORKPLACE_TEMPLATE_CONTENTS[id] ?? ''),
  }
}

const WORKPLACE_TEMPLATES: DocumentTemplate[] = [
  workplaceDoc('wp-notice-general', '通用通知', '面向全员的常规事项告知', 'notice', '#2563eb'),
  workplaceDoc('wp-notice-work', '工作通知', '完整范文：内控合规自查专项工作部署（含阶段安排、台账要求）', 'notice', '#1d4ed8'),
  workplaceDoc('wp-notice-holiday', '放假通知', '节假日放假与值班安排', 'notice', '#3b82f6'),
  workplaceDoc('wp-notice-hr-onboard', '入职通知', '新员工报到事项告知', 'notice', '#6366f1'),
  workplaceDoc('wp-notice-hr-transfer', '人事调动通知', '岗位调整、人事任免告知', 'notice', '#8b5cf6'),
  workplaceDoc('wp-notice-admin', '行政事务通知', '停水停电、办公调整等行政事项', 'notice', '#0ea5e9'),
  workplaceDoc('wp-notice-public', '公示公告', '评选结果、评审结论公示', 'notice', '#06b6d4'),

  workplaceDoc('wp-request-work', '工作请示', '完整范文：CRM 系统采购请示（含比选表、预算、风险分析）', 'request-report', '#dc2626'),
  workplaceDoc('wp-request-budget', '经费请示', '申请预算、费用支出', 'request-report', '#ea580c'),
  workplaceDoc('wp-report-work', '工作汇报', '阶段性工作进展汇报', 'request-report', '#f97316'),
  workplaceDoc('wp-report-special', '专项工作汇报', '重点项目、专项任务推进情况', 'request-report', '#fb923c'),
  workplaceDoc('wp-report-trip', '出差报告', '外出调研、洽谈情况反馈', 'request-report', '#f59e0b'),
  workplaceDoc('wp-explain', '情况说明', '就特定事项作出书面说明', 'request-report', '#64748b'),

  workplaceDoc('wp-summary-daily', '工作日报', '每日工作完成与明日计划', 'summary-plan', '#059669'),
  workplaceDoc('wp-summary-week', '周工作总结', '本周完成与下周安排', 'summary-plan', '#10b981'),
  workplaceDoc('wp-summary-month', '月工作总结', '月度目标完成与复盘', 'summary-plan', '#14b8a6'),
  workplaceDoc('wp-summary-year', '年度工作总结', '全年工作回顾与经验总结', 'summary-plan', '#0d9488'),
  workplaceDoc('wp-plan-month', '月度工作计划', '下月目标与任务分解', 'summary-plan', '#22c55e'),
  workplaceDoc('wp-plan-year', '年度工作计划', '全年目标与重点任务', 'summary-plan', '#16a34a'),
  workplaceDoc('wp-duty', '述职报告', '年度履职情况述职', 'summary-plan', '#84cc16'),

  workplaceDoc('wp-meeting-notice', '会议通知', '召开会议的时间、议程与参会要求', 'meeting', '#7c3aed'),
  workplaceDoc('wp-meeting-minutes', '会议纪要', '完整范文：总经理办公会纪要（议题汇报、讨论、决定格式）', 'meeting', '#8b5cf6'),
  workplaceDoc('wp-meeting-agenda', '会议议程', '会议流程与发言安排', 'meeting', '#a78bfa'),
  workplaceDoc('wp-speech', '讲话稿', '会议、活动致辞与讲话', 'meeting', '#9333ea'),

  workplaceDoc('wp-invite', '邀请函', '邀请参加论坛、活动、会议', 'external', '#4f46e5'),
  workplaceDoc('wp-thanks', '感谢信', '对外协作、支持致谢', 'external', '#6366f1'),
  workplaceDoc('wp-letter-business', '商洽函', '商洽合作、对接事项', 'external', '#818cf8'),
  workplaceDoc('wp-reception', '接待方案', '来访接待行程与保障安排', 'external', '#a5b4fc'),

  workplaceDoc('wp-rule-admin', '管理制度', '部门或业务管理制度框架', 'regulation', '#475569'),
  workplaceDoc('wp-rule-post', '岗位职责', '岗位设置与职责说明', 'regulation', '#64748b'),
  workplaceDoc('wp-rule-method', '管理办法', '专项工作管理办法', 'regulation', '#334155'),
]

const STATUTORY_TEMPLATES: DocumentTemplate[] = [
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
]

const GBT_ENTERPRISE_TEMPLATES: DocumentTemplate[] = [
  gbtEnterpriseDoc('ent-gongzuo-zongjie', '工作总结', 'GB/T 9704-2012 非红头：年度/季度/专项工作总结', 'summary-plan', '#6366f1'),
  gbtEnterpriseDoc('ent-gongzuo-jihua', '工作计划', 'GB/T 9704-2012 非红头：年度/季度/专项工作计划与实施方案', 'summary-plan', '#8b5cf6'),
  gbtEnterpriseDoc('ent-diaoyan-baogao', '专项调研报告', 'GB/T 9704-2012 非红头：专题调研、实地走访、行业分析', 'request-report', '#0284c7'),
  gbtEnterpriseDoc('ent-kexing-baogao', '可行性研究报告', 'GB/T 9704-2012 非红头：投资、股权处置、重大改革可行性论证', 'request-report', '#0369a1'),
  gbtEnterpriseDoc('ent-qingkuang-shuoming', '情况说明', 'GB/T 9704-2012 非红头：就特定事项向内部或上级说明情况', 'request-report', '#64748b'),
  gbtEnterpriseDoc('ent-zhuanxiang-shuoming', '专项说明', 'GB/T 9704-2012 非红头：审计、检查、问询等专项事项说明', 'request-report', '#475569'),
  gbtEnterpriseDoc('ent-shiwu-qingshi', '工作请示（事务类）', 'GB/T 9704-2012 非红头：日常事务性请示', 'request-report', '#f97316'),
  gbtEnterpriseDoc('ent-gongzuo-huibao', '工作汇报', 'GB/T 9704-2012 非红头：阶段性工作汇报、专项工作反馈', 'request-report', '#fb923c'),
  gbtEnterpriseDoc('ent-duban-baogao', '督办报告', 'GB/T 9704-2012 非红头：上级督办事项落实情况报告', 'request-report', '#16a34a'),
  gbtEnterpriseDoc('ent-jindu-baogao', '进度报告', 'GB/T 9704-2012 非红头：项目/任务进度跟踪报告', 'request-report', '#22c55e'),
  gbtEnterpriseDoc('ent-qingshi-taizhang', '请示批复台账', 'GB/T 9704-2012 非红头：请示与批复对应关系台账', 'statutory', '#0ea5e9'),
  gbtEnterpriseDoc('ent-jiyao-duban', '会议纪要督办单', 'GB/T 9704-2012 非红头：将会议纪要事项分解为督办任务', 'meeting', '#14b8a6'),
  gbtEnterpriseDoc('ent-fengxian-baogao', '风险评估报告', 'GB/T 9704-2012 非红头：投资、并购、重大经营事项风险评估', 'request-report', '#e11d48'),
  gbtEnterpriseDoc('ent-hegui-shencha', '合规审查报告', 'GB/T 9704-2012 非红头：制度、合同、重大决策合规审查', 'request-report', '#be185d'),
]

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  ...WORKPLACE_TEMPLATES,
  ...STATUTORY_TEMPLATES,
  ...GBT_ENTERPRISE_TEMPLATES,
]

export function getDocumentTemplateById(id: string): DocumentTemplate | undefined {
  return DOCUMENT_TEMPLATES.find((template) => template.id === id)
}

export function getDocumentTemplateSubcategoryLabel(subcategory: DocumentTemplateSubcategory): string {
  return WORKPLACE_SUBCATEGORY_LABELS[subcategory]
}

/** @deprecated 使用 getDocumentTemplateSubcategoryLabel */
export function getDocumentTemplateCategoryLabel(category: DocumentTemplateSubcategory): string {
  return getDocumentTemplateSubcategoryLabel(category)
}

export function getDocumentTemplateKindLabel(kind: DocumentTemplateKind): string {
  if (kind === 'statutory') return '法定公文'
  if (kind === 'enterprise') return 'GB/T 事务文书'
  return '职场文书'
}

export function getDocumentTemplateMetaLabel(template: DocumentTemplate): string {
  if (template.subcategory === 'statutory' && template.statutoryClass) {
    return `${WORKPLACE_SUBCATEGORY_LABELS.statutory} · ${STATUTORY_CLASS_LABELS[template.statutoryClass]}`
  }
  return WORKPLACE_SUBCATEGORY_LABELS[template.subcategory]
}
