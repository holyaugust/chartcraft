import type { ChartConfig, ColorSchemeId, LineStyleId } from '../types'
import { COLOR_SCHEMES } from '../utils/colorSchemes'
import { getChartStyleMeta, LINE_STYLE_LABELS } from '../utils/chartStyles'

interface ChartSettingsProps {
  config: ChartConfig
  onChange: (config: ChartConfig) => void
}

export default function ChartSettings({ config, onChange }: ChartSettingsProps) {
  const update = <K extends keyof ChartConfig>(key: K, value: ChartConfig[K]) => {
    onChange({ ...config, [key]: value })
  }

  const showLineOptions = ['line', 'area', 'combo'].includes(config.type)
  const showStackOption = ['bar', 'area'].includes(config.type)
  const showDualAxisOption = ['bar', 'line', 'area'].includes(config.type)
  const showAxisTitles = ['bar', 'line', 'area', 'combo', 'scatter'].includes(config.type)
  const showSecondAxisTitle =
    config.type === 'combo' || (showDualAxisOption && config.dualAxis)
  const showPieHint = ['pie', 'donut'].includes(config.type)
  const isCombo = config.type === 'combo'

  const styleMeta = getChartStyleMeta(config.type)
  const styleOptions = Object.keys(styleMeta.labels)
  const currentStyle = config[styleMeta.configKey] as string
  const lineStyleOptions = Object.keys(LINE_STYLE_LABELS) as LineStyleId[]

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

      {showAxisTitles && (
        <div className="setting-field-group">
          <div className="setting-field">
            <label htmlFor="x-axis-title">X 轴标题</label>
            <input
              id="x-axis-title"
              type="text"
              value={config.xAxisTitle}
              onChange={(e) => update('xAxisTitle', e.target.value)}
              placeholder={config.type === 'scatter' ? '默认使用第一组数值列名' : '默认使用分类列'}
            />
          </div>
          <div className="setting-field">
            <label htmlFor="y-axis-title">Y 轴标题</label>
            <input
              id="y-axis-title"
              type="text"
              value={config.yAxisTitle}
              onChange={(e) => update('yAxisTitle', e.target.value)}
              placeholder="默认使用第一组数值列名"
            />
          </div>
          {showSecondAxisTitle && (
            <div className="setting-field">
              <label htmlFor="y2-axis-title">次 Y 轴标题</label>
              <input
                id="y2-axis-title"
                type="text"
                value={config.yAxis2Title}
                onChange={(e) => update('yAxis2Title', e.target.value)}
                placeholder="默认使用第二组数值列名"
              />
            </div>
          )}
        </div>
      )}

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

        <label className="toggle">
          <input
            type="checkbox"
            checked={config.showDataLabels}
            onChange={(e) => update('showDataLabels', e.target.checked)}
          />
          <span>显示数据标签</span>
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

        {showDualAxisOption && (
          <label className="toggle">
            <input
              type="checkbox"
              checked={config.dualAxis}
              onChange={(e) => update('dualAxis', e.target.checked)}
            />
            <span>双 Y 轴</span>
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
        <label>{isCombo ? '柱状样式（主轴）' : styleMeta.title}</label>
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

      {isCombo && (
        <div className="setting-field">
          <label>折线样式（次轴）</label>
          <div className="chart-style-grid">
            {lineStyleOptions.map((style) => (
              <button
                key={style}
                type="button"
                className={`chart-style-btn ${config.lineStyle === style ? 'active' : ''}`}
                onClick={() => update('lineStyle', style)}
              >
                {LINE_STYLE_LABELS[style]}
              </button>
            ))}
          </div>
        </div>
      )}

      {showPieHint && (
        <p className="setting-hint">饼图/环形图使用第一列作为分类，第一组数值列作为数据</p>
      )}

      {isCombo && (
        <p className="setting-hint">柱线组合：第一组数据为柱状（左轴），其余为折线（右轴）</p>
      )}

      {config.type === 'scatter' && (
        <p className="setting-hint">散点图使用前两组数值列分别作为 X 轴和 Y 轴</p>
      )}

        {showDualAxisOption && config.dualAxis && (
        <p className="setting-hint">双 Y 轴：第一组数据使用左轴，其余系列使用右轴</p>
      )}

      {config.showDataLabels && (
        <p className="setting-hint">
          数据标签会自动错开重叠项；多系列时若配色相近，将自动切换高对比色（组合图折线尤为明显）
        </p>
      )}
    </div>
  )
}
