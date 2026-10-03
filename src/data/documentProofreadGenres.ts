import type { ProofreadMode } from '../utils/deepseek'

export type DocumentProofreadGenreId =
  | 'official_doc'
  | 'work_report'
  | 'meeting_minutes'
  | 'speech'
  | 'plan_summary'
  | 'contract'
  | 'news_publicity'
  | 'research'
  | 'table_data'
  | 'general'

export interface DocumentProofreadGenre {
  id: DocumentProofreadGenreId
  label: string
  description: string
}

export const DOCUMENT_PROOFREAD_GENRES: DocumentProofreadGenre[] = [
  { id: 'official_doc', label: '机关公文', description: '通知、报告、请示、函、意见等法定公文' },
  { id: 'work_report', label: '工作汇报', description: '年度/专项汇报、述职、情况说明' },
  { id: 'meeting_minutes', label: '会议纪要', description: '会议记录、纪要、决议事项' },
  { id: 'speech', label: '讲话稿', description: '致辞、发言、主持词、动员讲话' },
  { id: 'plan_summary', label: '计划总结', description: '工作计划、实施方案、总结材料' },
  { id: 'contract', label: '合同协议', description: '合同、协议、承诺函、法律文本' },
  { id: 'news_publicity', label: '新闻宣传', description: '新闻稿、宣传稿、信息简报' },
  { id: 'research', label: '调研分析', description: '调研报告、分析报告、研判材料' },
  { id: 'table_data', label: '表格数据', description: '以表格为主的数据清单、统计表' },
  { id: 'general', label: '通用文稿', description: '未明确归入上述类别的职场文本' },
]

const GENRE_MAP = new Map(DOCUMENT_PROOFREAD_GENRES.map((item) => [item.id, item]))

export function getProofreadGenreLabel(id: DocumentProofreadGenreId): string {
  return GENRE_MAP.get(id)?.label ?? '通用文稿'
}

interface PromptBuildOptions {
  isTableDocument?: boolean
  detectionReasons?: string[]
}

function formatReasons(reasons?: string[]): string {
  if (!reasons?.length) return '（根据正文关键词与结构自动识别）'
  return reasons.map((item) => `- ${item}`).join('\n')
}

const STANDARD_FOCUS: Record<DocumentProofreadGenreId, string[]> = {
  official_doc: [
    '标题、主送、正文、结语、附件说明、落款等要素是否齐全，是否符合 GB/T 9704-2012',
    '层次序号（一、（一）1.（1））是否规范、连贯',
    '用语是否符合公文习惯：「作出」决定、「截至」时点、「根据…要求」等',
    '引用文件名称、文号、时间点是否准确',
  ],
  work_report: [
    '背景—做法—成效—问题—打算的汇报逻辑是否完整',
    '数据、案例是否支撑结论，有无以偏概全或夸大',
    '问题与措施是否对应，下一步安排是否具体可执行',
    '标题与摘要是否准确概括全文重点',
  ],
  meeting_minutes: [
    '时间、地点、主持人、出席/列席人员等要素是否完整',
    '会议议定事项是否清晰，有无歧义或遗漏',
    '责任主体、完成时限、工作要求是否明确',
    '表述是否客观准确，避免将讨论过程写成定论',
  ],
  speech: [
    '开场、主体、结尾结构是否完整，层次是否清晰',
    '语气是否符合场合与受众，有无不当绝对化或口号化',
    '引用政策、数据是否准确，逻辑是否层层递进',
    '口语化与书面语是否协调，朗读是否顺口',
  ],
  plan_summary: [
    '目标、任务、措施、保障、时限是否对应',
    '量化指标是否可衡量、可考核，有无空泛表述',
    '总结与计划是否前后一致，成效与问题是否平衡',
    '时间节点、责任分工是否具体',
  ],
  contract: [
    '主体名称、权利义务、价款/标的、期限、违约责任是否明确',
    '条款之间是否矛盾，关键定义是否一致',
    '数字、金额大小写、百分比是否准确对应',
    '表述是否严谨，避免歧义或双关',
  ],
  news_publicity: [
    '导语是否交代时间、地点、人物、事件要素',
    '事实是否准确，有无主观夸大或未经证实的判断',
    '标题是否与正文一致，有无「标题党」',
    '宣传用语是否得体，符合舆论导向与单位口径',
  ],
  research: [
    '问题提出、调研方法、发现、分析、建议是否完整',
    '论据是否充分，样本/数据是否支撑结论',
    '分析是否客观，建议是否针对问题、可操作',
    '引用来源、统计口径是否清楚',
  ],
  table_data: [
    '列名、单位、口径是否一致，表头与数据是否对应',
    '分项合计与总计是否一致，前后表格数据是否矛盾',
    '缺项、重复、异常值是否标注或说明',
    '不把阿拉伯数字机械改为汉字数字，不纠结纯排版',
  ],
  general: [
    '错别字、用词、标点、语法等基础问题',
    '段落层次与逻辑是否清楚',
    '数据、时间、指代是否前后一致',
    '表述是否准确、无歧义',
  ],
}

