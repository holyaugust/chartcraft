import type {
  AreaStyleId,
  BarStyleId,
  ChartConfig,
  ChartType,
  LineStyleId,
  PieStyleId,
  RadarStyleId,
  ScatterStyleId,
  TableData,
  TableState,
} from '../types'
import { CHART_TYPE_LABELS, createTableState } from '../types'
import { BAR_STYLE_LABELS } from './colorSchemes'
import {
  AREA_STYLE_LABELS,
  LINE_STYLE_LABELS,
  PIE_STYLE_LABELS,
  RADAR_STYLE_LABELS,
  SCATTER_STYLE_LABELS,
} from './chartStyles'
import { requestDeepSeekPlainText } from './deepseek'
import { getComputedTable } from './formulaEngine'
import { validateTableData } from './parseData'
import { sanitizeChartConfig } from './projectStorage'

export type TableOperation =
  | { type: 'setCell'; row: number; col: number; value: string }
  | { type: 'insertRow'; afterRow: number; values: string[] }
  | { type: 'deleteRow'; row: number }
  | { type: 'appendRows'; rows: string[][] }
  | { type: 'sortRows'; column: number; order: 'asc' | 'desc' }
  | { type: 'addColumn'; header: string; values?: string[] }
  | { type: 'deleteColumn'; col: number }
  | { type: 'renameHeader'; col: number; name: string }

export interface ChartAiCommandPayload {
  tableData?: string[][]
  tableOperations?: TableOperation[]
  chartConfig?: Partial<ChartConfig>
  message: string
}

export interface ChartAiApplyResult {
  tableState: TableState
  chartConfig: ChartConfig
  message: string
  appliedTable: boolean
  appliedChart: boolean
}

const CHART_TYPES = Object.keys(CHART_TYPE_LABELS) as ChartType[]
const COLOR_SCHEMES = ['default', 'ocean', 'sunset', 'forest', 'vivid', 'pastel', 'business', 'mono'] as const
const BAR_STYLES = Object.keys(BAR_STYLE_LABELS) as BarStyleId[]
const LINE_STYLES = Object.keys(LINE_STYLE_LABELS) as LineStyleId[]
const AREA_STYLES = Object.keys(AREA_STYLE_LABELS) as AreaStyleId[]
const PIE_STYLES = Object.keys(PIE_STYLE_LABELS) as PieStyleId[]
const SCATTER_STYLES = Object.keys(SCATTER_STYLE_LABELS) as ScatterStyleId[]
const RADAR_STYLES = Object.keys(RADAR_STYLE_LABELS) as RadarStyleId[]

function buildSystemPrompt(): string {
  return `你是 ChartCraft 图表编辑助手。用户会用自然语言描述对左侧数据表和右侧图表的调整需求。
你必须只输出一个 JSON 对象（不要 markdown 代码块），结构如下：

{
  "message": "一句话说明已完成的调整",
  "tableData": 可选，完整二维字符串数组，用于整体替换表格（含表头行）,
  "tableOperations": 可选，增量操作数组，与 tableData 二选一或都不填,
  "chartConfig": 可选，只需包含要修改的图表配置字段
}

tableOperations 支持：
- setCell: { "type":"setCell", "row":0, "col":1, "value":"新值" } （row/col 从 0 起，0 行为表头）
- insertRow: { "type":"insertRow", "afterRow":3, "values":["4月","9500","2800"] }
- deleteRow: { "type":"deleteRow", "row":5 }
- appendRows: { "type":"appendRows", "rows":[["7月","14000","4500"]] }
- sortRows: { "type":"sortRows", "column":1, "order":"desc" } （只排序数据行，不动表头）
- addColumn: { "type":"addColumn", "header":"同比", "values":["10%","12%"] }
- deleteColumn: { "type":"deleteColumn", "col":3 }
- renameHeader: { "type":"renameHeader", "col":1, "name":"营收" }

数据表规则：
- 第一列为分类（文本），其余列为数值系列
- 至少 2 行（含表头）且至少 2 列
- 数值列请用纯数字字符串，百分比可写 "15%" 或 0.15
- 小范围改动优先用 tableOperations；大范围重构或生成新数据集用 tableData

chartConfig 可选字段及取值：
- type: ${CHART_TYPES.join(' | ')}
- title, subtitle, xAxisTitle, yAxisTitle, yAxis2Title: 字符串
- showLegend, showGrid, smooth, stacked, showDataLabels, dualAxis: 布尔
- legendItemGap: 数字（像素）
- colorScheme: ${COLOR_SCHEMES.join(' | ')}
- barStyle: ${BAR_STYLES.join(' | ')}
- lineStyle: ${LINE_STYLES.join(' | ')}
- areaStyle: ${AREA_STYLES.join(' | ')}
- pieStyle: ${PIE_STYLES.join(' | ')}
- scatterStyle: ${SCATTER_STYLES.join(' | ')}
- radarStyle: ${RADAR_STYLES.join(' | ')}

注意：
- 只修改用户要求的部分，未提及的字段不要出现在 chartConfig 中
- 改图表类型时确保现有数据仍合理（饼图/环形图通常单系列更直观）
- 若用户只改样式/标题，不要动 tableData
- message 用中文，简洁说明做了什么`
}

