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
  const colors = template.branchColors.slice(0, 4)

  return (
    <div
      className="template-preview mindmap-template-preview"
      style={{ '--template-accent': template.accent } as CSSProperties}
    >
      <svg viewBox="0 0 80 40" aria-hidden="true">
        <defs>
          <radialGradient id={`mm-root-${template.id}`} cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor={colors[0]} stopOpacity="0.95" />
            <stop offset="100%" stopColor={colors[1] ?? colors[0]} stopOpacity="1" />
          </radialGradient>
        </defs>
        <circle cx="40" cy="20" r="7" fill={`url(#mm-root-${template.id})`} />
        {colors.map((color, index) => {
          const angle = (index / colors.length) * Math.PI * 2 - Math.PI / 2
          const bx = 40 + Math.cos(angle) * 22
          const by = 20 + Math.sin(angle) * 14
          const lx = 40 + Math.cos(angle) * 34
          const ly = 20 + Math.sin(angle) * 22
          return (
            <g key={color}>
              <line x1="40" y1="20" x2={bx} y2={by} stroke={color} strokeWidth="1.8" opacity="0.9" />
              <rect x={bx - 7} y={by - 3.5} width="14" height="7" rx="3.5" fill={color} opacity="0.92" />
              <line x1={bx} y1={by} x2={lx} y2={ly} stroke={color} strokeWidth="1.2" opacity="0.65" />
              <rect x={lx - 5} y={ly - 2.5} width="10" height="5" rx="2.5" fill={color} opacity="0.35" />
            </g>
          )
        })}
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
