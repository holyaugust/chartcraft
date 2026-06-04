import type { EChartsOption } from 'echarts'
import type {
  AreaStyleId,
  BarStyleId,
  ChartConfig,
  LineStyleId,
  ParsedChartData,
  PieStyleId,
  RadarStyleId,
  ScatterStyleId,
} from '../types'
import { alphaColor, getColors, getSeriesColors, lightenColor } from './colorSchemes'
import {
  buildAreaDataLabel,
  buildBarDataLabel,
  buildLineDataLabel,
  buildRadarDataLabel,
  buildScatterDataLabel,
} from './chartLabels'

function usesDualAxis(config: ChartConfig, seriesCount: number): boolean {
  return seriesCount > 1 && (config.type === 'combo' || config.dualAxis)
}

function resolveChartColors(config: ChartConfig, seriesCount: number) {
  return getSeriesColors(config.colorScheme, seriesCount, config.type)
}

const AXIS_TITLE_STYLE = {
  color: '#475569',
  fontSize: 13,
  fontWeight: 600,
} as const

function hasAxisTitle(title: string | undefined): boolean {
  return Boolean(title?.trim())
}

function buildCategoryAxis(categories: string[], title: string) {
  const name = title.trim() || undefined
  return {
    type: 'category' as const,
    data: categories,
    name,
    nameLocation: 'middle' as const,
    nameGap: name ? 42 : 0,
    nameTextStyle: AXIS_TITLE_STYLE,
    axisLine: { show: true, lineStyle: { color: '#cbd5e1' } },
    axisTick: { alignWithLabel: true },
    axisLabel: { color: '#64748b', margin: 10 },
  }
}

function buildValueAxis(
  config: ChartConfig,
  title: string,
  position: 'left' | 'right' = 'left',
  showSplitLine = true,
) {
  const name = title.trim() || undefined
  const isRight = position === 'right'

  return {
    type: 'value' as const,
    position,
    name,
    nameLocation: 'middle' as const,
    nameRotate: name ? (isRight ? -90 : 90) : 0,
    nameGap: name ? 56 : 0,
    nameTextStyle: AXIS_TITLE_STYLE,
    axisLine: { show: true, lineStyle: { color: '#e2e8f0' } },
    axisTick: { show: false },
    splitLine: {
      show: config.showGrid && showSplitLine,
      lineStyle: { color: '#f1f5f9', type: 'dashed' as const },
    },
    axisLabel: {
      color: '#64748b',
      margin: isRight ? 14 : 8,
    },
  }
}

function applyCartesianLayout(option: EChartsOption, config: ChartConfig, dual: boolean) {
  if (!option.grid || Array.isArray(option.grid)) return

  const hasXTitle = hasAxisTitle(config.xAxisTitle)
  const hasYTitle = hasAxisTitle(config.yAxisTitle)
  const hasY2Title = hasAxisTitle(config.yAxis2Title)

  option.grid = {
    ...option.grid,
    left: hasYTitle ? 64 : '3%',
    right: dual || hasY2Title ? 64 : '4%',
    bottom: hasXTitle
      ? config.showLegend
        ? '20%'
        : '14%'
      : config.showLegend
        ? config.showDataLabels
          ? '16%'
          : '14%'
        : config.showDataLabels
          ? '10%'
          : '8%',
    top: config.subtitle ? '18%' : '14%',
    containLabel: !hasYTitle && !hasY2Title,
  }
}

function resolveYAxisIndex(config: ChartConfig, seriesIndex: number, seriesCount: number): number {
  if (!usesDualAxis(config, seriesCount)) return 0
  return seriesIndex === 0 ? 0 : 1
}

function baseOption(config: ChartConfig, colors?: string[]): EChartsOption {
  return {
    backgroundColor: 'transparent',
    color: colors ?? resolveChartColors(config, 6),
    title: {
      text: config.title,
      subtext: config.subtitle,
      left: 'center',
      top: 8,
      textStyle: { fontSize: 20, fontWeight: 600, color: '#1e293b' },
      subtextStyle: { fontSize: 13, color: '#64748b' },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      textStyle: { color: '#334155' },
      axisPointer: { type: 'shadow' },
    },
    legend: {
      show: config.showLegend,
      bottom: 8,
      itemGap: config.legendItemGap,
      textStyle: { color: '#64748b' },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: config.showLegend ? '14%' : '8%',
      top: config.subtitle ? '18%' : '14%',
      containLabel: true,
    },
  }
}