function tableToTsv(data: TableData): string {
  return data.map((row) => row.join('\t')).join('\n')
}

function buildUserPrompt(prompt: string, tableState: TableState, chartConfig: ChartConfig): string {
  const computed = getComputedTable(tableState.data)
  const hasFormula = tableState.data.some((row) =>
    row.some((cell) => cell.trimStart().startsWith('=')),
  )

  const parts = [
    `用户指令：${prompt.trim()}`,
    '',
    '当前图表配置（JSON）：',
    JSON.stringify(chartConfig, null, 2),
    '',
    hasFormula
      ? '当前表格（公式已求值，供理解数据；写回时请输出最终值或新公式）：'
      : '当前表格（TSV，首行表头）：',
    tableToTsv(hasFormula ? computed : tableState.data),
  ]

  return parts.join('\n')
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim()
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch?.[1]) return fenceMatch[1].trim()

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1)
  }

  return trimmed
}

function normalizeTableData(raw: unknown): TableData | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const rows = raw.map((row) => {
    if (!Array.isArray(row)) return []
    return row.map((cell) => String(cell ?? ''))
  })
  const width = Math.max(...rows.map((row) => row.length), 0)
  if (width === 0) return null
  return rows.map((row) => {
    const next = [...row]
    while (next.length < width) next.push('')
    return next
  })
}

function parseNumberForSort(value: string): number {
  const trimmed = value.trim()
  if (!trimmed) return NaN
  if (trimmed.endsWith('%')) {
    const n = Number.parseFloat(trimmed.slice(0, -1))
    return Number.isFinite(n) ? n : NaN
  }
  const n = Number.parseFloat(trimmed.replace(/,/g, ''))
  return Number.isFinite(n) ? n : NaN
}

function compareCellValues(a: string, b: string, order: 'asc' | 'desc'): number {
  const na = parseNumberForSort(a)
  const nb = parseNumberForSort(b)
  let cmp: number
  if (Number.isFinite(na) && Number.isFinite(nb)) {
    cmp = na - nb
  } else {
    cmp = a.localeCompare(b, 'zh-CN')
  }
  return order === 'asc' ? cmp : -cmp
}

function normalizeTableOperation(raw: unknown): TableOperation | null {
  if (!raw || typeof raw !== 'object') return null
  const op = raw as Record<string, unknown>
  const type = op.type

  switch (type) {
    case 'setCell':
      if (typeof op.row !== 'number' || typeof op.col !== 'number') return null
      return { type, row: op.row, col: op.col, value: String(op.value ?? '') }
    case 'insertRow':
      if (typeof op.afterRow !== 'number' || !Array.isArray(op.values)) return null
      return { type, afterRow: op.afterRow, values: op.values.map((v) => String(v ?? '')) }
    case 'deleteRow':
      if (typeof op.row !== 'number') return null
      return { type, row: op.row }
    case 'appendRows':
      if (!Array.isArray(op.rows)) return null
      return {
        type,
        rows: op.rows.map((row) =>
          Array.isArray(row) ? row.map((cell) => String(cell ?? '')) : [],
        ),
      }
    case 'sortRows':
      if (typeof op.column !== 'number') return null
      return {
        type,
        column: op.column,
        order: op.order === 'desc' ? 'desc' : 'asc',
      }
    case 'addColumn':
      if (typeof op.header !== 'string') return null
      return {
        type,
        header: op.header,
        values: Array.isArray(op.values) ? op.values.map((v) => String(v ?? '')) : undefined,
      }
    case 'deleteColumn':
      if (typeof op.col !== 'number') return null
      return { type, col: op.col }
    case 'renameHeader':
      if (typeof op.col !== 'number' || typeof op.name !== 'string') return null
      return { type, col: op.col, name: op.name }
    default:
      return null
  }
}

export function parseChartAiCommand(raw: string): ChartAiCommandPayload {
  const jsonText = extractJsonObject(raw)
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(jsonText) as Record<string, unknown>
  } catch {
    throw new Error('AI 返回的不是有效 JSON')
  }

  const message = typeof parsed.message === 'string' ? parsed.message.trim() : ''
  if (!message) {
    throw new Error('AI 未返回说明信息')
  }

  const tableData = parsed.tableData !== undefined ? normalizeTableData(parsed.tableData) : undefined
  if (parsed.tableData !== undefined && !tableData) {
    throw new Error('AI 返回的 tableData 格式无效')
  }

  const tableOperations = Array.isArray(parsed.tableOperations)
    ? parsed.tableOperations
        .map((item) => normalizeTableOperation(item))
        .filter((item): item is TableOperation => item !== null)
    : undefined

  const chartConfig =
    parsed.chartConfig && typeof parsed.chartConfig === 'object'
      ? (parsed.chartConfig as Partial<ChartConfig>)
      : undefined

  if (!tableData && (!tableOperations || tableOperations.length === 0) && !chartConfig) {
    throw new Error('AI 未返回可执行的表格或图表修改')
  }

  return { tableData: tableData ?? undefined, tableOperations, chartConfig, message }
}

