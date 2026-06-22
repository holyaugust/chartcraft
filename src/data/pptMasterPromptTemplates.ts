export type PptMasterPromptSegment =
  | { type: 'text'; value: string }
  | { type: 'slot'; value: string; label: string }

export interface PptMasterPromptTemplate {
  id: string
  title: string
  tag: string
  segments: PptMasterPromptSegment[]
}

export function promptTemplateToText(template: PptMasterPromptTemplate): string {
  return template.segments.map((seg) => (seg.type === 'text' ? seg.value : seg.value)).join('')
}

/** 精品生成要求模板：slot 为可替换关键词，点击整卡替换到左侧输入框 */
export const PPT_MASTER_PROMPT_TEMPLATES: PptMasterPromptTemplate[] = [
  {
    id: 'exec-brief',
    title: '管理层决策汇报',
    tag: '结构清晰 · 结论先行',
    segments: [
      { type: 'text', value: '请根据上传材料生成一份' },
      { type: 'slot', value: '10–12 页', label: '总页数' },
      { type: 'text', value: '的' },
      { type: 'slot', value: '管理层汇报', label: '汇报类型/受众' },
      {
        type: 'text',
        value:
          ' PPT。整体结构：封面（标题+副标题+日期）→ 目录 → ',
      },
      { type: 'slot', value: '3–4 个章节', label: '章节数量' },
      {
        type: 'text',
        value: '（建议按「背景-现状-问题-方案-计划-风险」递进）→ 核心结论与行动项 → 致谢页。叙述要求：第 2 页用一页纸呈现',
      },
      { type: 'slot', value: '3 条核心结论 + 关键 KPI 数字', label: '开篇亮点' },
      {
        type: 'text',
        value:
          '；各章首页用章节标题页过渡，正文页每页 bullet 不超过 4 条、每条一行。视觉：大留白、信息分区用卡片，数字与结论加粗；主色倾向',
      },
      { type: 'slot', value: '#2563eb', label: '品牌主色 HEX' },
      { type: 'text', value: '，装饰克制。语言与源文档一致，保留原文关键数据。' },
    ],
  },
  {
    id: 'product-launch',
    title: '产品方案 / 发布演示',
    tag: '故事线 · 视觉张力',
    segments: [
      { type: 'text', value: '基于材料制作' },
      { type: 'slot', value: '12–15 页', label: '总页数' },
      { type: 'text', value: '的' },
      { type: 'slot', value: '产品发布', label: '场景名称' },
      {
        type: 'text',
        value:
          '演示稿。叙事线：痛点场景 → 产品定位 → 核心功能（',
      },
      { type: 'slot', value: '3 大亮点', label: '功能模块数' },
      {
        type: 'text',
        value:
          '分开展示）→ 架构/流程示意 → 客户价值与案例 → 路线图 → Q&A 页。每页一个主信息点，标题动词开头；功能页采用「图标区+要点」布局。视觉：参考 Keynote 发布会气质，',
      },
      { type: 'slot', value: '大留白、少文字多层次', label: '视觉关键词' },
      { type: 'text', value: '；强调色可用' },
      { type: 'slot', value: '#06b6d4', label: '强调色 HEX' },
      { type: 'text', value: '。避免大段段落，数据用对比句式呈现。' },
    ],
  },
  {
    id: 'annual-review',
    title: '年度总结 / 项目复盘',
    tag: '数据驱动 · 复盘框架',
    segments: [
      { type: 'text', value: '将材料整理为' },
      { type: 'slot', value: '8–10 页', label: '总页数' },
      { type: 'text', value: '的' },
      { type: 'slot', value: '2025 年度工作总结', label: '报告标题主题' },
      {
        type: 'text',
        value:
          '。章节建议：年度目标回顾 → 核心成果（按',
      },
      { type: 'slot', value: '业务线/项目', label: '成果分类维度' },
      {
        type: 'text',
        value:
          '分组，每组 1 页）→ 关键指标与同比（保留材料中的数字）→ 问题与反思 → 下阶段计划（分季度）→ 资源诉求。每页保留 1 个「So What」结论句。视觉：稳重专业、卡片分区清晰；图表页优先展示',
      },
      { type: 'slot', value: '3 组核心指标', label: '重点数据组数' },
      { type: 'text', value: '；配色偏' },
      { type: 'slot', value: '商务蓝绿', label: '配色气质' },
      { type: 'text', value: '，少装饰。' },
    ],
  },
  {
    id: 'training-share',
    title: '培训分享 / 内部分享',
    tag: '易读 · 循序渐进',
    segments: [
      { type: 'text', value: '制作适合' },
      { type: 'slot', value: '30 分钟演讲', label: '演讲时长' },
      { type: 'text', value: '的' },
      { type: 'slot', value: '10 页', label: '总页数' },
      { type: 'text', value: '内部分享 PPT，主题围绕' },
      { type: 'slot', value: '「主题名称」', label: '分享主题' },
      {
        type: 'text',
        value:
          '。结构：封面 → 为什么要听（痛点/收益）→ 概念定义 → 方法步骤（分',
      },
      { type: 'slot', value: '3–5 步', label: '步骤数' },
      {
        type: 'text',
        value:
          '，每步 1 页）→ 案例示范 → 常见误区 → 行动清单 → 延伸阅读。语言口语化但专业，每页不超过 5 个要点。视觉：清爽友好、适度插画感点缀；主色',
      },
      { type: 'slot', value: '#6366f1', label: '主色 HEX' },
      { type: 'text', value: '，圆角卡片，层次柔和。' },
    ],
  },
  {
    id: 'pitch-deck',
    title: '融资 / 商业计划书',
    tag: '投资人视角 · 精炼',
    segments: [
      { type: 'text', value: '根据材料生成' },
      { type: 'slot', value: '12 页', label: '总页数' },
      { type: 'text', value: '标准' },
      { type: 'slot', value: 'BP 路演', label: '文档类型' },
      {
        type: 'text',
        value:
          '结构：封面 → 一句话定位 → 市场机会 → 产品/解决方案 → 商业模式 → 竞争与壁垒 → 运营数据（',
      },
      { type: 'slot', value: 'MRR/用户数/增长率', label: '核心指标' },
      {
        type: 'text',
        value:
          '）→ 团队 → 融资用途 → 联系方式。每页一个投资论点，数字放大呈现；避免 jargon 堆砌。视觉：极简高级、',
      },
      { type: 'slot', value: '参考 Stripe/Notion 官网气质', label: '视觉参考' },
      { type: 'text', value: '；主色' },
      { type: 'slot', value: '#0f172a', label: '主色 HEX' },
      { type: 'text', value: '配高对比强调色，大量留白。' },
    ],
  },
]
