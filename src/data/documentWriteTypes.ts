/** 智能写作 — 职场公文类型树（日常办公 + 党政机关标准公文） */

export interface DocumentWriteSubtype {
  id: string
  label: string
  templateId?: string
  sceneHint?: string
}

export interface DocumentWriteType {
  id: string
  label: string
  templateId?: string
  subtypes?: DocumentWriteSubtype[]
}

export const DOCUMENT_WRITE_AUTO_TYPE: DocumentWriteType = {
  id: 'auto',
  label: '自动识别（按需求自适应文体）',
}

export const DOCUMENT_WRITE_TYPES: DocumentWriteType[] = [
  {
    id: 'general',
    label: '通用写作',
    subtypes: [
      { id: 'gen-free', label: '自由写作', sceneHint: '按用户需求自由成文，不限公文格式' },
      { id: 'gen-research', label: '研究报告', sceneHint: '行业研究、专题分析、论证报告' },
      { id: 'gen-article', label: '文章评论', sceneHint: '评论文章、观点稿、专栏文章' },
      { id: 'gen-news', label: '新闻稿', sceneHint: '新闻通讯、宣传稿、信息发布' },
      { id: 'gen-speech', label: '演讲稿', sceneHint: '讲话、致辞、发言稿' },
      { id: 'gen-proposal', label: '策划方案', sceneHint: '活动策划、项目方案、营销方案' },
      { id: 'gen-email', label: '商务邮件', sceneHint: '对外邮件、商务往来函件' },
      { id: 'gen-copy', label: '文案说明', sceneHint: '产品说明、介绍文案、使用说明' },
    ],
  },
  {
    id: 'workplace',
    label: '职场文书',
    subtypes: [
      { id: 'wp-notice-work', label: '工作通知', templateId: 'wp-notice-work', sceneHint: '部署专项工作、活动安排' },
      { id: 'wp-notice-holiday', label: '放假通知', templateId: 'wp-notice-holiday', sceneHint: '节假日放假与值班安排' },
      { id: 'wp-request-work', label: '工作请示', templateId: 'wp-request-work', sceneHint: '日常工作事项报批' },
      { id: 'wp-report-work', label: '工作汇报', templateId: 'wp-report-work', sceneHint: '阶段性工作进展汇报' },
      { id: 'wp-explain', label: '情况说明', templateId: 'wp-explain', sceneHint: '就特定事项作出书面说明' },
      { id: 'wp-summary-week', label: '周工作总结', templateId: 'wp-summary-week', sceneHint: '本周完成与下周安排' },
      { id: 'wp-summary-month', label: '月工作总结', templateId: 'wp-summary-month', sceneHint: '月度目标完成与复盘' },
      { id: 'wp-plan-month', label: '月度工作计划', templateId: 'wp-plan-month', sceneHint: '下月目标与任务分解' },
      { id: 'wp-meeting-notice', label: '会议通知', templateId: 'wp-meeting-notice', sceneHint: '召开会议的时间、议程与参会要求' },
      { id: 'wp-meeting-minutes', label: '会议纪要', templateId: 'wp-meeting-minutes', sceneHint: '会议议题、讨论决定与落实事项' },
      { id: 'wp-invite', label: '邀请函', templateId: 'wp-invite', sceneHint: '邀请参加论坛、活动、会议' },
      { id: 'wp-rule-admin', label: '管理制度', templateId: 'wp-rule-admin', sceneHint: '部门或业务管理制度框架' },
    ],
  },
  {
    id: 'yijian',
    label: '意见',
    templateId: 'doc-yijian',
    subtypes: [
      { id: 'yijian-guidance', label: '工作指导意见', templateId: 'doc-yijian', sceneHint: '对下级或相关单位提出指导性意见' },
      { id: 'yijian-reform', label: '改革实施方案', templateId: 'doc-yijian', sceneHint: '专项改革、机制优化' },
      { id: 'yijian-assessment', label: '考核评价意见', templateId: 'doc-yijian', sceneHint: '年度考核、绩效评价' },
    ],
  },
  {
    id: 'jueding',
    label: '决定',
    templateId: 'doc-jueding',
    subtypes: [
      { id: 'jueding-org', label: '机构调整决定', templateId: 'doc-jueding', sceneHint: '组织架构、职能调整' },
      { id: 'jueding-personnel', label: '人事任免决定', templateId: 'doc-jueding', sceneHint: '干部任免、职务调整' },
      { id: 'jueding-reward', label: '表彰奖励决定', templateId: 'doc-jueding', sceneHint: '先进集体、个人表彰' },
    ],
  },
  {
    id: 'gonggao',
    label: '公告',
    templateId: 'doc-gonggao',
    subtypes: [
      { id: 'gonggao-public', label: '社会公开公告', templateId: 'doc-gonggao', sceneHint: '面向社会公开发布' },
      { id: 'gonggao-recruit', label: '招聘遴选公告', templateId: 'doc-gonggao', sceneHint: '公开招聘、竞争性选拔' },
      { id: 'gonggao-result', label: '结果公示公告', templateId: 'doc-gonggao', sceneHint: '中标、评审结果公示' },
    ],
  },
  {
    id: 'tonggao',
    label: '通告',
    templateId: 'doc-tonggao',
    subtypes: [
      { id: 'tonggao-admin', label: '行政管理通告', templateId: 'doc-tonggao', sceneHint: '内部管理事项告知' },
      { id: 'tonggao-fee', label: '调整费用标准通告', templateId: 'doc-tonggao', sceneHint: '收费标准、价格调整' },
      { id: 'tonggao-abolish', label: '废止文件通告', templateId: 'doc-tonggao', sceneHint: '宣布废止旧规制度' },
      { id: 'tonggao-consult', label: '征求意见通告', templateId: 'doc-tonggao', sceneHint: '向社会或内部征求意见' },
    ],
  },
  {
    id: 'mingling',
    label: '命令',
    templateId: 'doc-mingling',
  },
  {
    id: 'jueyi',
    label: '决议',
    templateId: 'doc-jueyi',
  },
  {
    id: 'gongbao',
    label: '公报',
    templateId: 'doc-gongbao',
  },
  {
    id: 'yian',
    label: '议案',
    templateId: 'doc-yian',
  },
  {
    id: 'qingshi',
    label: '请示',
    templateId: 'doc-qingshi',
    subtypes: [
      { id: 'qingshi-project', label: '立项请示', templateId: 'doc-qingshi', sceneHint: '项目立项、投资审批' },
      { id: 'qingshi-fund', label: '资金请示', templateId: 'doc-qingshi', sceneHint: '增资、融资、预算调整' },
      { id: 'qingshi-shangbao', label: '上报集团请示', templateId: 'doc-shangbao-tongyong', sceneHint: 'GB/T 9704-2012 非红头通用版' },
      { id: 'qingshi-policy', label: '政策事项请示', templateId: 'doc-qingshi', sceneHint: '重大政策、制度出台' },
    ],
  },
  {
    id: 'baogao',
    label: '报告',
    templateId: 'doc-baogao',
    subtypes: [
      { id: 'baogao-work', label: '工作报告', templateId: 'doc-baogao', sceneHint: '阶段性工作汇报' },
      { id: 'baogao-special', label: '专项报告', templateId: 'doc-shangbao-tongyong', sceneHint: '上报集团专项报告（GB/T 9704-2012 通用版）' },
      { id: 'baogao-inspection', label: '检查报告', templateId: 'doc-baogao', sceneHint: '巡视、审计、督查反馈' },
    ],
  },
  {
    id: 'tongzhi',
    label: '通知',
    templateId: 'doc-tongzhi',
    subtypes: [
      { id: 'tongzhi-work', label: '工作部署通知', templateId: 'doc-tongzhi', sceneHint: '安排专项工作、活动' },
      { id: 'tongzhi-meeting', label: '会议通知', templateId: 'doc-tongzhi', sceneHint: '召开会议、培训通知' },
      { id: 'tongzhi-system', label: '制度发布通知', templateId: 'doc-tongzhi', sceneHint: '印发制度、办法' },
      { id: 'tongzhi-personnel', label: '人事任免通知', templateId: 'doc-tongzhi', sceneHint: '干部任免、岗位调整' },
    ],
  },
  {
    id: 'tongbao',
    label: '通报',
    templateId: 'doc-tongbao',
  },
  {
    id: 'pifu',
    label: '批复',
    templateId: 'doc-pifu',
  },
  {
    id: 'han',
    label: '函',
    templateId: 'doc-han',
  },
  {
    id: 'jiyao',
    label: '纪要',
    templateId: 'doc-jiyao',
    subtypes: [
      { id: 'jiyao-dangwei', label: '党委会纪要', templateId: 'doc-jiyao', sceneHint: '党委会议研究决定事项' },
      { id: 'jiyao-dongshi', label: '董事会纪要', templateId: 'doc-jiyao', sceneHint: '董事会审议事项' },
      { id: 'jiyao-zongjingli', label: '总经理办公会纪要', templateId: 'doc-jiyao', sceneHint: '总经理办公会事项' },
    ],
  },
  {
    id: 'enterprise',
    label: '企业事务文书',
    subtypes: [
      { id: 'ent-gongzuo-zongjie', label: '工作总结', templateId: 'ent-gongzuo-zongjie' },
      { id: 'ent-gongzuo-jihua', label: '工作计划', templateId: 'ent-gongzuo-jihua' },
      { id: 'ent-fangan', label: '行动/实施方案', templateId: 'ent-gongzuo-jihua' },
      { id: 'ent-diaoyan-baogao', label: '专项调研报告', templateId: 'ent-diaoyan-baogao' },
      { id: 'ent-kexing-baogao', label: '可行性研究报告', templateId: 'ent-kexing-baogao' },
      { id: 'ent-qingkuang-shuoming', label: '情况说明', templateId: 'ent-qingkuang-shuoming' },
      { id: 'ent-zhuanxiang-shuoming', label: '专项说明', templateId: 'ent-zhuanxiang-shuoming' },
      { id: 'ent-shiwu-qingshi', label: '工作请示', templateId: 'ent-shiwu-qingshi' },
      { id: 'ent-gongzuo-huibao', label: '工作汇报', templateId: 'ent-gongzuo-huibao' },
      { id: 'ent-duban-baogao', label: '督办报告', templateId: 'ent-duban-baogao' },
      { id: 'ent-jindu-baogao', label: '进度报告', templateId: 'ent-jindu-baogao' },
      { id: 'ent-fengxian-baogao', label: '风险评估报告', templateId: 'ent-fengxian-baogao' },
      { id: 'ent-hegui-shencha', label: '合规审查报告', templateId: 'ent-hegui-shencha' },
      { id: 'ent-qingshi-taizhang', label: '请示批复台账', templateId: 'ent-qingshi-taizhang' },
      { id: 'ent-jiyao-duban', label: '纪要督办单', templateId: 'ent-jiyao-duban' },
    ],
  },
]

