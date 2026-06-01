import { useRef, useMemo, useCallback, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Download, Maximize2, X } from 'lucide-react'
import type { ECharts } from 'echarts'
import type { ChartConfig, ParsedChartData } from '../types'
import { buildChartOption } from '../utils/chartOptions'

interface ChartPreviewProps {
  parsed: ParsedChartData
  config: ChartConfig
}

export default function ChartPreview({ parsed, config }: ChartPreviewProps) {
  const chartRef = useRef<ReactECharts>(null)
  const [fullscreen, setFullscreen] = useState(false)

  const option = useMemo(() => buildChartOption(parsed, config), [parsed, config])

  const getInstance = useCallback((): ECharts | undefined => {
    return chartRef.current?.getEchartsInstance()
  }, [])

  const downloadImage = () => {
    const instance = getInstance()
    if (!instance) return

    const url = instance.getDataURL({
      type: 'png',
      pixelRatio: 3,
      backgroundColor: '#ffffff',
    })

    const link = document.createElement('a')
    link.download = `${config.title || 'chart'}.png`
    link.href = url
    link.click()
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
        <button type="button" className="btn btn-primary" onClick={downloadImage}>
          <Download size={16} />
          下载 PNG 图片
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
