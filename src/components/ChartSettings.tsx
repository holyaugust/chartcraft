import type { ChartConfig, ColorSchemeId } from '../types'
import { COLOR_SCHEMES } from '../utils/colorSchemes'
import { getChartStyleMeta } from '../utils/chartStyles'

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

  const styleMeta = getChartStyleMeta(config.type)
  const styleOptions = Object.keys(styleMeta.labels)
  const currentStyle = config[styleMeta.configKey] as string

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

        {config.showLegend && (
          <div className="setting-field setting-field-inline">
            <label htmlFor="legend-gap">
              图例间距 <span className="setting-value">{config.legendItemGap}px</span>
            </label>
            <input
              id="legend-gap"
              type="range"
              min={4}
              max={80}
              step={2}
              value={config.legendItemGap}
              onChange={(e) => update('legendItemGap', Number(e.target.value))}
            />
          </div>
        )}

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

      <div className="setting-field">
        <label>配色方案</label>
        <div className="color-scheme-grid">
          {COLOR_SCHEMES.map((scheme) => (
            <button
              key={scheme.id}
              type="button"
              className={`color-scheme-btn ${config.colorScheme === scheme.id ? 'active' : ''}`}
              onClick={() => update('colorScheme', scheme.id as ColorSchemeId)}
              title={scheme.label}
            >
              <span className="color-swatches">
                {scheme.colors.slice(0, 4).map((color) => (
                  <span key={color} className="color-swatch" style={{ background: color }} />
                ))}
              </span>
              <span className="color-scheme-label">{scheme.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="setting-field">
        <label>{styleMeta.title}</label>
        <div className="chart-style-grid">
          {styleOptions.map((style) => (
            <button
              key={style}
              type="button"
              className={`chart-style-btn ${currentStyle === style ? 'active' : ''}`}
              onClick={() => update(styleMeta.configKey, style as ChartConfig[typeof styleMeta.configKey])}
            >
              {styleMeta.labels[style]}
            </button>
          ))}
        </div>
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
