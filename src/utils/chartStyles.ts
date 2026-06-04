import type {
  AreaStyleId,
  ChartType,
  LineStyleId,
  PieStyleId,
  RadarStyleId,
  ScatterStyleId,
} from '../types'
import { BAR_STYLE_LABELS } from './colorSchemes'

export const LINE_STYLE_LABELS: Record<LineStyleId, string> = {
  solid: '实线',
  dashed: '虚线',
  step: '阶梯',
  dot: '圆点',
  bold: '粗线',
  gradient: '渐变',
}

export const AREA_STYLE_LABELS: Record<AreaStyleId, string> = {
  gradient: '渐变',
  solid: '纯色',
  stream: '流式',
  outline: '描边',
  step: '阶梯',
  layered: '分层',
}

export const PIE_STYLE_LABELS: Record<PieStyleId, string> = {
  classic: '经典',
  flat: '扁平',
  rose: '玫瑰',
  gap: '间隔',
  gradient: '渐变',
  minimal: '极简',
}

export const SCATTER_STYLE_LABELS: Record<ScatterStyleId, string> = {
  circle: '圆点',
  diamond: '菱形',
  ring: '圆环',
  cross: '十字',
  triangle: '三角',
  bubble: '气泡',
}

export const RADAR_STYLE_LABELS: Record<RadarStyleId, string> = {
  circle: '圆形',
  polygon: '多边形',
  filled: '填充',
  outline: '描边',
  gradient: '渐变',
  dashed: '虚线',
}

export const CHART_TYPE_STYLE_TITLES: Record<ChartType, string> = {
  bar: '柱状样式',
  line: '折线样式',
  area: '面积样式',
  pie: '饼图样式',
  donut: '环形样式',
  scatter: '散点样式',
  radar: '雷达样式',
  combo: '组合样式',
}

export const DEFAULT_LINE_STYLE: LineStyleId = 'solid'
export const DEFAULT_AREA_STYLE: AreaStyleId = 'gradient'
export const DEFAULT_PIE_STYLE: PieStyleId = 'classic'
export const DEFAULT_SCATTER_STYLE: ScatterStyleId = 'circle'
export const DEFAULT_RADAR_STYLE: RadarStyleId = 'circle'

type StyleLabelsMap = Record<string, string>

export function getChartStyleMeta(type: ChartType): {
  configKey: 'barStyle' | 'lineStyle' | 'areaStyle' | 'pieStyle' | 'scatterStyle' | 'radarStyle'
  title: string
  labels: StyleLabelsMap
  defaultStyle: string
} {
  switch (type) {
    case 'bar':
      return {
        configKey: 'barStyle',
        title: CHART_TYPE_STYLE_TITLES.bar,
        labels: BAR_STYLE_LABELS,
        defaultStyle: 'rounded',
      }
    case 'line':
      return {
        configKey: 'lineStyle',
        title: CHART_TYPE_STYLE_TITLES.line,
        labels: LINE_STYLE_LABELS,
        defaultStyle: DEFAULT_LINE_STYLE,
      }
    case 'area':
      return {
        configKey: 'areaStyle',
        title: CHART_TYPE_STYLE_TITLES.area,
        labels: AREA_STYLE_LABELS,
        defaultStyle: DEFAULT_AREA_STYLE,
      }
    case 'pie':
    case 'donut':
      return {
        configKey: 'pieStyle',
        title: CHART_TYPE_STYLE_TITLES[type],
        labels: PIE_STYLE_LABELS,
        defaultStyle: DEFAULT_PIE_STYLE,
      }
    case 'scatter':
      return {
        configKey: 'scatterStyle',
        title: CHART_TYPE_STYLE_TITLES.scatter,
        labels: SCATTER_STYLE_LABELS,
        defaultStyle: DEFAULT_SCATTER_STYLE,
      }
    case 'radar':
      return {
        configKey: 'radarStyle',
        title: CHART_TYPE_STYLE_TITLES.radar,
        labels: RADAR_STYLE_LABELS,
        defaultStyle: DEFAULT_RADAR_STYLE,
      }
    case 'combo':
      return {
        configKey: 'barStyle',
        title: CHART_TYPE_STYLE_TITLES.combo,
        labels: BAR_STYLE_LABELS,
        defaultStyle: 'rounded',
      }
  }
}
