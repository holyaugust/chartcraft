import type { ChartConfig, ChartType, ColorSchemeId } from '../types'
import type { TableState } from '../types'
import {
  createDefaultWorkbook,
  createWorkbookFromTableState,
  type WorkbookState,
} from '../types/workbook'

export const PROJECT_STORAGE_KEY = 'chartcraft-project-draft'
const STORAGE_VERSION = 2

export interface ProjectDraft {
  version: number
  workbook: WorkbookState
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
  showDataLabels: false,
  xAxisTitle: '',
  yAxisTitle: '',
  yAxis2Title: '',
  dualAxis: false,
  colorScheme: 'default',
  barStyle: 'rounded',
  lineStyle: 'solid',
  areaStyle: 'gradient',
  pieStyle: 'classic',
  scatterStyle: 'circle',
  radarStyle: 'circle',
}

const CHART_TYPES: ChartType[] = ['bar', 'line', 'pie', 'area', 'scatter', 'radar', 'donut', 'combo']
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

function sanitizeTableState(raw: TableState): TableState {
  return {
    data: raw.data.map((row) => row.map((cell) => String(cell ?? ''))),
    meta: {
      alignments: raw.meta?.alignments ?? {},
      cellStyles: raw.meta?.cellStyles ?? {},
      merges: raw.meta?.merges ?? [],
    },
  }
}

function isWorkbookState(value: unknown): value is WorkbookState {
  if (!value || typeof value !== 'object') return false
  const workbook = value as WorkbookState
  if (!Array.isArray(workbook.sheets) || workbook.sheets.length === 0) return false
  if (typeof workbook.activeSheetId !== 'string') return false
  return workbook.sheets.every(
    (sheet) =>
      typeof sheet.id === 'string' &&
      typeof sheet.name === 'string' &&
      isTableState(sheet.state),
  )
}

function sanitizeWorkbook(raw: WorkbookState): WorkbookState {
  const sheets = raw.sheets.map((sheet) => ({
    id: sheet.id,
    name: sheet.name,
    state: sanitizeTableState(sheet.state),
  }))
  const activeSheetId = sheets.some((sheet) => sheet.id === raw.activeSheetId)
    ? raw.activeSheetId
    : sheets[0].id
  return { sheets, activeSheetId }
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
    showDataLabels: Boolean(config.showDataLabels),
    xAxisTitle: typeof config.xAxisTitle === 'string' ? config.xAxisTitle : '',
    yAxisTitle: typeof config.yAxisTitle === 'string' ? config.yAxisTitle : '',
    yAxis2Title: typeof config.yAxis2Title === 'string' ? config.yAxis2Title : '',
    dualAxis: Boolean(config.dualAxis),
    legendItemGap:
      typeof config.legendItemGap === 'number' ? config.legendItemGap : DEFAULT_CHART_CONFIG.legendItemGap,
  }
}

export function createDefaultProjectDraft(): ProjectDraft {
  return {
    version: STORAGE_VERSION,
    workbook: createDefaultWorkbook(),
    chartConfig: DEFAULT_CHART_CONFIG,
    savedAt: Date.now(),
  }
}

export function loadProjectDraft(): ProjectDraft | null {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<ProjectDraft> & { tableState?: TableState }

    if (isWorkbookState(parsed.workbook)) {
      return {
        version: STORAGE_VERSION,
        workbook: sanitizeWorkbook(parsed.workbook),
        chartConfig: sanitizeChartConfig(parsed.chartConfig),
        savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
      }
    }

    if (isTableState(parsed.tableState)) {
      return {
        version: STORAGE_VERSION,
        workbook: createWorkbookFromTableState(sanitizeTableState(parsed.tableState)),
        chartConfig: sanitizeChartConfig(parsed.chartConfig),
        savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
      }
    }

    return null
  } catch {
    return null
  }
}

export function saveProjectDraft(workbook: WorkbookState, chartConfig: ChartConfig): void {
  try {
    const draft: ProjectDraft = {
      version: STORAGE_VERSION,
      workbook,
      chartConfig,
      savedAt: Date.now(),
    }
    localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(draft))
  } catch {
    /* ignore quota errors */
  }
}
