/**
 * 国企公文模板库（GB/T 9704 法定公文 + 企业事务文书）
 * 排版规范：标题小标宋二号；正文仿宋三号、首行缩进 2 字符、固定行距 28 磅；
 * 一级标题黑体「一、」；二级标题楷体「（一）」；三级标题仿宋加粗「1.」
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
  '遵循 GB/T 9704：红头文件用法定版式；标题小标宋二号居中；正文仿宋三号、首行缩进 2 字符、行距 28 磅；一级黑体「一、」、二级楷体「（一）」、三级仿宋加粗「1.」。'

export const DOCUMENT_TEMPLATE_CATEGORY_LABELS: Record<DocumentTemplateCategory, string> = {
  upstream: '上行文',
  downstream: '下行文',
  parallel: '平行文',
  global: '全局文种',
  enterprise: '企业事务文书',
}

const RED_HEADER = `【红头：×××集团有限公司文件】
【文号：×集团〔2025〕×号】
【秘级：公开】 【紧急程度：】`

const RED_FOOTER = `附件：1. ×××

                        ×××集团有限公司
                        2025年×月×日

（此件公开发布）`

const RED_FOOTER_COPY = `附件：1. ×××

                        ×××集团有限公司
                        2025年×月×日

抄送：×××。
                        ×××集团有限公司办公室    2025年×月×日印发`

function statutoryDoc(
  id: string,
  name: string,
  description: string,
  category: DocumentTemplateCategory,
  accent: string,
  title: string,
  recipient: string,
  body: string,
  footer: string = RED_FOOTER,
): DocumentTemplate {
  return {
    id,
    name,
    description,
    category,
    kind: 'statutory',
    accent,
    content: `${RED_HEADER}

【标题：${title}】

${recipient}：

${body}

${footer}`,
  }
}

function enterpriseDoc(
  id: string,
  name: string,
  description: string,
  accent: string,
  title: string,
  body: string,
): DocumentTemplate {
  return {
    id,
    name,
    description,
    category: 'enterprise',
    kind: 'enterprise',
    accent,
    content: `【内部事务文书 · 非红头】

【标题：${title}】

${body}

报送：×××
编制单位：×××部
日期：2025年×月×日`,
  }
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  // —— 上行文 ——
  statutoryDoc(
    'doc-qingshi',
    '请示',
    '一事一请，请求上级审批、同意或支持（股权、立项、增资等）',
    'upstream',
    '#dc2626',
    '关于×××的请示',
    '集团：',
    `一、请示事项
    简要说明请示的核心事项（一事一请）。

二、背景与依据
    （一）政策与制度依据
    （二）前期工作开展情况

三、具体方案
    1. 方案要点
    2. 实施步骤与时间安排
    3. 资源需求与保障措施

四、风险与应对
    说明主要风险及防控措施。

以上请示，请批示。`,
  ),
  statutoryDoc(
    'doc-baogao',
    '报告',
    '汇报工作、说明情况、反馈进展（含专项报告、股权处置报告等）',
    'upstream',
    '#ea580c',
    '关于×××情况的报告',
    '集团：',
    `一、基本情况
    概述工作背景、对象范围与总体情况。

二、主要工作及成效
    （一）×××方面
    （二）×××方面

三、存在问题与原因分析
    1. 问题一
    2. 问题二

四、下一步工作安排
    提出针对性措施与建议。

特此报告。`,
  ),
  statutoryDoc(
    'doc-yian',
    '议案',
    '提交董事会、股东会审议的专项议案',
    'upstream',
    '#c2410c',
    '关于审议×××的议案',
    '董事会/股东会：',
    `一、议案背景
    说明提出议案的背景和必要性。

二、议案主要内容
    （一）方案概述
    （二）关键条款说明
    （三）预期影响分析

三、合规性与风险说明
    1. 法律合规审查意见摘要
    2. 主要风险提示

四、提请审议事项
    提请董事会/股东会对×××事项进行审议并作出决议。

以上议案，请予审议。`,
  ),

  // —— 下行文 ——
  statutoryDoc(
    'doc-tongzhi',
    '通知',
    '部署工作、转发文件、制度发布、会议通知、人事任免',
    'downstream',
    '#2563eb',
    '关于印发/开展×××的通知',
    '各子公司、各部门：',
    `一、总体要求
    明确工作目标和原则。

二、主要任务
    （一）×××
    （二）×××

三、时间安排
    1. ×月×日前：×××
    2. ×月×日前：×××

四、工作要求
    加强组织保障，确保落实到位。

特此通知。`,
    RED_FOOTER_COPY,
  ),
  statutoryDoc(
    'doc-tongbao',
    '通报',
    '表彰先进、通报批评、披露问题、专项工作情况通报',
    'downstream',
    '#7c3aed',
    '关于×××情况的通报',
    '各子公司、各部门：',
    `一、基本情况
    通报事项的背景与经过。

二、主要问题/典型做法
    （一）×××
    （二）×××

三、处理决定/表扬决定
    1. 对×××给予通报表扬
    2. 对×××给予通报批评并问责

四、工作要求
    各单位引以为戒/对标学习，举一反三抓好整改。

特此通报。`,
    RED_FOOTER_COPY,
  ),
  statutoryDoc(
    'doc-pifu',
    '批复',
    '答复下级请示、议案',
    'downstream',
    '#0891b2',
    '关于×××请示/议案的批复',
    '××子公司：',
    `你公司《关于×××的请示》（×字〔2025〕×号）收悉。经研究，现批复如下：

一、原则同意你公司提出的×××方案。

二、有关要求
    （一）严格按程序报批重大事项
    （二）加强过程管控与信息披露
    （三）于×月×日前报送实施情况

三、其他事项
    执行中如遇重大问题，请及时向集团报告。

此复。`,
  ),
  statutoryDoc(
    'doc-jueding',
    '决定',
    '重大决策、机构调整、重大人事、奖惩、重大资产处置',
    'downstream',
    '#be123c',
    '关于×××的决定',
    '各子公司、各部门：',
    `一、决定事项
    明确作出的重大决定。

二、决定依据
    （一）法律法规及上级要求
    （二）集团发展战略需要

三、具体安排
    1. ×××
    2. ×××

四、组织实施
    明确责任单位、完成时限与考核要求。

本决定自印发之日起施行。`,
    RED_FOOTER_COPY,
  ),
  statutoryDoc(
    'doc-yijian',
    '意见',
    '对工作提出指导意见、改进要求',
    'downstream',
    '#0d9488',
    '关于×××工作的意见',
    '各子公司、各部门：',
    `一、总体要求
    指导思想、基本原则与主要目标。

二、重点任务
    （一）×××
    （二）×××

三、保障措施
    1. 组织保障
    2. 制度保障
    3. 资源保障

四、督促检查
    建立台账，定期调度，确保落地见效。

请结合实际认真贯彻执行。`,
    RED_FOOTER_COPY,
  ),

  // —— 平行文 ——
  statutoryDoc(
    'doc-han',
    '函',
    '商洽工作、询问答复、对外对接（国企对外沟通主要文种）',
    'parallel',
    '#4f46e5',
    '关于×××的函',
    '××单位：',
    `一、事由
    说明来函/去函事项。

二、具体情况
    （一）×××
    （二）×××

三、建议事项
    1. 请贵单位协助×××
    2. 请于×月×日前反馈意见

盼复。`,
    `联系人：×××  电话：×××

                        ×××集团有限公司
                        2025年×月×日`,
  ),

  // —— 全局性正式文种 ——
  statutoryDoc(
    'doc-jueyi',
    '决议',
    '会议表决通过的重大事项',
    'global',
    '#991b1b',
    '关于×××的决议',
    '（会议名称）全体参会人员：',
    `会议于2025年×月×日召开，应到×人，实到×人。经表决，通过如下决议：

一、同意×××。

二、授权×××部门/人员负责组织实施。

三、本决议自通过之日起生效。

（会议名称）
2025年×月×日`,
    '',
  ),
  statutoryDoc(
    'doc-mingling',
    '命令（令）',
    '重大奖惩、强制事项（国企极少使用）',
    'global',
    '#7f1d1d',
    '关于×××的命令',
    '各子公司、各部门：',
    `现发布命令如下：

一、×××

二、本命令自发布之日起施行。

                        签发人：×××
                        ×××集团有限公司
                        2025年×月×日`,
    '',
  ),
  statutoryDoc(
    'doc-gongbao',
    '公报',
    '重大事项公开披露',
    'global',
    '#b45309',
    '×××公报',
    '',
    `【第×号】

2025年×月×日，×××。现将有关事项公布如下：

一、×××

二、×××

                        ×××集团有限公司
                        2025年×月×日`,
    '',
  ),
  statutoryDoc(
    'doc-gonggao',
    '公告',
    '面向社会公开告知',
    'global',
    '#a16207',
    '×××公告',
    '',
    `根据×××规定，现将×××事项公告如下：

一、公告事项
    ×××

二、相关安排
    1. ×××
    2. ×××

三、咨询方式
    联系人：×××  电话：×××

特此公告。

                        ×××集团有限公司
                        2025年×月×日`,
    '',
  ),
  statutoryDoc(
    'doc-tonggao',
    '通告',
    '行业/辖区内公开告知',
    'global',
    '#ca8a04',
    '×××通告',
    '',
    `为×××，现将有关事宜通告如下：

一、适用范围
    ×××

二、具体规定
    （一）×××
    （二）×××

三、实施时间
    自2025年×月×日起施行。

                        ×××集团有限公司
                        2025年×月×日`,
    '',
  ),
  statutoryDoc(
    'doc-jiyao',
    '纪要',
    '董事会、党委会、总经理办公会等会议纪要（国企高频）',
    'global',
    '#059669',
    '×××会议纪要',
    '',
    `2025年×月×日，×××在×××召开。会议由×××主持，×××、×××等参加。现纪要如下：

一、会议听取/审议事项
    （一）×××
    （二）×××

二、会议决定/要求
    1. ×××
    2. ×××

三、下一步工作
    明确责任分工与完成时限。

分送：×××。`,
    '',
  ),

  // —— 企业事务文书 ——
  enterpriseDoc(
    'ent-gongzuo-zongjie',
    '工作总结',
    '年度/季度/专项工作总结',
    '#6366f1',
    '×××工作总结',
    `一、工作回顾
    （一）主要指标完成情况
    （二）重点任务推进情况

二、主要做法与成效
    1. ×××
    2. ×××

三、存在问题与不足
    （一）×××
    （二）×××

四、经验启示
    简要总结可复制的经验做法。`,
  ),
  enterpriseDoc(
    'ent-gongzuo-jihua',
    '工作计划',
    '年度/季度/专项工作计划',
    '#8b5cf6',
    '×××工作计划',
    `一、指导思想与总体目标
    明确年度/阶段目标与关键指标。

二、重点任务
    （一）×××
    （二）×××

三、保障措施
    1. 组织与责任分工
    2. 资源与预算安排
    3. 考核与督导机制

四、进度安排
    按季度/月份列出里程碑节点。`,
  ),
  enterpriseDoc(
    'ent-diaoyan-baogao',
    '专项调研报告',
    '专题调研、实地走访、行业分析',
    '#0284c7',
    '关于×××的调研报告',
    `一、调研背景与目的

二、调研方法与范围

三、基本情况
    （一）×××
    （二）×××

四、主要发现与问题

五、对策建议
    1. 近期措施
    2. 中长期建议`,
  ),
  enterpriseDoc(
    'ent-kexing-baogao',
    '可行性研究报告',
    '投资项目、股权处置、重大改革可行性论证',
    '#0369a1',
    '×××可行性研究报告',
    `一、项目概况
    建设/投资背景、建设内容与规模。

二、市场与需求分析

三、方案比选与技术可行性

四、投资估算与资金筹措

五、经济效益与社会效益分析

六、风险分析与控制措施

七、结论与建议
    提出是否可行的明确结论。`,
  ),
  enterpriseDoc(
    'ent-qingkuang-shuoming',
    '情况说明',
    '就特定事项向内部或上级说明情况',
    '#64748b',
    '关于×××的情况说明',
    `一、事项背景

二、基本情况说明
    （一）时间线/事实经过
    （二）涉及主体与范围

三、原因分析

四、已采取/拟采取的措施

以上情况，特此说明。`,
  ),
  enterpriseDoc(
    'ent-zhuanxiang-shuoming',
    '专项说明',
    '针对审计、检查、问询等专项事项说明',
    '#475569',
    '关于×××的专项说明',
    `一、专项说明事项

二、核查/审计/检查发现问题说明
    1. 问题一及说明
    2. 问题二及说明

三、整改情况
    （一）已完成整改
    （二）持续推进事项

四、附件清单`,
  ),
  enterpriseDoc(
    'ent-shiwu-qingshi',
    '工作请示（事务类）',
    '非正式红头、日常事务性请示',
    '#f97316',
    '关于×××的工作请示',
    `一、请示事项

二、事由说明

三、建议方案

四、需协调支持事项

以上请示，请审示。`,
  ),
  enterpriseDoc(
    'ent-gongzuo-huibao',
    '工作汇报',
    '阶段性工作汇报、专项工作反馈',
    '#fb923c',
    '关于×××的工作汇报',
    `一、工作进展
    （一）已完成事项
    （二）进行中事项

二、数据与亮点

三、困难与需协调问题

四、下一步计划`,
  ),
  enterpriseDoc(
    'ent-duban-baogao',
    '督办报告',
    '上级督办事项落实情况报告',
    '#16a34a',
    '关于×××督办事项的报告',
    `一、督办事项概述

二、落实措施
    （一）×××
    （二）×××

三、完成情况与成效

四、未完成事项及原因
    明确后续完成时限。`,
  ),
  enterpriseDoc(
    'ent-jindu-baogao',
    '进度报告',
    '项目/任务进度跟踪报告',
    '#22c55e',
    '×××进度报告',
    `【报告期：2025年第×季度/×月】

一、总体进度
    完成率：×%  状态：□正常 □滞后 □超前

二、分项进度
    | 任务 | 计划节点 | 实际进度 | 状态 |
    | ××× | ×月×日 | ××% | 正常 |

三、存在问题与风险

四、下阶段计划`,
  ),
  enterpriseDoc(
    'ent-qingshi-taizhang',
    '请示批复台账',
    '请示与批复对应关系台账',
    '#0ea5e9',
    '请示批复台账',
    `【台账期间：2025年×月】

| 序号 | 文号 | 请示事项 | 请示日期 | 批复文号 | 批复日期 | 落实情况 | 责任人 |
| 1 | ×字〔2025〕1号 | ××× | ×月×日 | ×字〔2025〕×号 | ×月×日 | 进行中 | ××× |

备注：每月更新，报办公室备案。`,
  ),
  enterpriseDoc(
    'ent-jiyao-duban',
    '会议纪要督办单',
    '将会议纪要事项分解为督办任务',
    '#14b8a6',
    '会议纪要督办单',
    `【关联纪要：×××会议纪要（2025年×月×日）】

| 序号 | 议定事项 | 责任单位 | 配合单位 | 完成时限 | 督办人 |
| 1 | ××× | ××部 | ××部 | ×月×日 | ××× |

督办要求：按期反馈，逾期通报。`,
  ),
  enterpriseDoc(
    'ent-fengxian-baogao',
    '风险评估报告',
    '投资、并购、重大经营事项风险评估',
    '#e11d48',
    '×××风险评估报告',
    `一、评估对象与范围

二、风险识别
    （一）政策风险
    （二）市场风险
    （三）财务与合规风险
    （四）操作与管理风险

三、风险评价
    按高/中/低分级说明。

四、应对建议与监控措施`,
  ),
  enterpriseDoc(
    'ent-hegui-shencha',
    '合规审查报告',
    '制度、合同、重大决策合规审查',
    '#be185d',
    '×××合规审查报告',
    `一、审查事项

二、审查依据
    法律法规、监管规定、集团制度清单。

三、审查发现
    1. 合规事项
    2. 关注/不合规事项及说明

四、审查结论与整改建议

审查人：×××  审查日期：2025年×月×日`,
  ),
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
