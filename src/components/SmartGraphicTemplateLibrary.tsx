import { useMemo, useState, type CSSProperties } from 'react'
import { LayoutGrid, Sparkles } from 'lucide-react'
import {
  SMART_GRAPHIC_ITEM_COUNT_FILTERS,
  SMART_GRAPHIC_TEMPLATES,
} from '../data/smartGraphicTemplates'
import {
  SMART_GRAPHIC_CATEGORY_LABELS,
  type SmartGraphicCategory,
  type SmartGraphicTemplate,
} from '../types/smartGraphic'

type CategoryFilter = 'all' | SmartGraphicCategory
type CountFilter = (typeof SMART_GRAPHIC_ITEM_COUNT_FILTERS)[number]['id']

interface SmartGraphicTemplateLibraryProps {
  activeTemplateId?: string | null
  onApply: (template: SmartGraphicTemplate) => void
}

const CATEGORY_OPTIONS: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  ...Object.entries(SMART_GRAPHIC_CATEGORY_LABELS).map(([id, label]) => ({
    id: id as SmartGraphicCategory,
    label,
  })),
]

function LayoutThumb({ template }: { template: SmartGraphicTemplate }) {
  const { layout, itemCount, accent } = template

  return (
    <div className="template-preview sg-template-preview" style={{ '--template-accent': accent } as CSSProperties}>
      <svg viewBox="0 0 80 44" aria-hidden="true">
        {layout === 'parallel-horizontal' &&
          Array.from({ length: itemCount }).map((_, index) => (
            <rect
              key={index}
              x={6 + index * (68 / itemCount)}
              y="10"
              width={56 / itemCount}
              height="28"
              rx="3"
              fill="currentColor"
              opacity={0.45 + index * 0.12}
            />
          ))}
        {layout === 'parallel-vertical' &&
          Array.from({ length: itemCount }).map((_, index) => (
            <rect key={index} x="14" y={6 + index * (32 / itemCount)} width="52" height={24 / itemCount} rx="2" fill="currentColor" opacity={0.5 + index * 0.1} />
          ))}
        {(layout === 'process-horizontal' || layout === 'timeline-horizontal') && (
          <>
            {Array.from({ length: itemCount }).map((_, index) => (
              <g key={index}>
                <rect x={8 + index * (64 / itemCount)} y="12" width={12} height="22" rx="2" fill="currentColor" opacity={0.55 + index * 0.1} />
                {index < itemCount - 1 ? (
                  <line
                    x1={20 + index * (64 / itemCount)}
                    y1="23"
                    x2={28 + index * (64 / itemCount)}
                    y2="23"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                ) : null}
              </g>
            ))}
          </>
        )}
        {layout === 'process-vertical' &&
          Array.from({ length: itemCount }).map((_, index) => (
            <g key={index}>
              <circle cx="16" cy={10 + index * (28 / itemCount)} r="4" fill="currentColor" />
              <rect x="24" y={4 + index * (28 / itemCount)} width="48" height={20 / itemCount} rx="2" fill="currentColor" opacity="0.55" />
            </g>
          ))}
        {layout === 'cycle-ring' && (
          <>
            <circle cx="40" cy="22" r="10" fill="currentColor" opacity="0.2" />
            {Array.from({ length: itemCount }).map((_, index) => {
              const angle = (index / itemCount) * Math.PI * 2 - Math.PI / 2
              const x = 40 + Math.cos(angle) * 16
              const y = 22 + Math.sin(angle) * 12
              return <rect key={index} x={x - 4} y={y - 3} width="8" height="6" rx="1.5" fill="currentColor" opacity="0.75" />
            })}
          </>
        )}
        {layout === 'pyramid-tier' &&
          Array.from({ length: itemCount }).map((_, index) => {
            const w = 20 + index * 12
            const x = 40 - w / 2
            const y = 6 + index * 10
            return <polygon key={index} points={`${x + w / 2},${y} ${x + w},${y + 8} ${x},${y + 8}`} fill="currentColor" opacity={0.55 + index * 0.12} />
          })}
        {layout === 'hierarchy-radial' && (
          <>
            <circle cx="40" cy="22" r="7" fill="currentColor" />
            {Array.from({ length: itemCount }).map((_, index) => {
              const angle = (index / itemCount) * Math.PI * 2 - Math.PI / 2
              const x = 40 + Math.cos(angle) * 18
              const y = 22 + Math.sin(angle) * 14
              return (
                <g key={index}>
                  <line x1="40" y1="22" x2={x} y2={y} stroke="currentColor" strokeWidth="1.5" />
                  <rect x={x - 5} y={y - 3} width="10" height="6" rx="2" fill="currentColor" opacity="0.7" />
                </g>
              )
            })}
          </>
        )}
        {layout === 'business-dashboard-4col' && (
          <>
            <rect x="6" y="6" width="68" height="8" rx="2" fill="currentColor" opacity="0.85" />
            {Array.from({ length: 4 }).map((_, index) => (
              <rect
                key={index}
                x={8 + index * 16}
                y="18"
                width="12"
                height="22"
                rx="1.5"
                fill="currentColor"
                opacity={0.45 + index * 0.1}
              />
            ))}
            <rect x="8" y="42" width="30" height="4" rx="1" fill="currentColor" opacity="0.35" />
            <rect x="42" y="42" width="30" height="4" rx="1" fill="currentColor" opacity="0.35" />
          </>
        )}
      </svg>
    </div>
  )
}

export default function SmartGraphicTemplateLibrary({
  activeTemplateId,
  onApply,
}: SmartGraphicTemplateLibraryProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [countFilter, setCountFilter] = useState<CountFilter>('all')

  const filteredTemplates = useMemo(() => {
    return SMART_GRAPHIC_TEMPLATES.filter((template) => {
      if (categoryFilter !== 'all' && template.category !== categoryFilter) return false
      if (countFilter === 'all') return true
      const rule = SMART_GRAPHIC_ITEM_COUNT_FILTERS.find((item) => item.id === countFilter)
      if (!rule || rule.id === 'all') return true
      return rule.match(template.itemCount)
    })
  }, [categoryFilter, countFilter])

  return (
    <section className="chart-template-library sg-template-library">
      <div className="chart-template-header">
        <div className="chart-template-title">
          <LayoutGrid size={18} />
          <div>
            <h3>智能图形版式库</h3>
            <p>并列 · 流程 · 循环 · 金字塔 · 总分 · 时间轴</p>
          </div>
        </div>
      </div>

      <div className="sg-template-filters">
        <div className="sg-filter-row">
          {CATEGORY_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`sg-filter-chip${categoryFilter === option.id ? ' active' : ''}`}
              onClick={() => setCategoryFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="sg-filter-row">
          {SMART_GRAPHIC_ITEM_COUNT_FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`sg-filter-chip sg-filter-chip-muted${countFilter === option.id ? ' active' : ''}`}
              onClick={() => setCountFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-template-grid sg-template-grid">
        {filteredTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            className={`chart-template-card sg-template-card${activeTemplateId === template.id ? ' active' : ''}`}
            onClick={() => onApply(template)}
          >
            <LayoutThumb template={template} />
            <div className="chart-template-card-body">
              <strong>{template.name}</strong>
              <span>{template.description}</span>
              <span className="sg-template-meta">{template.itemCount} 项 · {SMART_GRAPHIC_CATEGORY_LABELS[template.category]}</span>
            </div>
            <span className="chart-template-apply-hint">
              <Sparkles size={12} />
              使用
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
