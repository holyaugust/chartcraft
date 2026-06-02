export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'radar' | 'donut'

export type ColorSchemeId =
  | 'default'
  | 'ocean'
  | 'sunset'
  | 'forest'
  | 'vivid'
  | 'pastel'
  | 'business'
  | 'mono'

export type BarStyleId = 'rounded' | 'flat' | 'gradient' | 'capsule' | 'outline' | 'shadow'

export type LineStyleId = 'solid' | 'dashed' | 'step' | 'dot' | 'bold' | 'gradient'

export type AreaStyleId = 'gradient' | 'solid' | 'stream' | 'outline' | 'step' | 'layered'

export type PieStyleId = 'classic' | 'flat' | 'rose' | 'gap' | 'gradient' | 'minimal'

export type ScatterStyleId = 'circle' | 'diamond' | 'ring' | 'cross' | 'triangle' | 'bubble'

export type RadarStyleId = 'circle' | 'polygon' | 'filled' | 'outline' | 'gradient' | 'dashed'

export type { CellAlign, CellMerge, CellNumberFormat, CellStyle, TableData, TableMeta, TableState } from './types/table'
export { EMPTY_TABLE_META, createTableState } from './types/table'

import type { TableData } from './types/table'

export interface ChartConfig {
  type: ChartType
  title: string
  subtitle: string
  showLegend: boolean
  legendItemGap: number
  showGrid: boolean
  smooth: boolean
  stacked: boolean
  colorScheme: ColorSchemeId
  barStyle: BarStyleId
  lineStyle: LineStyleId
  areaStyle: AreaStyleId
  pieStyle: PieStyleId
  scatterStyle: ScatterStyleId
  radarStyle: RadarStyleId
}

export interface ParsedChartData {
  categories: string[]
  series: { name: string; data: number[] }[]
  scatterPoints?: { name: string; value: [number, number] }[]
}

export const DEFAULT_TABLE: TableData = [
  ['月份', '销售额', '利润', '成本'],
  ['1月', '8200', '2100', '6100'],
  ['2月', '9320', '2540', '6780'],
  ['3月', '9010', '2380', '6630'],
  ['4月', '9340', '2890', '6450'],
  ['5月', '12900', '3900', '9000'],
  ['6月', '13300', '4200', '9100'],
]

export const CHART_TYPE_LABELS: Record<ChartType, string> = {
  bar: '柱状图',
  line: '折线图',
  pie: '饼图',
  area: '面积图',
  scatter: '散点图',
  radar: '雷达图',
  donut: '环形图',
}
