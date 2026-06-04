import { useRef, useMemo, useCallback, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Maximize2, X, FileImage, FileType2, FileText } from 'lucide-react'
import type { ECharts } from 'echarts'
import type { ChartConfig, ParsedChartData } from '../types'
import { buildChartOption } from '../utils/chartOptions'
import {
  captureLiveChartPng,
  dataUrlToBlob,
  saveChartPdfFromPng,
  saveChartSvg,
} from '../utils/chartExport'
import { saveFile } from '../utils/saveFile'
import ChartReportExport from './ChartReportExport'

interface ChartPreviewProps {
  parsed: ParsedChartData
  config: ChartConfig
}

type ExportKind = 'png' | 'svg' | 'pdf'

export default function ChartPreview({ parsed, config }: ChartPreviewProps) {
  const chartRef = useRef<ReactECharts>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [exporting, setExporting] = useState<ExportKind | null>(null)

  const option = useMemo(() => buildChartOption(parsed, config), [parsed, config])
  const baseName = (config.title || 'chart').replace(/[\\/:*?"<>|]/g, '_')

  const getInstance = useCallback((): ECharts | undefined => {
    return chartRef.current?.getEchartsInstance()
  }, [])

  const getChartSize = useCallback(() => {
    const instance = getInstance()
    const width = instance?.getWidth() ?? 960
    const height = instance?.getHeight() ?? 480
    return { width, height }
  }, [getInstance])

  const exportChart = async (kind: ExportKind) => {
    const instance = getInstance()
    if (!instance || exporting) return

    setExporting(kind)
    try {
      const { width, height } = getChartSize()

      if (kind === 'svg') {
        await saveChartSvg(option, width, height, `${baseName}.svg`)
        return
      }

      const { dataUrl, width: outW, height: outH } = captureLiveChartPng(instance, 'white', width * 3)

      if (kind === 'png') {
        const blob = dataUrlToBlob(dataUrl)
        await saveFile(blob, {
          suggestedName: `${baseName}.png`,
          description: 'PNG 图片',
          accept: { 'image/png': ['.png'] },
        })
        return
      }

      await saveChartPdfFromPng(dataUrl, outW, outH, `${baseName}.pdf`)
    } catch (err) {
      console.error(err)
      window.alert(err instanceof Error ? err.message : '导出图表失败')
    } finally {
      setExporting(null)
    }
  }

  const chartElement = (
    <ReactECharts
      ref={chartRef}
      option={option}
      style={{ height: '100%', width: '100%' }}
      opts={{ renderer: 'canvas' }}
      notMerge
      lazyUpdate
    />
  )

  return (
    <div className="chart-preview">
      <div className="chart-container">{chartElement}</div>

      <ChartReportExport option={option} baseName={baseName} getChartInstance={getInstance} />

      <div className="chart-quick-export">
        <span className="chart-quick-export-label">快速导出（与预览完全一致）</span>
        <div className="chart-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => exportChart('png')}
            disabled={exporting !== null}
          >
            <FileImage size={16} />
            {exporting === 'png' ? '导出中…' : 'PNG'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => exportChart('svg')}
            disabled={exporting !== null}
          >
            <FileType2 size={16} />
            {exporting === 'svg' ? '导出中…' : 'SVG'}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => exportChart('pdf')}
            disabled={exporting !== null}
          >
            <FileText size={16} />
            {exporting === 'pdf' ? '导出中…' : 'PDF'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFullscreen(true)}>
            <Maximize2 size={16} />
            全屏预览
          </button>
        </div>
      </div>

      {fullscreen && (
        <div className="fullscreen-overlay" onClick={() => setFullscreen(false)}>
          <div className="fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="fullscreen-close"
              onClick={() => setFullscreen(false)}
              aria-label="关闭"
            >
              <X size={20} />
            </button>
            <ReactECharts
              option={option}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'canvas' }}
              notMerge
            />
          </div>
        </div>
      )}
    </div>
  )
}
