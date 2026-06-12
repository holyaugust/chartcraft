export type MindmapTemplateCategory = 'strategy' | 'project' | 'analysis' | 'general'

export interface MindmapTemplate {
  id: string
  name: string
  description: string
  category: MindmapTemplateCategory
  layoutLabel: string
  accent: string
  branchColors: string[]
  sampleSource: string
  skeletonSource: string
  aiGuide: string
}

const LAYOUT_HEADER = ''

export const MINDMAP_TEMPLATE_CATEGORY_LABELS: Record<MindmapTemplateCategory, string> = {
  strategy: '战略决策',
  project: '项目规划',
  analysis: '分析拆解',
  general: '通用结构',
}

export const MINDMAP_TEMPLATES: MindmapTemplate[] = [
  {
    id: 'strategy-paths',
    name: '战略路径分析',
    description: '中心议题 + 多方案分支 + 路径/情形展开，适合并购、合作、业务决策',
    category: 'strategy',
    layoutLabel: '双方案树',
    accent: '#dc2626',
    branchColors: ['#dc2626', '#ea580c', '#2563eb', '#059669'],
    skeletonSource: `${LAYOUT_HEADER}mindmap
  root((核心议题))
    方案A
      路径一
        情形一
          要点说明
        情形二
          要点说明
      路径二
        关键步骤
    方案B
      上策
        实施要点
      中策
        实施要点
      下策
        实施要点`,
    sampleSource: `${LAYOUT_HEADER}mindmap
  root((49% 股权处置))
    特发
      收购
        路径1
          情形1 我方51%
            成本补偿
            劳务用工
          情形2 我方49%
            优先购买权
            人员安置
        路径2
          引入第三方
            竞价流程
            交割条件
      不收购
        维持现状
        后续协商
    大金源
      股权转让 上策
        评估定价
        协议交割
      减资 中策
        通知债权人
        工商变更
      清算 下策
        资产处置
        债务清偿`,
    aiGuide:
      '思维导图树形展开，不是流程图。根节点为议题，一级分支为并列方案/主体，二级为路径或策略层级，三四级写情形与要点。禁止箭头串联步骤，禁止判断菱形。',
  },
  {
    id: 'dual-scheme',
    name: '双方案对比',
    description: '两个主方案并列展开，便于对比优劣与实施条件',
    category: 'strategy',
    layoutLabel: '对比树',
    accent: '#2563eb',
    branchColors: ['#2563eb', '#dc2626', '#059669'],
    skeletonSource: `${LAYOUT_HEADER}mindmap
  root((决策主题))
    方案一
      优势
      风险
      实施条件
    方案二
      优势
      风险
      实施条件`,
    sampleSource: `${LAYOUT_HEADER}mindmap
  root((数字化转型路线))
    自建平台
      优势
        数据自主可控
        深度定制
      风险
        投入周期长
        人才要求高
      适用
        核心业务系统
    采购 SaaS
      优势
        上线速度快
        运维成本低
      风险
        迁移受限
        长期费用
      适用
        通用办公协同`,
    aiGuide: '两个一级分支代表并列方案，每个方案下挂优势/风险/条件等维度，层级 3～4 层。',
  },
  {
    id: 'project-decompose',
    name: '项目任务分解',
    description: '目标 → 阶段 → 任务 → 交付物，适合项目管理与 WBS',
    category: 'project',
    layoutLabel: 'WBS 树',
    accent: '#059669',
    branchColors: ['#059669', '#2563eb', '#ea580c', '#9333ea'],
    skeletonSource: `${LAYOUT_HEADER}mindmap
  root((项目名称))
    目标
      核心指标
      验收标准
    阶段一
      任务A
      任务B
    阶段二
      任务C
      任务D
    资源
      人力
      预算`,
    sampleSource: `${LAYOUT_HEADER}mindmap
  root((新产品上线))
    目标
      Q3 完成 MVP
      首月 1000 用户
    调研
      用户访谈
      竞品分析
    开发
      原型设计
      前后端开发
      联调测试
    上线
      灰度发布
      运营推广
    风险
      进度延误
      需求变更`,
    aiGuide: '按项目 WBS 树形分解，一级为维度（目标/阶段/资源），下级为可执行任务，不用流程先后顺序箭头。',
  },
  {
    id: 'topic-learning',
    name: '知识主题梳理',
    description: '围绕一个主题多维度展开，适合学习笔记与知识整理',
    category: 'general',
    layoutLabel: '主题树',
    accent: '#6366f1',
    branchColors: ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b'],
    skeletonSource: `${LAYOUT_HEADER}mindmap
  root((主题))
    概念
      定义
      核心要素
    方法
      步骤要点
      工具
    案例
      成功案例
      常见误区
    延伸
      相关领域
      参考资料`,
    sampleSource: `${LAYOUT_HEADER}mindmap
  root((机器学习入门))
    基础概念
      监督学习
      无监督学习
      模型评估
    核心算法
      线性回归
      决策树
      神经网络
    实践路径
      Python 环境
      数据集准备
      训练与调参
    应用场景
      推荐系统
      图像识别
      自然语言处理`,
    aiGuide: '主题居中，一级分支为知识维度，下级为概念/方法/案例，层级清晰，叶子节点要具体。',
  },
  {
    id: 'meeting-notes',
    name: '会议要点导图',
    description: '会议主题 + 讨论议题 + 结论/待办，便于汇报整理',
    category: 'general',
    layoutLabel: '会议树',
    accent: '#0ea5e9',
    branchColors: ['#0ea5e9', '#6366f1', '#22c55e'],
    skeletonSource: `${LAYOUT_HEADER}mindmap
  root((会议主题))
    背景
    讨论要点
      议题一
      议题二
    结论
    待办
      负责人A
      负责人B`,
    sampleSource: `${LAYOUT_HEADER}mindmap
  root((Q2 经营分析会))
    背景
      营收目标完成 92%
      成本同比上升
    讨论
      市场拓展
        华东区域放缓
        线上渠道增长
      产品迭代
        新功能延期
        客户反馈汇总
    结论
      聚焦高毛利产品
      压缩非核心支出
    待办
      销售部提交补救方案
      产品部确定新排期`,
    aiGuide: '会议导图：背景、讨论（可多级议题）、结论、待办四个主枝，不用流程图式步骤链。',
  },
  {
    id: 'risk-analysis',
    name: '风险因素分析',
    description: '风险分类 + 具体风险点 + 应对措施',
    category: 'analysis',
    layoutLabel: '风险树',
    accent: '#f97316',
    branchColors: ['#ef4444', '#f97316', '#eab308', '#64748b'],
    skeletonSource: `${LAYOUT_HEADER}mindmap
  root((风险分析))
    市场风险
      风险点
      应对
    运营风险
      风险点
      应对
    合规风险
      风险点
      应对`,
    sampleSource: `${LAYOUT_HEADER}mindmap
  root((项目风险图谱))
    进度风险
      关键路径延误
        增加缓冲期
      依赖方延期
        并行备选方案
    成本风险
      材料涨价
        锁价协议
      人力超支
        阶段性复盘
    合规风险
      数据隐私
        合规审计
      合同条款
        法务复核`,
    aiGuide: '按风险类别分支，每类下列具体风险点与应对，树形并列展开而非流程顺序。',
  },
]

export const DEFAULT_MINDMAP_TEMPLATE_ID = MINDMAP_TEMPLATES[0].id

export function getMindmapTemplateById(id: string): MindmapTemplate | undefined {
  return MINDMAP_TEMPLATES.find((item) => item.id === id)
}

export function getMindmapBranchColors(
  template: MindmapTemplate | undefined,
  _colorSchemeId: string,
  fallbackColors: string[],
): string[] {
  if (template?.branchColors?.length) return template.branchColors
  return fallbackColors.slice(0, 4)
}