function buildBarItemStyle(style: BarStyleId, color: string) {
  switch (style) {
    case 'flat':
      return { borderRadius: 0, color }
    case 'capsule':
      return { borderRadius: 999, color }
    case 'gradient':
      return {
        borderRadius: [8, 8, 0, 0],
        color: {
          type: 'linear' as const,
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: lightenColor(color, 0.25) },
            { offset: 1, color },
          ],
        },
      }
    case 'outline':
      return {
        borderRadius: [8, 8, 0, 0],
        color: alphaColor(color, 0.15),
        borderColor: color,
        borderWidth: 2,
      }
    case 'shadow':
      return {
        borderRadius: [8, 8, 0, 0],
        color,
        shadowBlur: 10,
        shadowColor: alphaColor(color, 0.45),
        shadowOffsetY: 4,
      }
    case 'rounded':
    default:
      return { borderRadius: [8, 8, 0, 0], color }
  }
}

function buildLineStyle(style: LineStyleId, color: string) {
  const base = { color, width: 2 }

  switch (style) {
    case 'dashed':
      return { ...base, type: 'dashed' as const }
    case 'bold':
      return { ...base, width: 4 }
    case 'gradient':
      return {
        width: 3,
        color: {
          type: 'linear' as const,
          x: 0,
          y: 0,
          x2: 1,
          y2: 0,
          colorStops: [
            { offset: 0, color: lightenColor(color, 0.35) },
            { offset: 1, color },
          ],
        },
      }
    default:
      return base
  }
}

function buildLineSeriesExtras(style: LineStyleId) {
  switch (style) {
    case 'step':
      return { step: 'middle' as const, showSymbol: false }
    case 'dot':
      return { showSymbol: true, symbol: 'circle' as const, symbolSize: 8 }
    default:
      return { showSymbol: false }
  }
}

function buildAreaStyle(style: AreaStyleId, color: string, seriesIndex: number) {
  switch (style) {
    case 'gradient':
      return {
        opacity: 1,
        color: {
          type: 'linear' as const,
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: alphaColor(color, 0.45) },
            { offset: 1, color: alphaColor(color, 0.02) },
          ],
        },
      }
    case 'stream':
      return { opacity: 0.4, color: alphaColor(color, 0.35) }
    case 'outline':
      return { opacity: 0.06, color: alphaColor(color, 0.12) }
    case 'step':
      return { opacity: 0.22, color: alphaColor(color, 0.28) }
    case 'layered':
      return { opacity: 0.12 + (seriesIndex % 3) * 0.12, color: alphaColor(color, 0.35) }
    case 'solid':
    default:
      return { opacity: 0.25, color: alphaColor(color, 0.35) }
  }
}

function buildAreaLineExtras(style: AreaStyleId) {
  if (style === 'outline') {
    return { lineStyle: { width: 3 }, showSymbol: false }
  }
  if (style === 'step') {
    return { step: 'middle' as const, showSymbol: false }
  }
  return { showSymbol: false }
}

function buildPieItemStyle(style: PieStyleId, color: string) {
  switch (style) {
    case 'flat':
      return { borderRadius: 0, borderColor: '#fff', borderWidth: 2, color }
    case 'gap':
      return { borderRadius: 4, borderColor: '#fff', borderWidth: 3, color }
    case 'gradient':
      return {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 2,
        color: {
          type: 'linear' as const,
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: lightenColor(color, 0.28) },
            { offset: 1, color },
          ],
        },
      }
    case 'minimal':
      return { borderRadius: 2, borderColor: '#fff', borderWidth: 1, color }
    case 'classic':
    default:
      return { borderRadius: 6, borderColor: '#fff', borderWidth: 2, color }
  }
}

function buildPieSeriesExtras(style: PieStyleId, donut: boolean, showDataLabels: boolean) {
  const extras: Record<string, unknown> = {}

  if (style === 'rose') {
    extras.roseType = 'radius'
    extras.radius = donut ? ['18%', '72%'] : ['0%', '72%']
  } else if (style === 'gap') {
    extras.padAngle = 3
    extras.radius = donut ? ['42%', '68%'] : ['0%', '68%']
  } else if (style === 'minimal') {
    extras.radius = donut ? ['45%', '62%'] : ['0%', '62%']
    extras.label = { show: showDataLabels }
    extras.labelLine = { show: showDataLabels }
  } else {
    extras.radius = donut ? ['42%', '68%'] : ['0%', '68%']
  }

  return extras
}