export interface DocumentWriteTypeSelection {
  typeId: string
  subtypeId?: string | null
}

export function resolveWriteTypeSelection(selection: DocumentWriteTypeSelection): {
  type: DocumentWriteType
  subtype?: DocumentWriteSubtype
  templateId?: string
  label: string
} {
  if (selection.typeId === 'auto') {
    return { type: DOCUMENT_WRITE_AUTO_TYPE, label: '自动识别' }
  }

  const type = DOCUMENT_WRITE_TYPES.find((item) => item.id === selection.typeId)
  if (!type) {
    return { type: DOCUMENT_WRITE_AUTO_TYPE, label: '自动识别' }
  }

  if (selection.subtypeId && type.subtypes) {
    const subtype = type.subtypes.find((item) => item.id === selection.subtypeId)
    if (subtype) {
      return {
        type,
        subtype,
        templateId: subtype.templateId ?? type.templateId,
        label: `${type.label} · ${subtype.label}`,
      }
    }
  }

  return {
    type,
    templateId: type.templateId,
    label: type.label,
  }
}

/** 根据模板库 templateId 反查写公文类型选择（用于与右侧模板库联动） */
export function findWriteTypeSelectionByTemplateId(templateId: string): DocumentWriteTypeSelection | null {
  for (const type of DOCUMENT_WRITE_TYPES) {
    if (type.subtypes?.length) {
      const subtype = type.subtypes.find((item) => item.templateId === templateId)
      if (subtype) {
        return { typeId: type.id, subtypeId: subtype.id }
      }
    } else if (type.templateId === templateId) {
      return { typeId: type.id, subtypeId: null }
    }
  }
  return null
}
