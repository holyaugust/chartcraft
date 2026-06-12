import { useMemo, useState, type CSSProperties } from 'react'
import { GitBranch, Sparkles } from 'lucide-react'
import {
  FLOWCHART_TEMPLATE_CATEGORY_LABELS,
  FLOWCHART_TEMPLATES,
  type FlowchartTemplate,
  type FlowchartTemplateCategory,
} from '../data/flowchartTemplates'

type FilterKey = 'all' | FlowchartTemplateCategory

interface FlowchartTemplateLibraryProps {
  activeTemplateId?: string | null
  onApply: (template: FlowchartTemplate, withSample: boolean) => void
}

const FILTER_OPTIONS: { id: FilterKey; label: string }[] = [
  { id: 'all', label: '全部' },
  ...Object.entries(FLOWCHART_TEMPLATE_CATEGORY_LABELS).map(([id, label]) => ({
    id: id as FlowchartTemplateCategory,
    label,
  })),
]

function TemplatePreview({ template }: { template: FlowchartTemplate }) {
  const accent = template.accent

  if (template.id.includes('swimlane') || template.id.includes('phase')) {
    return (
      <div className="template-preview" style={{ '--template-accent': accent } as CSSProperties}>
        <svg viewBox="0 0 80 40" aria-hidden="true">
          <rect x="4" y="4" width="72" height="10" rx="2" fill="currentColor" opacity="0.15" />
          <rect x="4" y="18" width="72" height="10" rx="2" fill="currentColor" opacity="0.22" />
          <rect x="4" y="32" width="72" height="4" rx="1" fill="currentColor" opacity="0.35" />
          <rect x="10" y="7" width="14" height="4" rx="1" fill="currentColor" />
          <rect x="30" y="21" width="14" height="4" rx="1" fill="currentColor" opacity="0.8" />
        </svg>
      </div>
    )
  }

  if (template.direction === 'LR') {
    return (
      <div className="template-preview" style={{ '--template-accent': accent } as CSSProperties}>
        <svg viewBox="0 0 80 40" aria-hidden="true">
          <rect x="4" y="14" width="12" height="12" rx="6" fill="currentColor" opacity="0.5" />
          <line x1="16" y1="20" x2="24" y2="20" stroke="currentColor" strokeWidth="1.5" />
          <rect x="24" y="12" width="14" height="16" rx="2" fill="currentColor" opacity="0.7" />
          <line x1="38" y1="20" x2="46" y2="20" stroke="currentColor" strokeWidth="1.5" />
          <rect x="46" y="12" width="14" height="16" rx="2" fill="currentColor" />
          <line x1="60" y1="20" x2="68" y2="20" stroke="currentColor" strokeWidth="1.5" />
          <rect x="68" y="14" width="8" height="12" rx="4" fill="currentColor" opacity="0.5" />
        </svg>
      </div>
    )
  }

  if (template.id.includes('decision') || template.id.includes('loop')) {
    return (
      <div className="template-preview" style={{ '--template-accent': accent } as CSSProperties}>
        <svg viewBox="0 0 80 40" aria-hidden="true">
          <rect x="30" y="2" width="20" height="10" rx="5" fill="currentColor" opacity="0.45" />
          <line x1="40" y1="12" x2="40" y2="16" stroke="currentColor" strokeWidth="1.5" />
          <polygon points="40,16 48,24 40,32 32,24" fill="currentColor" opacity="0.65" />
          <line x1="48" y1="24" x2="62" y2="24" stroke="currentColor" strokeWidth="1.5" />
          <rect x="62" y="18" width="14" height="12" rx="2" fill="currentColor" />
        </svg>
      </div>
    )
  }

  return (
    <div className="template-preview" style={{ '--template-accent': accent } as CSSProperties}>
      <svg viewBox="0 0 80 40" aria-hidden="true">
        <rect x="28" y="2" width="24" height="8" rx="4" fill="currentColor" opacity="0.45" />
        <line x1="40" y1="10" x2="40" y2="14" stroke="currentColor" strokeWidth="1.5" />
        <rect x="28" y="14" width="24" height="8" rx="2" fill="currentColor" opacity="0.65" />
        <line x1="40" y1="22" x2="40" y2="26" stroke="currentColor" strokeWidth="1.5" />
        <rect x="28" y="26" width="24" height="8" rx="2" fill="currentColor" />
      </svg>
    </div>
  )
}

export default function FlowchartTemplateLibrary({
  activeTemplateId,
  onApply,
}: FlowchartTemplateLibraryProps) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const filteredTemplates = useMemo(() => {
    if (filter === 'all') return FLOWCHART_TEMPLATES
    return FLOWCHART_TEMPLATES.filter((template) => template.category === filter)
  }, [filter])

  return (
    <section className="chart-template-library flowchart-template-library">
      <div className="chart-template-header">
        <div className="chart-template-title">
          <GitBranch size={18} />
          <div>
            <h3>流程图样式库</h3>
            <p>选择版式结构，可应用骨架或载入完整示例</p>
          </div>
        </div>
      </div>

      <div className="chart-template-filters" role="tablist" aria-label="样式分类">
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
            <article key={template.id} className={`chart-template-card ${isActive ? 'active' : ''}`}>
              <TemplatePreview template={template} />
              <div className="chart-template-card-body">
                <div className="chart-template-card-top">
                  <h4>{template.name}</h4>
                  <span className="chart-template-type">{template.layoutLabel}</span>
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
                  title="载入该样式的完整示例流程"
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
