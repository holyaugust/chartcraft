import { buildChartOption } from './chartOptions'
import { renderChartToPngDataUrl } from './chartExport'
import { parseTableData } from './parseData'
import { getActiveTableState } from '../types/workbook'
import { loadProjectDraft } from './projectStorage'

/** 从图表工作区草稿离屏渲染 PNG，供汇报幻灯片嵌入 */
export async function renderProjectChartDataUrl(): Promise<string | null> {
  const draft = loadProjectDraft()
  if (!draft) return null

  const tableState = getActiveTableState(draft.workbook)
  const parsed = parseTableData(tableState.data)
  if (!parsed) return null

  const option = buildChartOption(parsed, draft.chartConfig)
  return renderChartToPngDataUrl(option, {
    width: 1280,
    height: 720,
    pixelRatio: 2,
    background: 'white',
  })
}

export function getProjectChartTitle(): string {
  const draft = loadProjectDraft()
  return draft?.chartConfig.title?.trim() || '数据分析图表'
}
