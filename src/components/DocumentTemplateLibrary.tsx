import { useMemo, useState, type CSSProperties } from 'react'
import { FileText, LayoutTemplate } from 'lucide-react'
import {
  DOCUMENT_FORMAT_SPEC,
  DOCUMENT_TEMPLATE_CATEGORY_LABELS,
  DOCUMENT_TEMPLATES,
  getDocumentTemplateKindLabel,
  type DocumentTemplate,
  type DocumentTemplateCategory,
} from '../data/documentTemplates'

type FilterKey = 'all' | DocumentTemplateCategory

interface DocumentTemplateLibraryProps {
  activeTemplateId?: string | null
  onApply: (template: DocumentTemplate) => void
}

const FILTER_OPTIONS: { id: FilterKey; label: string }[] = [
  { id: 'all', label: '全部' },
  ...Object.entries(DOCUMENT_TEMPLATE_CATEGORY_LABELS).map(([id, label]) => ({
    id: id as DocumentTemplateCategory,
    label,
  })),
]

function TemplateBadge({ template }: { template: DocumentTemplate }) {
  return (
    <div className="document-template-badge-row">
      <span className={`document-template-kind ${template.kind}`}>
        {getDocumentTemplateKindLabel(template.kind)}
      </span>
      <span className="chart-template-type">{DOCUMENT_TEMPLATE_CATEGORY_LABELS[template.category]}</span>
    </div>
  )
}

function TemplatePreview({ template }: { template: DocumentTemplate }) {
  return (
    <div
      className="document-template-preview"
      style={{ '--template-accent': template.accent } as CSSProperties}
    >
      <FileText size={22} strokeWidth={1.6} />
      <span>{template.name}</span>
    </div>
  )
}

export default function DocumentTemplateLibrary({
  activeTemplateId,
  onApply,
}: DocumentTemplateLibraryProps) {
  const [filter, setFilter] = useState<FilterKey>('all')

  const filteredTemplates = useMemo(() => {
    if (filter === 'all') return DOCUMENT_TEMPLATES
    return DOCUMENT_TEMPLATES.filter((template) => template.category === filter)
  }, [filter])

  return (
    <section className="document-template-library chart-template-library">
      <div className="chart-template-header">
        <div className="chart-template-title">
          <LayoutTemplate size={18} />
          <div>
            <h3>国企公文模板库</h3>
            <p>{DOCUMENT_FORMAT_SPEC}</p>
          </div>
        </div>
        <span className="document-template-count">{DOCUMENT_TEMPLATES.length} 套模板</span>
      </div>

      <div className="chart-template-filters" role="tablist" aria-label="公文模板分类">
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

      <div className="chart-template-grid document-template-grid">
        {filteredTemplates.map((template) => {
          const isActive = activeTemplateId === template.id
          return (
            <article
              key={template.id}
              className={`chart-template-card document-template-card ${isActive ? 'active' : ''}`}
            >
              <TemplatePreview template={template} />
              <div className="chart-template-card-body">
                <div className="chart-template-card-top">
                  <h4>{template.name}</h4>
                </div>
                <TemplateBadge template={template} />
                <p>{template.description}</p>
              </div>
              <div className="chart-template-card-actions">
                <button
                  type="button"
                  className="btn btn-sm chart-template-apply"
                  onClick={() => onApply(template)}
                >
                  使用模板
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
