import { useMemo, useState } from 'react'
import type { ECharts } from 'echarts'
import type { EChartsOption } from 'echarts'
import {
  ClipboardCopy,
  Download,
  FileText,
  MonitorPlay,
  Newspaper,
  Printer,
} from 'lucide-react'
import {
  EXPORT_SCENARIOS,
  getExportScenario,
  type ExportScenarioId,
} from '../data/exportScenarios'
import {
  copyChartPngToClipboard,
  saveChartPng,
  saveScenarioChartPdf,
  type ChartExportBackground,
} from '../utils/chartExport'

interface ChartReportExportProps {
  option: EChartsOption
  baseName: string
  getChartInstance: () => ECharts | undefined
}

type ExportAction = 'png' | 'clipboard' | 'pdf'

const SCENARIO_ICONS: Record<ExportScenarioId, typeof MonitorPlay> = {
  ppt: MonitorPlay,
  wechat: Newspaper,
  a4: Printer,
}

export default function ChartReportExport({
  option,
  baseName,
  getChartInstance,
}: ChartReportExportProps) {
  const [scenarioId, setScenarioId] = useState<ExportScenarioId>('ppt')
  const [background, setBackground] = useState<ChartExportBackground>('white')
  const [busyAction, setBusyAction] = useState<ExportAction | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [messageIsError, setMessageIsError] = useState(false)

  const scenario = useMemo(() => getExportScenario(scenarioId), [scenarioId])

  const runExport = async (action: ExportAction) => {
    if (busyAction) return

    const instance = getChartInstance()
    if (!instance) {
      setMessageIsError(true)
      setMessage('图表尚未加载完成，请稍后再试')
      return
    }

    setBusyAction(action)
    setMessage(null)
    setMessageIsError(false)

    try {
      const filenameBase = `${baseName}-${scenario.filenameSuffix}`

      if (action === 'png') {
        await saveChartPng(option, scenario, `${filenameBase}.png`, background, instance)
        setMessage(`已导出 ${scenario.name} PNG（与预览一致）`)
        return
      }

      if (action === 'clipboard') {
        await copyChartPngToClipboard(option, scenario, background, instance)
        setMessage('已复制，在 PPT 中 Ctrl+V 粘贴（样式与预览一致）')
        return
      }

      await saveScenarioChartPdf(option, scenario, `${filenameBase}.pdf`, instance)
      setMessage(`已导出 ${scenario.name} PDF（与预览一致）`)
    } catch (err) {
      setMessageIsError(true)
      setMessage(err instanceof Error ? err.message : '导出失败')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <section className="chart-report-export">
      <div className="chart-report-export-header">
        <div>
          <h3>报告级导出</h3>
          <p>直接截取下方预览图表，样式与所见完全一致，仅按场景提高清晰度</p>
        </div>
      </div>

      <div className="report-scenario-grid">
        {EXPORT_SCENARIOS.map((item) => {
          const Icon = SCENARIO_ICONS[item.id]
          const active = item.id === scenarioId
          return (
            <button
              key={item.id}
              type="button"
              className={`report-scenario-card ${active ? 'active' : ''}`}
              onClick={() => setScenarioId(item.id)}
            >
              <span className="report-scenario-icon">
                <Icon size={18} />
              </span>
              <span className="report-scenario-name">{item.name}</span>
              <span className="report-scenario-ratio">{item.subtitle}</span>
              <span className="report-scenario-desc">{item.description}</span>
            </button>
          )
        })}
      </div>

      <div className="report-export-options">
        <span className="report-export-options-label">背景</span>
        <div className="report-bg-toggle" role="radiogroup" aria-label="导出背景">
          <label className={`report-bg-option ${background === 'white' ? 'active' : ''}`}>
            <input
              type="radio"
              name="export-bg"
              checked={background === 'white'}
              onChange={() => setBackground('white')}
            />
            白底
          </label>
          <label className={`report-bg-option ${background === 'transparent' ? 'active' : ''}`}>
            <input
              type="radio"
              name="export-bg"
              checked={background === 'transparent'}
              onChange={() => setBackground('transparent')}
            />
            透明底
          </label>
        </div>
        <span className="report-export-hint">
          导出内容与预览一致；PPT 复制按幻灯片尺寸插入；PDF 固定白底
        </span>
      </div>

      <div className="report-export-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busyAction !== null}
          onClick={() => runExport('png')}
        >
          <Download size={16} />
          {busyAction === 'png' ? '导出中…' : `下载 PNG（${scenario.width}px 宽）`}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busyAction !== null}
          onClick={() => runExport('clipboard')}
        >
          <ClipboardCopy size={16} />
          {busyAction === 'clipboard' ? '复制中…' : '复制到剪贴板'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busyAction !== null}
          onClick={() => runExport('pdf')}
        >
          <FileText size={16} />
          {busyAction === 'pdf' ? '导出中…' : scenario.useA4Pdf ? '下载 A4 PDF' : '下载 PDF'}
        </button>
      </div>

      {message ? (
        <p className={`report-export-message ${messageIsError ? 'error' : 'success'}`}>{message}</p>
      ) : null}
    </section>
  )
}