function buildScatterSymbol(style: ScatterStyleId) {
  switch (style) {
    case 'diamond':
      return 'diamond' as const
    case 'ring':
      return 'emptyCircle' as const
    case 'cross':
      return 'cross' as const
    case 'triangle':
      return 'triangle' as const
    case 'circle':
    case 'bubble':
    default:
      return 'circle' as const
  }
}

function buildScatterSize(style: ScatterStyleId, values: Array<[number, number]>) {
  if (style === 'bubble' && values.length > 0) {
    const maxY = Math.max(...values.map((v) => v[1]), 1)
    return (val: unknown) => {
      const point = val as [number, number]
      const size = 10 + (point[1] / maxY) * 26
      return Math.max(10, Math.min(36, size))
    }
  }

  switch (style) {
    case 'ring':
      return 16
    case 'cross':
    case 'triangle':
      return 12
    case 'diamond':
      return 14
    case 'circle':
    default:
      return 14
  }
}

function buildRadarShape(style: RadarStyleId) {
  return style === 'polygon' ? ('polygon' as const) : ('circle' as const)
}

function buildRadarSeriesStyle(style: RadarStyleId, color: string) {
  switch (style) {
    case 'filled':
      return {
        lineStyle: { color, width: 2 },
        areaStyle: { opacity: 0.35, color: alphaColor(color, 0.35) },
        itemStyle: { color },
      }
    case 'outline':
      return {
        lineStyle: { color, width: 2.5 },
        areaStyle: { opacity: 0 },
        itemStyle: { color },
      }
    case 'gradient':
      return {
        lineStyle: { color, width: 2 },
        areaStyle: {
          opacity: 1,
          color: {
            type: 'radial' as const,
            x: 0.5,
            y: 0.5,
            r: 0.8,
            colorStops: [
              { offset: 0, color: alphaColor(color, 0.45) },
              { offset: 1, color: alphaColor(color, 0.05) },
            ],
          },
        },
        itemStyle: { color },
      }
    case 'dashed':
      return {
        lineStyle: { color, width: 2, type: 'dashed' as const },
        areaStyle: { opacity: 0.12, color: alphaColor(color, 0.2) },
        itemStyle: { color },
      }
    case 'circle':
    case 'polygon':
    default:
      return {
        lineStyle: { color, width: 2 },
        areaStyle: { opacity: 0.15, color: alphaColor(color, 0.25) },
        itemStyle: { color },
      }
  }
}

function buildCartesianYAxes(config: ChartConfig, parsed: ParsedChartData) {
  const dual = usesDualAxis(config, parsed.series.length)
  const leftTitle = config.yAxisTitle.trim() || (dual ? '' : parsed.series[0]?.name ?? '')
  const rightTitle = dual ? config.yAxis2Title.trim() : ''

  if (!dual) {
    return buildValueAxis(config, leftTitle, 'left')
  }

  return [
    buildValueAxis(config, leftTitle, 'left', true),
    buildValueAxis(config, rightTitle, 'right', false),
  ]
}

function buildBarSeries(
  parsed: ParsedChartData,
  config: ChartConfig,
  colors: string[],
): EChartsOption['series'] {
  const isCapsule = config.barStyle === 'capsule'
  const dual = usesDualAxis(config, parsed.series.length)

  return parsed.series.map((s, index) => {
    const color = colors[index % colors.length]
    return {
      name: s.name,
      type: 'bar' as const,
      data: s.data,
      yAxisIndex: resolveYAxisIndex(config, index, parsed.series.length),
      stack: config.stacked && !dual ? 'total' : undefined,
      barWidth: isCapsule ? '36%' : undefined,
      barGap: isCapsule ? '20%' : undefined,
      emphasis: { focus: 'series' as const },
      itemStyle: buildBarItemStyle(config.barStyle, color),
      label: buildBarDataLabel(config, color),
    }
  })
}

function barOption(parsed: ParsedChartData, config: ChartConfig): EChartsOption {
  const colors = resolveChartColors(config, parsed.series.length)
  const option = baseOption(config, colors)
  const dual = usesDualAxis(config, parsed.series.length)
  option.xAxis = buildCategoryAxis(parsed.categories, config.xAxisTitle)
  option.yAxis = buildCartesianYAxes(config, parsed)
  applyCartesianLayout(option, config, dual)
  option.series = buildBarSeries(parsed, config, colors)
  return option
}

