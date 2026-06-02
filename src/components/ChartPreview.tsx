import { useRef, useMemo, useCallback, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Download, Maximize2, X } from 'lucide-react'
import type { ECharts } from 'echarts'
import type { ChartConfig, ParsedChartData } from '../types'
import { buildChartOption } from '../utils/chartOptions'
import { saveFile } from '../utils/saveFile'

interface ChartPreviewProps {
  parsed: ParsedChartData
  config: ChartConfig
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mime })
}

export default function ChartPreview({ parsed, config }: ChartPreviewProps) {
  const chartRef = useRef<ReactECharts>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [exporting, setExporting] = useState(false)

  const option = useMemo(() => buildChartOption(parsed, config), [parsed, config])

  const getInstance = useCallback((): ECharts | undefined => {
    return chartRef.current?.getEchartsInstance()
  }, [])

  const downloadImage = async () => {
    const instance = getInstance()
    if (!instance || exporting) return

    setExporting(true)
    try {
      const dataUrl = instance.getDataURL({
        type: 'png',
        pixelRatio: 3,
        backgroundColor: '#ffffff',
      })

      const blob = dataUrlToBlob(dataUrl)
      await saveFile(blob, {
        suggestedName: `${config.title || 'chart'}.png`,
        description: 'PNG 图片',
        accept: { 'image/png': ['.png'] },
      })
    } catch (err) {
      console.error(err)
      window.alert(err instanceof Error ? err.message : '导出图表图片失败')
    } finally {
      setExporting(false)
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
      <div className="chart-actions">
        <button type="button" className="btn btn-primary" onClick={downloadImage} disabled={exporting}>
          <Download size={16} />
          {exporting ? '导出中…' : '下载 PNG 图片'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setFullscreen(true)}>
          <Maximize2 size={16} />
          全屏预览
        </button>
      </div>

      <div className="chart-container">{chartElement}</div>

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
