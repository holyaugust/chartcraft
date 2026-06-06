/** 智能写作 — 公文类型树（含法定文种与企业事务文书子类） */

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
  label: '自动识别',
}

export const DOCUMENT_WRITE_TYPES: DocumentWriteType[] = [
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