function barLineAreaOption(
  parsed: ParsedChartData,
  config: ChartConfig,
  chartType: 'line' | 'area',
): EChartsOption {
  const colors = resolveChartColors(config, parsed.series.length)
  const option = baseOption(config, colors)
  const dual = usesDualAxis(config, parsed.series.length)
  option.xAxis = buildCategoryAxis(parsed.categories, config.xAxisTitle)
  option.yAxis = buildCartesianYAxes(config, parsed)
  applyCartesianLayout(option, config, dual)

  if (chartType === 'line') {
    option.series = parsed.series.map((s, index) => {
      const color = colors[index % colors.length]
      return {
        name: s.name,
        type: 'line' as const,
        data: s.data,
        yAxisIndex: resolveYAxisIndex(config, index, parsed.series.length),
        smooth: config.smooth && config.lineStyle !== 'step',
        stack: config.stacked && !dual ? 'total' : undefined,
        lineStyle: buildLineStyle(config.lineStyle, color),
        itemStyle: { color },
        label: buildLineDataLabel(config, color, index),
        emphasis: { focus: 'series' as const },
        ...buildLineSeriesExtras(config.lineStyle),
      }
    })
    return option
  }

  option.series = parsed.series.map((s, index) => {
    const color = colors[index % colors.length]
    const areaStyle = config.areaStyle
    return {
      name: s.name,
      type: 'line' as const,
      data: s.data,
      yAxisIndex: resolveYAxisIndex(config, index, parsed.series.length),
      smooth: config.smooth && areaStyle !== 'step',
      stack: config.stacked && !dual ? 'total' : undefined,
      lineStyle: buildLineStyle(areaStyle === 'outline' ? 'bold' : 'solid', color),
      areaStyle: buildAreaStyle(areaStyle, color, index),
      itemStyle: { color },
      label: buildAreaDataLabel(config, color, index),
      emphasis: { focus: 'series' as const },
      ...buildAreaLineExtras(areaStyle),
    }
  })
  return option
}

function comboOption(parsed: ParsedChartData, config: ChartConfig): EChartsOption {
  const colors = resolveChartColors(config, parsed.series.length)
  const option = baseOption(config, colors)

  option.xAxis = buildCategoryAxis(parsed.categories, config.xAxisTitle)
  option.yAxis = buildCartesianYAxes(config, parsed)
  applyCartesianLayout(option, config, parsed.series.length > 1)

  if (parsed.series.length === 0) {
    option.series = []
    return option
  }

  const [first, ...rest] = parsed.series
  const barColor = colors[0]

  option.series = [
    {
      name: first.name,
      type: 'bar' as const,
      data: first.data,
      yAxisIndex: 0,
      barWidth: config.barStyle === 'capsule' ? '36%' : undefined,
      itemStyle: buildBarItemStyle(config.barStyle, barColor),
      label: buildBarDataLabel(config, barColor),
      emphasis: { focus: 'series' as const },
    },
    ...rest.map((s, index) => {
      const color = colors[(index + 1) % colors.length]
      return {
        name: s.name,
        type: 'line' as const,
        data: s.data,
        yAxisIndex: 1,
        smooth: config.smooth && config.lineStyle !== 'step',
        lineStyle: buildLineStyle(config.lineStyle, color),
        itemStyle: { color },
        label: buildLineDataLabel(config, color, index),
        emphasis: { focus: 'series' as const },
        ...buildLineSeriesExtras(config.lineStyle),
      }
    }),
  ]

  return option
}

function pieOption(parsed: ParsedChartData, config: ChartConfig, donut = false): EChartsOption {
  const colors = getColors(config.colorScheme)
  const option = baseOption(config, colors)
  option.tooltip = { trigger: 'item', formatter: '{b}: {c} ({d}%)' }
  option.legend = {
    show: config.showLegend,
    orient: 'vertical',
    right: 16,
    top: 'center',
    itemGap: config.legendItemGap,
    textStyle: { color: '#64748b' },
  }

  const pieStyle = config.pieStyle
  const seriesData = parsed.categories.map((name, i) => {
    const color = colors[i % colors.length]
    return {
      name,
      value: parsed.series[0]?.data[i] ?? 0,
      itemStyle: buildPieItemStyle(pieStyle, color),
    }
  })

  const pieExtras = buildPieSeriesExtras(pieStyle, donut, config.showDataLabels)
  const showPieLabels = config.showDataLabels && pieStyle !== 'minimal'

  option.series = [
    {
      type: 'pie',
      center: ['42%', '55%'],
      data: seriesData,
      emphasis: {
        itemStyle: { shadowBlur: 12, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.15)' },
      },
      label: showPieLabels
        ? { show: true, color: '#475569', formatter: '{b}\n{c}\n{d}%' }
        : { show: false },
      labelLine: showPieLabels ? { show: true } : { show: false },
      ...pieExtras,
    },
  ]
  return option
}

