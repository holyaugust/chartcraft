export type FlowchartTemplateCategory = 'approval' | 'business' | 'project' | 'tech' | 'general'

export interface FlowchartTemplate {
  id: string
  name: string
  description: string
  category: FlowchartTemplateCategory
  direction: 'TD' | 'LR'
  layoutLabel: string
  accent: string
  /** 完整示例，用于「含示例」 */
  sampleSource: string
  /** 空骨架，用于「应用样式」 */
  skeletonSource: string
  /** 传给 AI 的结构说明 */
  aiGuide: string
}

export const FLOWCHART_TEMPLATE_CATEGORY_LABELS: Record<FlowchartTemplateCategory, string> = {
  approval: '审批决策',
  business: '业务流程',
  project: '项目阶段',
  tech: '系统技术',
  general: '通用结构',
}

export const FLOWCHART_TEMPLATES: FlowchartTemplate[] = [
  {
    id: 'approval-vertical',
    name: '审批流程（纵向）',
    description: '自上而下，含判断节点，适合制度与签批流程',
    category: 'approval',
    direction: 'TD',
    layoutLabel: '自上而下',
    accent: '#2563eb',
    skeletonSource: `flowchart TD
    A([开始]) --> B[提交申请]
    B --> C{是否通过?}
    C -->|是| D[执行]
    C -->|否| E[退回修改]
    E --> B
    D --> F([结束])`,
    sampleSource: `flowchart TD
    A([开始]) --> B[员工提交请假申请]
    B --> C{直属领导审批}
    C -->|同意| D{HR 备案}
    C -->|驳回| E[修改后重新提交]
    E --> B
    D -->|完成| F[归档]
    D -->|需补充| E
    F --> G([结束])`,
    aiGuide: '使用 flowchart TD；包含开始/结束圆角节点、矩形步骤、菱形判断；分支标注「是/否」或具体条件。',
  },
  {
    id: 'timeline-horizontal',
    name: '阶段流程（横向）',
    description: '自左向右展示阶段推进，适合时间线式流程',
    category: 'business',
    direction: 'LR',
    layoutLabel: '自左而右',
    accent: '#0891b2',
    skeletonSource: `flowchart LR
    A([启动]) --> B[需求分析]
    B --> C[方案设计]
    C --> D[开发实施]
    D --> E[验收上线]
    E --> F([完成])`,
    sampleSource: `flowchart LR
    A([项目启动]) --> B[需求调研]
    B --> C[方案评审]
    C --> D[迭代开发]
    D --> E[联调测试]
    E --> F[上线发布]
    F --> G[运营复盘]
    G --> H([结项])`,
    aiGuide: '使用 flowchart LR；节点按时间/阶段顺序从左到右排列；每步用动词短语命名。',
  },
  {
    id: 'swimlane-departments',
    name: '泳道流程',
    description: '按部门/角色分泳道，适合跨部门协作',
    category: 'business',
    direction: 'TD',
    layoutLabel: '泳道分组',
    accent: '#7c3aed',
    skeletonSource: `flowchart TD
    subgraph 申请方
      A[发起申请] --> B[补充材料]
    end
    subgraph 审批方
      C[初审] --> D{终审}
    end
    subgraph 执行方
      E[执行落地] --> F[反馈结果]
    end
    B --> C
    D -->|通过| E
    D -->|驳回| B`,
    sampleSource: `flowchart TD
    subgraph 业务部门
      A[提出采购需求] --> B[填写采购单]
    end
    subgraph 采购部门
      C[询价比价] --> D[合同签订]
    end
    subgraph 财务部门
      E[预算审核] --> F[付款结算]
    end
    B --> C
    C --> E
    E -->|通过| D
    D --> F`,
    aiGuide: '使用 subgraph 划分泳道（部门/角色）；跨泳道用箭头连接；每个泳道 2～4 个节点。',
  },
  {
    id: 'decision-tree',
    name: '决策树',
    description: '多层判断分支，适合策略选择与风控',
    category: 'approval',
    direction: 'TD',
    layoutLabel: '多路决策',
    accent: '#dc2626',
    skeletonSource: `flowchart TD
    A([开始]) --> B{条件 A?}
    B -->|是| C{条件 B?}
    B -->|否| D[方案一]
    C -->|是| E[方案二]
    C -->|否| F[方案三]
    D --> G([结束])
    E --> G
    F --> G`,
    sampleSource: `flowchart TD
    A([客户咨询]) --> B{是否老客户?}
    B -->|是| C{年采购额>100万?}
    B -->|否| D[标准报价流程]
    C -->|是| E[VIP 专属方案]
    C -->|否| F[分级折扣方案]
    D --> G([成交/放弃])
    E --> G
    F --> G`,
    aiGuide: '多层菱形判断节点；每个判断至少 2 个分支；叶子节点为具体方案或结果。',
  },
  {
    id: 'sop-linear',
    name: 'SOP 线性步骤',
    description: '无分支顺序步骤，适合操作手册与 SOP',
    category: 'general',
    direction: 'TD',
    layoutLabel: '线性步骤',
    accent: '#059669',
    skeletonSource: `flowchart TD
    A([开始]) --> B[步骤一]
    B --> C[步骤二]
    C --> D[步骤三]
    D --> E[步骤四]
    E --> F([结束])`,
    sampleSource: `flowchart TD
    A([开始巡检]) --> B[检查设备外观]
    B --> C[记录运行参数]
    C --> D[排查异常告警]
    D --> E[填写巡检报告]
    E --> F[提交班长确认]
    F --> G([结束])`,
    aiGuide: '使用 flowchart TD；无菱形判断；6～10 个顺序矩形步骤；动词开头。',
  },
  {
    id: 'project-phase',
    name: '项目阶段图',
    description: '分组展示阶段与里程碑，适合项目汇报',
    category: 'project',
    direction: 'TD',
    layoutLabel: '阶段分组',
    accent: '#d97706',
    skeletonSource: `flowchart TD
    subgraph 阶段一
      A1[启动] --> A2[目标确认]
    end
    subgraph 阶段二
      B1[执行] --> B2[中期检查]
    end
    subgraph 阶段三
      C1[收尾] --> C2[验收]
    end
    A2 --> B1
    B2 --> C1`,
    sampleSource: `flowchart TD
    subgraph 启动阶段
      P1[立项批复] --> P2[团队组建]
    end
    subgraph 实施阶段
      P3[需求开发] --> P4[集成测试]
    end
    subgraph 交付阶段
      P5[用户培训] --> P6[正式上线]
    end
    P2 --> P3
    P4 --> P5
    P6 --> P7([项目结项])`,
    aiGuide: '用 subgraph 表示项目阶段；阶段内 2 步，阶段间顺序衔接；最后接结束节点。',
  },
  {
    id: 'system-flow',
    name: '系统交互流程',
    description: '用户-系统-后台交互，适合产品与技术说明',
    category: 'tech',
    direction: 'LR',
    layoutLabel: '交互序列',
    accent: '#4f46e5',
    skeletonSource: `flowchart LR
    U([用户]) --> A[前端界面]
    A --> B[业务服务]
    B --> C[(数据库)]
    B --> D[第三方接口]
    D --> B
    B --> A
    A --> U`,
    sampleSource: `flowchart LR
    U([用户]) --> FE[登录页面]
    FE --> API[认证服务]
    API --> DB[(用户库)]
    API --> SMS[短信网关]
    SMS --> API
    API --> FE
    FE --> U`,
    aiGuide: '使用 flowchart LR；包含用户/前端/服务/数据库等角色；箭头表示调用方向；可含圆柱形数据库节点。',
  },
  {
    id: 'loop-improve',
    name: '闭环改进',
    description: 'PDCA 式循环，适合持续改进与质量管理',
    category: 'general',
    direction: 'TD',
    layoutLabel: '循环改进',
    accent: '#0d9488',
    skeletonSource: `flowchart TD
    A([开始]) --> B[计划 Plan]
    B --> C[执行 Do]
    C --> D[检查 Check]
    D --> E{是否达标?}
    E -->|是| F[标准化 Act]
    E -->|否| B
    F --> G([结束])`,
    sampleSource: `flowchart TD
    A([启动改进]) --> B[分析现状与根因]
    B --> C[制定改进措施]
    C --> D[组织实施]
    D --> E[效果评估]
    E --> F{目标达成?}
    F -->|否| B
    F -->|是| G[固化标准流程]
    G --> H([完成])`,
    aiGuide: '体现 Plan-Do-Check-Act 闭环；未达标时回到计划/分析步骤。',
  },
]

export const DEFAULT_FLOWCHART_TEMPLATE_ID = FLOWCHART_TEMPLATES[0].id

export function getFlowchartTemplateById(id: string): FlowchartTemplate | undefined {
  return FLOWCHART_TEMPLATES.find((item) => item.id === id)
}
