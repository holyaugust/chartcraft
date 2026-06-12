import { useMemo, useState, type CSSProperties } from 'react'
import { Network, Sparkles } from 'lucide-react'
import {
  MINDMAP_TEMPLATE_CATEGORY_LABELS,
  MINDMAP_TEMPLATES,
  type MindmapTemplate,
  type MindmapTemplateCategory,
} from '../data/mindmapTemplates'

type FilterKey = 'all' | MindmapTemplateCategory

interface MindmapTemplateLibraryProps {
  activeTemplateId?: string | null
  onApply: (template: MindmapTemplate, withSample: boolean) => void
}

const FILTER_OPTIONS: { id: FilterKey; label: string }[] = [
  { id: 'all', label: '全部' },
  ...Object.entries(MINDMAP_TEMPLATE_CATEGORY_LABELS).map(([id, label]) => ({
    id: id as MindmapTemplateCategory,
    label,
  })),
]

function TemplatePreview({ template }: { template: MindmapTemplate }) {
  const accent = template.accent
  const [c1, c2] = template.branchColors

  return (
    <div className="template-preview mindmap-template-preview" style={{ '--template-accent': accent } as CSSProperties}>
      <svg viewBox="0 0 80 40" aria-hidden="true">
        <rect x="34" y="16" width="12" height="8" rx="4" fill="currentColor" opacity="0.85" />
        <line x1="34" y1="18" x2="22" y2="10" stroke={c1 ?? accent} strokeWidth="1.5" />
        <line x1="34" y1="22" x2="22" y2="30" stroke={c2 ?? accent} strokeWidth="1.5" />
        <rect x="6" y="6" width="14" height="7" rx="3" fill={c1 ?? accent} opacity="0.85" />
        <rect x="6" y="27" width="14" height="7" rx="3" fill={c2 ?? accent} opacity="0.85" />
        <line x1="20" y1="10" x2="4" y2="4" stroke={c1 ?? accent} strokeWidth="1" opacity="0.7" />
        <line x1="20" y1="30" x2="4" y2="36" stroke={c2 ?? accent} strokeWidth="1" opacity="0.7" />
        <rect x="52" y="10" width="10" height="5" rx="2" fill="currentColor" opacity="0.35" />
        <rect x="52" y="25" width="10" height="5" rx="2" fill="currentColor" opacity="0.35" />
        <line x1="46" y1="20" x2="52" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        <line x1="46" y1="20" x2="52" y2="28" stroke="currentColor" strokeWidth="1" opacity="0.5" />
      </svg>
    </div>
  )
}

export default function MindmapTemplateLibrary({
  activeTemplateId,
  onApply,
}: MindmapTemplateLibraryProps) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const filteredTemplates = useMemo(() => {
    if (filter === 'all') return MINDMAP_TEMPLATES
    return MINDMAP_TEMPLATES.filter((template) => template.category === filter)
  }, [filter])

  return (
    <section className="chart-template-library mindmap-template-library">
      <div className="chart-template-header">
        <div className="chart-template-title">
          <Network size={18} />
          <div>
            <h3>思维导图样式库</h3>
            <p>树形层级展开，非流程顺序；可选骨架或完整示例</p>
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
                  title="载入该样式的完整示例"
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