function scatterOption(parsed: ParsedChartData, config: ChartConfig): EChartsOption {
  const colors = resolveChartColors(config, parsed.scatterPoints?.length ?? 1)
  const points = parsed.scatterPoints?.map((p) => ({ name: p.name, value: p.value })) ?? []
  const values = points.map((p) => p.value)
  const scatterStyle = config.scatterStyle

  const option = baseOption(config, colors)
  option.tooltip = {
    trigger: 'item',
    formatter: (params: unknown) => {
      const p = params as { name: string; value: [number, number] }
      return `${p.name}<br/>X: ${p.value[0]}<br/>Y: ${p.value[1]}`
    },
  }
  const xTitle = config.xAxisTitle.trim() || parsed.series[0]?.name || ''
  const yTitle = config.yAxisTitle.trim() || parsed.series[1]?.name || parsed.series[0]?.name || ''

  option.xAxis = {
    ...buildValueAxis(config, xTitle, 'left'),
    nameLocation: 'middle' as const,
    nameRotate: 0,
    nameGap: hasAxisTitle(xTitle) ? 42 : 0,
  }
  option.yAxis = {
    ...buildValueAxis(config, yTitle, 'left'),
    nameLocation: 'middle' as const,
    nameRotate: hasAxisTitle(yTitle) ? 90 : 0,
    nameGap: hasAxisTitle(yTitle) ? 56 : 0,
  }
  applyCartesianLayout(option, config, false)
  option.series = [
    {
      type: 'scatter',
      symbol: buildScatterSymbol(scatterStyle),
      symbolSize: buildScatterSize(scatterStyle, values),
      data: points.map((point, index) => ({
        ...point,
        itemStyle: { color: colors[index % colors.length] },
      })),
      label: buildScatterDataLabel(config),
      emphasis: { scale: scatterStyle === 'bubble' ? 1.15 : 1.4 },
    },
  ]
  return option
}

function radarOption(parsed: ParsedChartData, config: ChartConfig): EChartsOption {
  const colors = resolveChartColors(config, parsed.series.length)
  const radarStyle = config.radarStyle
  const primaryColor = colors[0]

  const option = baseOption(config, colors)
  option.tooltip = { trigger: 'item' }
  option.radar = {
    indicator: parsed.categories.map((name) => ({
      name,
      max: Math.max(...parsed.series.flatMap((s) => s.data)) * 1.2 || 100,
    })),
    shape: buildRadarShape(radarStyle),
    splitArea: {
      areaStyle: {
        color: [alphaColor(primaryColor, 0.02), alphaColor(primaryColor, 0.06)],
      },
    },
    splitLine: { lineStyle: { color: alphaColor(primaryColor, 0.12) } },
    axisLine: { lineStyle: { color: alphaColor(primaryColor, 0.18) } },
    axisName: { color: '#64748b' },
  }
  option.series = [
    {
      type: 'radar',
      data: parsed.series.map((s, index) => {
        const color = colors[index % colors.length]
        return {
          name: s.name,
          value: s.data,
          label: buildRadarDataLabel(config),
          ...buildRadarSeriesStyle(radarStyle, color),
        }
      }),
    },
  ]
  return option
}

export function buildChartOption(parsed: ParsedChartData, config: ChartConfig): EChartsOption {
  switch (config.type) {
    case 'bar':
      return barOption(parsed, config)
    case 'line':
      return barLineAreaOption(parsed, config, 'line')
    case 'area':
      return barLineAreaOption(parsed, config, 'area')
    case 'combo':
      return comboOption(parsed, config)
    case 'pie':
      return pieOption(parsed, config, false)
    case 'donut':
      return pieOption(parsed, config, true)
    case 'scatter':
      return scatterOption(parsed, config)
    case 'radar':
      return radarOption(parsed, config)
    default:
      return barOption(parsed, config)
  }
}