const DEEP_FOCUS: Record<DocumentProofreadGenreId, string[]> = {
  official_doc: [
    '政策依据是否充分，行文权限与文种是否匹配',
    '结论与附件、正文细节是否一致，有无越权表述',
    '涉及数字、范围、时限的表述是否严谨可执行',
  ],
  work_report: [
    '成效数据与原始表格/附件是否一致',
    '问题分析是否触及根因，对策是否可落地',
    '是否存在报喜不报忧或逻辑跳跃',
  ],
  meeting_minutes: [
    '议定事项与讨论过程是否混淆，决议是否可执行',
    '跨议题之间是否存在矛盾安排',
  ],
  speech: [
    '核心观点是否贯穿全文，有无前后重复或自相矛盾',
    '敏感表述、绝对化判断是否需要限定',
  ],
  plan_summary: [
    '目标与资源、能力是否匹配，指标是否可验证',
    '跨年度/跨部门任务是否衔接',
  ],
  contract: [
    '风险条款是否完整，解除/终止条件是否清晰',
    '全文是否存在对某一方明显不利的歧义条款',
  ],
  news_publicity: [
    '全文事实链条是否完整，有无信息缺失导致误读',
    '评价性表述是否有事实支撑',
  ],
  research: [
    '结论是否超出调研范围，建议是否越权',
    '不同章节数据、判断是否自洽',
  ],
  table_data: [
    '跨表汇总与正文描述是否一致',
    '统计口径变更是否在文中说明',
  ],
  general: [
    '全文逻辑链条是否完整，关键要素是否遗漏',
    '模糊、绝对化表述是否需要限定',
  ],
}

export function buildSuggestedProofreadPrompt(
  genreId: DocumentProofreadGenreId,
  mode: ProofreadMode,
  options: PromptBuildOptions = {},
): string {
  const genre = GENRE_MAP.get(genreId) ?? GENRE_MAP.get('general')!
  const isTable = options.isTableDocument || genreId === 'table_data'
  const focusList = mode === 'deep' ? DEEP_FOCUS[genreId] : STANDARD_FOCUS[genreId]

  const modeLabel = mode === 'deep' ? '深度审阅' : '智能校对'
  const generalPrinciples =
    mode === 'deep'
      ? `请侧重逻辑完整性（logic）与表述严谨（rigor），勿报错别字标点。
- 只报告确实需要修改或应留意的具体问题，勿泛泛而谈
- original 须为原文连续片段；全文级问题可留空 original，在 message 中说明
- suggestion 为修改建议；仅提醒时可留空`
      : `· 错别字（同音字、形近字）
· 语法语病（搭配不当、成分残缺、句式杂糅）
· 标点符号（中英文混用、全半角、顿号逗号误用）
· 数字与单位（如“千瓦”误写为“仟瓦”）
· 格式一致性（序号层级、术语统一，如“用户”vs“使用者”）
· 逻辑与表达（重复啰嗦、前后矛盾、表意不清）`

  const tableHint = isTable
    ? '\n【表格说明】正文含 | 分隔的表格行，重点核对数据一致性，勿建议数字改汉字或纠结排版。'
    : ''

  return `【${modeLabel}方案 · ${genre.label}】
${genre.description}

【文体识别依据】
${formatReasons(options.detectionReasons)}

【${mode === 'deep' ? '审阅' : '校对'}侧重】
${focusList.map((item, index) => `${index + 1}. ${item}`).join('\n')}

【通用原则】
${generalPrinciples}
${tableHint}

【补充要求】（可自行增删）
- 请特别注意与本单位/本行业相关的规范表述
- 对涉及金额、人数、百分比的表述重点核对`
}
