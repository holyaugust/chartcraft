import type { ChartConfig, ChartType, TableData } from '../types'
import { CHART_TYPE_LABELS } from '../types'
import { DEFAULT_CHART_CONFIG } from '../utils/projectStorage'

export type ChartTemplateCategory =
  | 'sales'
  | 'share'
  | 'compare'
  | 'trend'
  | 'relation'
  | 'overview'

export interface ChartTemplate {
  id: string
  name: string
  description: string
  category: ChartTemplateCategory
  chartType: ChartType
  accent: string
  sampleData: TableData
  config: ChartConfig
}

export const CHART_TEMPLATE_CATEGORY_LABELS: Record<ChartTemplateCategory, string> = {
  sales: '销售分析',
  share: '占比结构',
  compare: '对比排名',
  trend: '趋势走势',
  relation: '相关关系',
  overview: '综合评估',
}

function cfg(partial: Partial<ChartConfig>): ChartConfig {
  return { ...DEFAULT_CHART_CONFIG, ...partial }
}

function cloneData(data: TableData): TableData {
  return data.map((row) => row.map((cell) => String(cell)))
}

export const CHART_TEMPLATES: ChartTemplate[] = [
  {
    id: 'monthly-sales-line',
    name: '月度销售趋势',
    description: '折线展示时间序列，适合月度、季度业绩跟踪',
    category: 'trend',
    chartType: 'line',
    accent: '#0284c7',
    sampleData: cloneData([
      ['月份', '销售额', '目标额'],
      ['1月', '8200', '8000'],
      ['2月', '9320', '8500'],
      ['3月', '9010', '9000'],
      ['4月', '9340', '9200'],
      ['5月', '12900', '11000'],
      ['6月', '13300', '12000'],
    ]),
    config: cfg({
      type: 'line',
      title: '月度销售趋势',
      subtitle: '2024 年上半年',
      colorScheme: 'ocean',
      lineStyle: 'solid',
      smooth: true,
      showGrid: true,
      showLegend: true,
      showDataLabels: false,
      xAxisTitle: '月份',
      yAxisTitle: '金额（万元）',
      yAxis2Title: '',
      dualAxis: false,
      stacked: false,
    }),
  },
  {
    id: 'category-sales-bar',
    name: '品类销售对比',
    description: '柱状对比各品类或区域，突出差异与排名',
    category: 'compare',
    chartType: 'bar',
    accent: '#2563eb',
    sampleData: cloneData([
      ['品类', '销售额', '利润'],
      ['手机', '128000', '32000'],
      ['电脑', '96000', '24000'],
      ['平板', '54000', '10800'],
      ['配件', '38000', '9500'],
      ['穿戴', '29000', '8700'],
    ]),
    config: cfg({
      type: 'bar',
      title: '品类销售对比',
      subtitle: '本季度各产品线',
      colorScheme: 'business',
      barStyle: 'rounded',
      showGrid: true,
      showLegend: true,
      showDataLabels: true,
      xAxisTitle: '品类',
      yAxisTitle: '金额',
      dualAxis: false,
      stacked: false,
    }),
  },
  {
    id: 'market-share-pie',
    name: '市场份额占比',
    description: '饼图展示构成比例，适合份额与结构分析',
    category: 'share',
    chartType: 'pie',
    accent: '#ea580c',
    sampleData: cloneData([
      ['品牌', '份额'],
      ['品牌 A', '35'],
      ['品牌 B', '28'],
      ['品牌 C', '18'],
      ['品牌 D', '12'],
      ['其他', '7'],
    ]),
    config: cfg({
      type: 'pie',
      title: '市场份额占比',
      subtitle: '2024 Q2',
      colorScheme: 'sunset',
      pieStyle: 'classic',
      showLegend: true,
      showDataLabels: true,
      showGrid: false,
      stacked: false,
    }),
  },
  {
    id: 'budget-donut',
    name: '预算结构环形图',
    description: '环形图呈现费用或预算构成，中心留白更清爽',
    category: 'share',
    chartType: 'donut',
    accent: '#db2777',
    sampleData: cloneData([
      ['项目', '预算占比'],
      ['人力成本', '42'],
      ['市场推广', '25'],
      ['研发投入', '18'],
      ['运营成本', '10'],
      ['其他', '5'],
    ]),
    config: cfg({
      type: 'donut',
      title: '预算结构分析',
      subtitle: '年度费用构成',
      colorScheme: 'pastel',
      pieStyle: 'minimal',
      showLegend: true,
      showDataLabels: true,
      showGrid: false,
    }),
  },
  {
    id: 'growth-area',
    name: '增长面积图',
    description: '面积图强调累计与趋势变化，视觉更饱满',
    category: 'trend',
    chartType: 'area',
    accent: '#16a34a',
    sampleData: cloneData([
      ['季度', '新用户', '活跃用户'],
      ['Q1', '12000', '45000'],
      ['Q2', '15800', '52000'],
      ['Q3', '18600', '61000'],
      ['Q4', '22400', '73000'],
    ]),
    config: cfg({
      type: 'area',
      title: '用户增长趋势',
      subtitle: '按季度统计',
      colorScheme: 'forest',
      areaStyle: 'gradient',
      smooth: true,
      showGrid: true,
      showLegend: true,
      xAxisTitle: '季度',
      yAxisTitle: '用户数',
    }),
  },
  {
    id: 'sales-profit-combo',
    name: '柱线组合分析',
    description: '柱形看绝对值，折线看比率，双指标一图呈现',
    category: 'sales',
    chartType: 'combo',
    accent: '#4f46e5',
    sampleData: cloneData([
      ['月份', '销售额', '利润率'],
      ['1月', '8200', '26'],
      ['2月', '9320', '27'],
      ['3月', '9010', '26'],
      ['4月', '9340', '31'],
      ['5月', '12900', '30'],
      ['6月', '13300', '32'],
    ]),
    config: cfg({
      type: 'combo',
      title: '销售额与利润率',
      subtitle: '柱线组合 · 2024 上半年',
      colorScheme: 'business',
      barStyle: 'flat',
      lineStyle: 'bold',
      showGrid: true,
      showLegend: true,
      showDataLabels: false,
      xAxisTitle: '月份',
      yAxisTitle: '销售额',
      yAxis2Title: '利润率（%）',
      dualAxis: true,
    }),
  },
  {
    id: 'channel-stacked-bar',
    name: '渠道堆叠贡献',
    description: '堆叠柱状展示各部分对整体的累计贡献',
    category: 'sales',
    chartType: 'bar',
    accent: '#7c3aed',
    sampleData: cloneData([
      ['月份', '线上', '线下', '分销'],
      ['1月', '3200', '2800', '2200'],
      ['2月', '3600', '2900', '2820'],
      ['3月', '3400', '3100', '2510'],
      ['4月', '3800', '3000', '2540'],
      ['5月', '5200', '4200', '3500'],
      ['6月', '5500', '4300', '3500'],
    ]),
    config: cfg({
      type: 'bar',
      title: '渠道销售贡献',
      subtitle: '堆叠对比各渠道',
      colorScheme: 'vivid',
      barStyle: 'gradient',
      stacked: true,
      showGrid: true,
      showLegend: true,
      xAxisTitle: '月份',
      yAxisTitle: '销售额',
    }),
  },
  {
    id: 'kpi-ranking-bar',
    name: 'KPI 排名对比',
    description: '简洁柱状突出排名与差距，适合考核指标',
    category: 'compare',
    chartType: 'bar',
    accent: '#475569',
    sampleData: cloneData([
      ['部门', '完成率'],
      ['华东区', '118'],
      ['华南区', '105'],
      ['华北区', '98'],
      ['西南区', '92'],
      ['西北区', '87'],
    ]),
    config: cfg({
      type: 'bar',
      title: '部门 KPI 完成率',
      subtitle: '年度目标达成（%）',
      colorScheme: 'mono',
      barStyle: 'flat',
      showGrid: true,
      showLegend: false,
      showDataLabels: true,
      xAxisTitle: '部门',
      yAxisTitle: '完成率（%）',
    }),
  },
  {
    id: 'product-radar',
    name: '产品能力雷达',
    description: '雷达图多维对比产品或竞品综合实力',
    category: 'overview',
    chartType: 'radar',
    accent: '#0d9488',
    sampleData: cloneData([
      ['维度', '产品 A', '产品 B'],
      ['性能', '85', '78'],
      ['易用性', '90', '82'],
      ['价格', '70', '88'],
      ['服务', '88', '75'],
      ['生态', '76', '80'],
    ]),
    config: cfg({
      type: 'radar',
      title: '产品能力对比',
      subtitle: '五维评估',
      colorScheme: 'vivid',
      radarStyle: 'filled',
      showLegend: true,
      showGrid: true,
      showDataLabels: false,
    }),
  },
  {
    id: 'roi-scatter',
    name: '投入产出散点',
    description: '散点图分析两变量相关性与分布',
    category: 'relation',
    chartType: 'scatter',
    accent: '#0891b2',
    sampleData: cloneData([
      ['活动', '广告投入', '转化量'],
      ['活动 A', '120', '340'],
      ['活动 B', '80', '210'],
      ['活动 C', '200', '520'],
      ['活动 D', '150', '410'],
      ['活动 E', '60', '180'],
      ['活动 F', '180', '470'],
    ]),
    config: cfg({
      type: 'scatter',
      title: '广告投入与转化',
      subtitle: '散点相关分析',
      colorScheme: 'ocean',
      scatterStyle: 'circle',
      showGrid: true,
      showLegend: false,
      xAxisTitle: '广告投入（万元）',
      yAxisTitle: '转化量',
    }),
  },
]

export function getChartTemplateById(id: string): ChartTemplate | undefined {
  return CHART_TEMPLATES.find((template) => template.id === id)
}

export function getChartTypeLabel(type: ChartType): string {
  return CHART_TYPE_LABELS[type]
}