function applyTableOperations(data: TableData, operations: TableOperation[]): TableData {
  let result = data.map((row) => [...row])

  for (const op of operations) {
    switch (op.type) {
      case 'setCell': {
        while (result.length <= op.row) result.push([])
        while (result[op.row].length <= op.col) result[op.row].push('')
        result[op.row][op.col] = op.value
        break
      }
      case 'insertRow': {
        const insertAt = Math.min(Math.max(op.afterRow + 1, 0), result.length)
        const width = result[0]?.length ?? op.values.length
        const values = [...op.values]
        while (values.length < width) values.push('')
        result.splice(insertAt, 0, values.slice(0, width))
        break
      }
      case 'deleteRow': {
        if (op.row > 0 && op.row < result.length) {
          result.splice(op.row, 1)
        }
        break
      }
      case 'appendRows': {
        const width = result[0]?.length ?? Math.max(...op.rows.map((row) => row.length), 0)
        for (const row of op.rows) {
          const values = [...row]
          while (values.length < width) values.push('')
          result.push(values.slice(0, width))
        }
        break
      }
      case 'sortRows': {
        if (result.length < 2) break
        const header = result[0]
        const body = result.slice(1)
        body.sort((a, b) =>
          compareCellValues(a[op.column] ?? '', b[op.column] ?? '', op.order),
        )
        result = [header, ...body]
        break
      }
      case 'addColumn': {
        if (result.length === 0) {
          result = [[op.header]]
          break
        }
        result.forEach((row, rowIndex) => {
          if (rowIndex === 0) {
            row.push(op.header)
          } else {
            row.push(op.values?.[rowIndex - 1] ?? '')
          }
        })
        break
      }
      case 'deleteColumn': {
        if (op.col >= 0 && result[0] && op.col < result[0].length && result[0].length > 2) {
          result = result.map((row) => row.filter((_, index) => index !== op.col))
        }
        break
      }
      case 'renameHeader': {
        if (result[0] && op.col >= 0 && op.col < result[0].length) {
          result[0][op.col] = op.name
        }
        break
      }
    }
  }

  return result
}

function resolveTableData(current: TableData, payload: ChartAiCommandPayload): TableData | null {
  if (payload.tableData) return payload.tableData
  if (payload.tableOperations?.length) {
    return applyTableOperations(current, payload.tableOperations)
  }
  return null
}

export function applyChartAiCommand(
  payload: ChartAiCommandPayload,
  tableState: TableState,
  chartConfig: ChartConfig,
): ChartAiApplyResult {
  let nextTableState = tableState
  let appliedTable = false

  const nextData = resolveTableData(tableState.data, payload)
  if (nextData) {
    const error = validateTableData(nextData)
    if (error) {
      throw new Error(`表格修改无效：${error}`)
    }
    nextTableState = createTableState(nextData)
    appliedTable = true
  }

  let nextChartConfig = chartConfig
  let appliedChart = false
  if (payload.chartConfig && Object.keys(payload.chartConfig).length > 0) {
    nextChartConfig = sanitizeChartConfig({ ...chartConfig, ...payload.chartConfig })
    appliedChart = true
  }

  if (!appliedTable && !appliedChart) {
    throw new Error('没有可应用的修改')
  }

  return {
    tableState: nextTableState,
    chartConfig: nextChartConfig,
    message: payload.message,
    appliedTable,
    appliedChart,
  }
}

export async function runChartAiCommand(input: {
  prompt: string
  tableState: TableState
  chartConfig: ChartConfig
}): Promise<ChartAiApplyResult> {
  const raw = await requestDeepSeekPlainText({
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(input.prompt, input.tableState, input.chartConfig),
    temperature: 0.35,
    maxTokens: 8192,
  })

  const payload = parseChartAiCommand(raw)
  return applyChartAiCommand(payload, input.tableState, input.chartConfig)
}

export const CHART_AI_EXAMPLES = [
  '改成折线图，配色用海洋蓝，标题改为「季度趋势」',
  '删除 3 月那一行，按销售额降序排列',
  '增加一列「目标值」，数值比销售额高 10%',
  '换成饼图，显示数据标签，副标题改为 2024 全年',
  '柱状图改成堆叠，圆角样式，隐藏网格线',
] as const
