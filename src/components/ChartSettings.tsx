import type { ChartConfig } from '../types'

interface ChartSettingsProps {
  config: ChartConfig
  onChange: (config: ChartConfig) => void
}

export default function ChartSettings({ config, onChange }: ChartSettingsProps) {
  const update = <K extends keyof ChartConfig>(key: K, value: ChartConfig[K]) => {
    onChange({ ...config, [key]: value })
  }

  const showLineOptions = ['line', 'area'].includes(config.type)
  const showStackOption = ['bar', 'area'].includes(config.type)
  const showPieHint = ['pie', 'donut'].includes(config.type)

  return (
    <div className="chart-settings">
      <div className="setting-field">
        <label htmlFor="chart-title">图表标题</label>
        <input
          id="chart-title"
          type="text"
          value={config.title}
          onChange={(e) => update('title', e.target.value)}
          placeholder="输入图表标题"
        />
      </div>

      <div className="setting-field">
        <label htmlFor="chart-subtitle">副标题</label>
        <input
          id="chart-subtitle"
          type="text"
          value={config.subtitle}
          onChange={(e) => update('subtitle', e.target.value)}
          placeholder="可选副标题"
        />
      </div>

      <div className="setting-toggles">
        <label className="toggle">
          <input
            type="checkbox"
            checked={config.showLegend}
            onChange={(e) => update('showLegend', e.target.checked)}
          />
          <span>显示图例</span>
        </label>

        <label className="toggle">
          <input
            type="checkbox"
            checked={config.showGrid}
            onChange={(e) => update('showGrid', e.target.checked)}
          />
          <span>显示网格</span>
        </label>

        {showLineOptions && (
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.smooth}
              onChange={(e) => update('smooth', e.target.checked)}
            />
            <span>平滑曲线</span>
          </label>
        )}

        {showStackOption && (
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.stacked}
              onChange={(e) => update('stacked', e.target.checked)}
            />
            <span>堆叠显示</span>
          </label>
        )}
      </div>

      {showPieHint && (
        <p className="setting-hint">饼图/环形图使用第一列作为分类，第一组数值列作为数据</p>
      )}

      {config.type === 'scatter' && (
        <p className="setting-hint">散点图使用前两组数值列分别作为 X 轴和 Y 轴</p>
      )}
    </div>
  )
}
