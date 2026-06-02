import type { ChartConfig, ChartType, ColorSchemeId } from '../types'
import { DEFAULT_TABLE, createTableState, type TableState } from '../types'

export const PROJECT_STORAGE_KEY = 'chartcraft-project-draft'
const STORAGE_VERSION = 1

export interface ProjectDraft {
  version: number
  tableState: TableState
  chartConfig: ChartConfig
  savedAt: number
}

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  type: 'bar',
  title: '销售数据分析',
  subtitle: '2024 年上半年',
  showLegend: true,
  legendItemGap: 20,
  showGrid: true,
  smooth: true,
  stacked: false,
  colorScheme: 'default',
  barStyle: 'rounded',
  lineStyle: 'solid',
  areaStyle: 'gradient',
  pieStyle: 'classic',
  scatterStyle: 'circle',
  radarStyle: 'circle',
}

const CHART_TYPES: ChartType[] = ['bar', 'line', 'pie', 'area', 'scatter', 'radar', 'donut']
const COLOR_SCHEMES: ColorSchemeId[] = [
  'default',
  'ocean',
  'sunset',
  'forest',
  'vivid',
  'pastel',
  'business',
  'mono',
]

function isTableState(value: unknown): value is TableState {
  if (!value || typeof value !== 'object') return false
  const state = value as TableState
  return Array.isArray(state.data) && state.data.every((row) => Array.isArray(row))
}

function sanitizeChartConfig(raw: unknown): ChartConfig {
  const config = (raw && typeof raw === 'object' ? raw : {}) as Partial<ChartConfig>
  return {
    ...DEFAULT_CHART_CONFIG,
    ...config,
    type: CHART_TYPES.includes(config.type as ChartType) ? (config.type as ChartType) : DEFAULT_CHART_CONFIG.type,
    colorScheme: COLOR_SCHEMES.includes(config.colorScheme as ColorSchemeId)
      ? (config.colorScheme as ColorSchemeId)
      : DEFAULT_CHART_CONFIG.colorScheme,
    title: typeof config.title === 'string' ? config.title : DEFAULT_CHART_CONFIG.title,
    subtitle: typeof config.subtitle === 'string' ? config.subtitle : DEFAULT_CHART_CONFIG.subtitle,
    showLegend: config.showLegend !== false,
    showGrid: config.showGrid !== false,
    smooth: config.smooth !== false,
    stacked: Boolean(config.stacked),
    legendItemGap:
      typeof config.legendItemGap === 'number' ? config.legendItemGap : DEFAULT_CHART_CONFIG.legendItemGap,
  }
}

export function createDefaultProjectDraft(): ProjectDraft {
  return {
    version: STORAGE_VERSION,
    tableState: createTableState(DEFAULT_TABLE.map((row) => [...row])),
    chartConfig: DEFAULT_CHART_CONFIG,
    savedAt: Date.now(),
  }
}

export function loadProjectDraft(): ProjectDraft | null {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<ProjectDraft>
    if (!isTableState(parsed.tableState)) return null

    return {
      version: STORAGE_VERSION,
      tableState: {
        data: parsed.tableState.data.map((row) => row.map((cell) => String(cell ?? ''))),
        meta: {
          alignments: parsed.tableState.meta?.alignments ?? {},
          cellStyles: parsed.tableState.meta?.cellStyles ?? {},
          merges: parsed.tableState.meta?.merges ?? [],
        },
      },
      chartConfig: sanitizeChartConfig(parsed.chartConfig),
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
    }
  } catch {
    return null
  }
}

export function saveProjectDraft(tableState: TableState, chartConfig: ChartConfig): void {
  try {
    const draft: ProjectDraft = {
      version: STORAGE_VERSION,
      tableState,
      chartConfig,
      savedAt: Date.now(),
    }
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(draft))
  } catch {
    /* ignore quota errors */
  }
}
