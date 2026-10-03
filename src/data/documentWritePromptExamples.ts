import type { DocumentWriteTypeSelection } from './documentWriteTypes'

export interface DocumentWritePromptExample {
  id: string
  label: string
  prompt: string
  typeSelection?: DocumentWriteTypeSelection
}

export const DOCUMENT_WRITE_PROMPT_EXAMPLES: DocumentWritePromptExample[] = [
  {
    id: 'industry-research',
    label: '行业研究报告',
    prompt:
      '请写一篇行业研究报告，标题是【国资重组整合趋势与特发服务机遇分析】，要求是【含行业背景、政策环境、整合路径、竞争格局、对公司启示与建议；专业客观，数据可×××占位】。',
    typeSelection: { typeId: 'general', subtypeId: 'gen-research' },
  },
  {
    id: 'speech-draft',
    label: '演讲稿',
    prompt:
      '请写一篇演讲稿，标题是【在××启动会上的讲话】，要求是【开场点题、肯定成绩、部署任务、提出希望；口语化可朗读，约1500字】。',
    typeSelection: { typeId: 'general', subtypeId: 'gen-speech' },
  },
  {
    id: 'action-plan',
    label: '行动实施方案',
    prompt:
      '请帮我写一份公文，标题是【关于推进数字化转型的行动方案】，要求是【分背景意义、总体目标、重点任务、保障措施四部分；重点任务用一、（一）、1. 分层；语言务实、可执行】。',
    typeSelection: { typeId: 'enterprise', subtypeId: 'ent-fangan' },
  },
  {
    id: 'holiday-notice',
    label: '放假通知',
    prompt:
      '请帮我写一份公文，标题是【关于2025年国庆节放假安排的通知】，要求是【说明放假时间、调休安排、值班要求、节后上班提示；语气正式简洁】。',
    typeSelection: { typeId: 'workplace', subtypeId: 'wp-notice-holiday' },
  },
  {
    id: 'work-report',
    label: '工作汇报',
    prompt:
      '请帮我写一份公文，标题是【关于第三季度重点工作进展的汇报】，要求是【含工作完成情况、主要成效、存在问题、下一步计划；数据与事例可留 ××× 占位】。',
    typeSelection: { typeId: 'workplace', subtypeId: 'wp-report-work' },
  },
  {
    id: 'work-request',
    label: '工作请示',
    prompt:
      '请帮我写一份公文，标题是【关于申请追加××项目预算的请示】，要求是【说明请示事由、必要性分析、预算明细、预期效果；结尾用规范请示结语】。',
    typeSelection: { typeId: 'workplace', subtypeId: 'wp-request-work' },
  },
  {
    id: 'meeting-minutes',
    label: '会议纪要',
    prompt:
      '请帮我写一份公文，标题是【××工作会议纪要】，要求是【含会议时间地点、参会人员、议题讨论要点、议定事项与责任分工；条目清晰】。',
    typeSelection: { typeId: 'workplace', subtypeId: 'wp-meeting-minutes' },
  },
  {
    id: 'situation-explain',
    label: '情况说明',
    prompt:
      '请帮我写一份公文，标题是【关于××事项的情况说明】，要求是【按时间线说明事件经过、原因分析、已采取措施、后续安排；客观准确】。',
    typeSelection: { typeId: 'workplace', subtypeId: 'wp-explain' },
  },
  {
    id: 'month-summary',
    label: '月工作总结',
    prompt:
      '请帮我写一份公文，标题是【××部2025年×月工作总结】，要求是【分本月完成工作、亮点成效、存在问题、下月计划；条理分明、篇幅适中】。',
    typeSelection: { typeId: 'workplace', subtypeId: 'wp-summary-month' },
  },
  {
    id: 'work-notice',
    label: '工作部署通知',
    prompt:
      '请帮我写一份公文，标题是【关于开展××专项工作的通知】，要求是【含工作背景、总体要求、具体安排、时间节点、联系人；符合 GB/T 9704 通知格式】。',
    typeSelection: { typeId: 'tongzhi', subtypeId: 'tongzhi-work' },
  },
]
