import type { ChartConfig } from '../types'
import { contrastLabelColor } from './colorSchemes'

const LABEL_LAYOUT = {
  hideOverlap: true,
  moveOverlap: 'shiftY' as const,
}

export function buildBarDataLabel(config: ChartConfig, seriesColor: string) {
  if (!config.showDataLabels) return { show: false as const }

  const onDark = contrastLabelColor(seriesColor) === '#ffffff'

  return {
    show: true,
    position: 'insideTop' as const,
    distance: 8,
    color: contrastLabelColor(seriesColor),
    fontSize: 11,
    fontWeight: 600 as const,
    textBorderColor: onDark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.9)',
    textBorderWidth: 1,
    labelLayout: LABEL_LAYOUT,
  }
}

export function buildLineDataLabel(config: ChartConfig, seriesColor: string, lineIndex: number) {
  if (!config.showDataLabels) return { show: false as const }

  return {
    show: true,
    position: 'top' as const,
    distance: 10 + lineIndex * 14,
    color: seriesColor,
    fontSize: 11,
    fontWeight: 600 as const,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: 'rgba(226,232,240,0.9)',
    borderWidth: 1,
    borderRadius: 4,
    padding: [2, 5] as [number, number],
    labelLayout: LABEL_LAYOUT,
  }
}

export function buildAreaDataLabel(config: ChartConfig, seriesColor: string, seriesIndex: number) {
  return buildLineDataLabel(config, seriesColor, seriesIndex)
}

export function buildDefaultDataLabel(config: ChartConfig, seriesColor: string, seriesIndex = 0) {
  if (!config.showDataLabels) return { show: false as const }

  return {
    show: true,
    position: 'top' as const,
    distance: 8 + seriesIndex * 10,
    color: seriesColor,
    fontSize: 11,
    fontWeight: 600 as const,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 3,
    padding: [1, 4] as [number, number],
    labelLayout: LABEL_LAYOUT,
  }
}

export function buildScatterDataLabel(config: ChartConfig) {
  if (!config.showDataLabels) return { show: false as const }

  return {
    show: true,
    position: 'top' as const,
    distance: 6,
    formatter: '{b}',
    color: '#475569',
    fontSize: 10,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderRadius: 3,
    padding: [1, 4] as [number, number],
    labelLayout: LABEL_LAYOUT,
  }
}

export function buildRadarDataLabel(config: ChartConfig) {
  if (!config.showDataLabels) return { show: false as const }

  return {
    show: true,
    color: '#64748b',
    fontSize: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 2,
    padding: [1, 3] as [number, number],
    labelLayout: LABEL_LAYOUT,
  }
}
