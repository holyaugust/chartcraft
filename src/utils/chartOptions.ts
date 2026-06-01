import type { EChartsOption } from 'echarts'
import type { ChartConfig, ParsedChartData } from '../types'

const COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
]

function baseOption(config: ChartConfig): EChartsOption {
  return {
    backgroundColor: 'transparent',
    color: COLORS,
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

function barLineAreaOption(
  parsed: ParsedChartData,
  config: ChartConfig,
  chartType: 'bar' | 'line' | 'area',
): EChartsOption {
  const option = baseOption(config)
  option.xAxis = {
    type: 'category',
    data: parsed.categories,
    axisLine: { lineStyle: { color: '#cbd5e1' } },
    axisLabel: { color: '#64748b' },
  }
  option.yAxis = {
    type: 'value',
    splitLine: { show: config.showGrid, lineStyle: { color: '#f1f5f9', type: 'dashed' } },
    axisLabel: { color: '#64748b' },
  }
  option.series = parsed.series.map((s) => ({
    name: s.name,
    type: chartType === 'area' ? 'line' : chartType,
    data: s.data,
    smooth: config.smooth,
    stack: config.stacked ? 'total' : undefined,
    areaStyle: chartType === 'area' ? { opacity: 0.25 } : undefined,
    emphasis: { focus: 'series' },
    itemStyle: { borderRadius: chartType === 'bar' ? [6, 6, 0, 0] : undefined },
  }))
  return option
}

function pieOption(parsed: ParsedChartData, config: ChartConfig, donut = false): EChartsOption {
  const option = baseOption(config)
  option.tooltip = { trigger: 'item', formatter: '{b}: {c} ({d}%)' }
  option.legend = {
    show: config.showLegend,
    orient: 'vertical',
    right: 16,
    top: 'center',
    textStyle: { color: '#64748b' },
  }

  const seriesData = parsed.categories.map((name, i) => ({
    name,
    value: parsed.series[0]?.data[i] ?? 0,
  }))

  option.series = [
    {
      type: 'pie',
      radius: donut ? ['42%', '68%'] : ['0%', '68%'],
      center: ['42%', '55%'],
      data: seriesData,
      emphasis: {
        itemStyle: { shadowBlur: 12, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.15)' },
      },
      label: { color: '#475569', formatter: '{b}\n{d}%' },
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
    },
  ]
  return option
}

function scatterOption(parsed: ParsedChartData, config: ChartConfig): EChartsOption {
  const option = baseOption(config)
  option.tooltip = {
    trigger: 'item',
    formatter: (params: unknown) => {
      const p = params as { name: string; value: [number, number] }
      return `${p.name}<br/>X: ${p.value[0]}<br/>Y: ${p.value[1]}`
    },
  }
  option.xAxis = {
    type: 'value',
    name: parsed.series[0]?.name,
    splitLine: { show: config.showGrid, lineStyle: { color: '#f1f5f9', type: 'dashed' } },
    axisLabel: { color: '#64748b' },
  }
  option.yAxis = {
    type: 'value',
    name: parsed.series[1]?.name ?? parsed.series[0]?.name,
    splitLine: { show: config.showGrid, lineStyle: { color: '#f1f5f9', type: 'dashed' } },
    axisLabel: { color: '#64748b' },
  }
  option.series = [
    {
      type: 'scatter',
      symbolSize: 14,
      data: parsed.scatterPoints?.map((p) => ({ name: p.name, value: p.value })) ?? [],
      emphasis: { scale: 1.4 },
    },
  ]
  return option
}

function radarOption(parsed: ParsedChartData, config: ChartConfig): EChartsOption {
  const option = baseOption(config)
  option.tooltip = { trigger: 'item' }
  option.radar = {
    indicator: parsed.categories.map((name) => ({
      name,
      max: Math.max(...parsed.series.flatMap((s) => s.data)) * 1.2 || 100,
    })),
    shape: 'circle',
    splitArea: { areaStyle: { color: ['rgba(99,102,241,0.02)', 'rgba(99,102,241,0.06)'] } },
    axisName: { color: '#64748b' },
  }
  option.series = [
    {
      type: 'radar',
      data: parsed.series.map((s) => ({ name: s.name, value: s.data })),
      areaStyle: { opacity: 0.15 },
    },
  ]
  return option
}

export function buildChartOption(parsed: ParsedChartData, config: ChartConfig): EChartsOption {
  switch (config.type) {
    case 'bar':
      return barLineAreaOption(parsed, config, 'bar')
    case 'line':
      return barLineAreaOption(parsed, config, 'line')
    case 'area':
      return barLineAreaOption(parsed, config, 'area')
    case 'pie':
      return pieOption(parsed, config, false)
    case 'donut':
      return pieOption(parsed, config, true)
    case 'scatter':
      return scatterOption(parsed, config)
    case 'radar':
      return radarOption(parsed, config)
    default:
      return barLineAreaOption(parsed, config, 'bar')
  }
}
