import { useMemo, useState, type CSSProperties } from 'react'
import { LayoutTemplate, Sparkles } from 'lucide-react'
import {
  CHART_TEMPLATE_CATEGORY_LABELS,
  CHART_TEMPLATES,
  getChartTypeLabel,
  type ChartTemplate,
  type ChartTemplateCategory,
} from '../data/chartTemplates'

type FilterKey = 'all' | ChartTemplateCategory

interface ChartTemplateLibraryProps {
  activeTemplateId?: string | null
  onApply: (template: ChartTemplate, withSampleData: boolean) => void
}

const FILTER_OPTIONS: { id: FilterKey; label: string }[] = [
  { id: 'all', label: '全部' },
  ...Object.entries(CHART_TEMPLATE_CATEGORY_LABELS).map(([id, label]) => ({
    id: id as ChartTemplateCategory,
    label,
  })),
]

function TemplatePreview({ template }: { template: ChartTemplate }) {
  const { chartType, accent } = template

  return (
    <div className="template-preview" style={{ '--template-accent': accent } as CSSProperties}>
      {chartType === 'line' || chartType === 'area' ? (
        <svg viewBox="0 0 80 40" aria-hidden="true">
          <polyline
            points="4,32 22,22 38,26 56,12 76,8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {chartType === 'area' ? (
            <polygon points="4,32 22,22 38,26 56,12 76,8 76,36 4,36" fill="currentColor" opacity="0.18" />
          ) : null}
        </svg>
      ) : null}

      {chartType === 'bar' || chartType === 'combo' ? (
        <svg viewBox="0 0 80 40" aria-hidden="true">
          <rect x="8" y="18" width="10" height="18" rx="2" fill="currentColor" opacity="0.55" />
          <rect x="24" y="10" width="10" height="26" rx="2" fill="currentColor" opacity="0.75" />
          <rect x="40" y="14" width="10" height="22" rx="2" fill="currentColor" opacity="0.65" />
          <rect x="56" y="6" width="10" height="30" rx="2" fill="currentColor" />
          {chartType === 'combo' ? (
            <polyline
              points="8,12 24,16 40,10 56,14 72,8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ) : null}
        </svg>
      ) : null}

      {chartType === 'pie' || chartType === 'donut' ? (
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="8" opacity="0.25" />
          <circle
            cx="20"
            cy="20"
            r="16"
            fill="none"
            stroke="currentColor"
            strokeWidth={chartType === 'donut' ? 8 : 16}
            strokeDasharray="32 68"
            transform="rotate(-90 20 20)"
          />
        </svg>
      ) : null}

      {chartType === 'scatter' ? (
        <svg viewBox="0 0 80 40" aria-hidden="true">
          {[
            [12, 28],
            [24, 22],
            [36, 26],
            [48, 14],
            [62, 18],
            [72, 10],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.5" fill="currentColor" />
          ))}
        </svg>
      ) : null}

      {chartType === 'radar' ? (
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <polygon
            points="20,6 34,16 28,32 12,32 6,16"
            fill="currentColor"
            opacity="0.18"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      ) : null}
    </div>
  )
}

export default function ChartTemplateLibrary({
  activeTemplateId,
  onApply,
}: ChartTemplateLibraryProps) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const filteredTemplates = useMemo(() => {
    if (filter === 'all') return CHART_TEMPLATES
    return CHART_TEMPLATES.filter((template) => template.category === filter)
  }, [filter])

  return (
    <section className="chart-template-library">
      <div className="chart-template-header">
        <div className="chart-template-title">
          <LayoutTemplate size={18} />
          <div>
            <h3>图表模板库</h3>
            <p>一键应用专业图表样式，可选载入示例数据</p>
          </div>
        </div>
      </div>

      <div className="chart-template-filters" role="tablist" aria-label="模板分类">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={filter === option.id}
            className={`chart-template-filter ${filter === option.id ? 'active' : ''}`}
            onClick={() => setFilter(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="chart-template-grid">
        {filteredTemplates.map((template) => {
          const isActive = activeTemplateId === template.id
          return (
            <article
              key={template.id}
              className={`chart-template-card ${isActive ? 'active' : ''}`}
            >
              <TemplatePreview template={template} />
              <div className="chart-template-card-body">
                <div className="chart-template-card-top">
                  <h4>{template.name}</h4>
                  <span className="chart-template-type">{getChartTypeLabel(template.chartType)}</span>
                </div>
                <p>{template.description}</p>
              </div>
              <div className="chart-template-card-actions">
                <button
                  type="button"
                  className="btn btn-sm chart-template-apply"
                  onClick={() => onApply(template, false)}
                >
                  应用样式
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost chart-template-sample"
                  onClick={() => onApply(template, true)}
                  title="同时替换当前工作表数据为示例"
                >
                  <Sparkles size={14} />
                  含示例
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
