import { useMemo, useState, type CSSProperties } from 'react'
import { FileText, LayoutTemplate, Search } from 'lucide-react'
import {
  DOCUMENT_FORMAT_SPEC,
  DOCUMENT_TEMPLATES,
  WORKPLACE_SUBCATEGORY_LABELS,
  getDocumentTemplateKindLabel,
  getDocumentTemplateMetaLabel,
  type DocumentTemplate,
  type DocumentTemplateSubcategory,
} from '../data/documentTemplates'

type FilterKey = 'all' | DocumentTemplateSubcategory

interface DocumentTemplateLibraryProps {
  layout?: 'sidebar' | 'modal'
  activeTemplateId?: string | null
  onApply: (template: DocumentTemplate) => void
  onSelect?: (template: DocumentTemplate) => void
}

const FILTER_OPTIONS: { id: FilterKey; label: string }[] = [
  { id: 'all', label: '全部' },
  ...Object.entries(WORKPLACE_SUBCATEGORY_LABELS).map(([id, label]) => ({
    id: id as DocumentTemplateSubcategory,
    label,
  })),
]

function TemplateBadge({ template }: { template: DocumentTemplate }) {
  return (
    <div className="document-template-badge-row">
      <span className={`document-template-kind ${template.kind}`}>
        {getDocumentTemplateKindLabel(template.kind)}
      </span>
      <span className="chart-template-type">{getDocumentTemplateMetaLabel(template)}</span>
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
  layout = 'sidebar',
  activeTemplateId,
  onApply,
  onSelect,
}: DocumentTemplateLibraryProps) {
  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const isModal = layout === 'modal'

  const filteredTemplates = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return DOCUMENT_TEMPLATES.filter((template) => {
      if (filter !== 'all' && template.subcategory !== filter) return false
      if (!keyword) return true
      const haystack =
        `${template.name} ${template.description} ${getDocumentTemplateMetaLabel(template)}`.toLowerCase()
      return haystack.includes(keyword)
    })
  }, [filter, search])

  return (
    <section
      className={`document-template-library chart-template-library document-template-library--${layout}`}
    >
      {!isModal ? (
        <div className="chart-template-header">
          <div className="chart-template-title">
            <LayoutTemplate size={18} />
            <div>
              <h3>职场公文模板库</h3>
              <p>{DOCUMENT_FORMAT_SPEC}</p>
            </div>
          </div>
          <span className="document-template-count">{DOCUMENT_TEMPLATES.length} 套模板</span>
        </div>
      ) : (
        <div className="document-template-modal-toolbar">
          <div className="document-template-search">
            <Search size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索模板名称或用途，如 通知、汇报、总结、纪要…"
              aria-label="搜索职场公文模板"
            />
          </div>
          <span className="document-template-modal-count">
            {filteredTemplates.length} / {DOCUMENT_TEMPLATES.length} 套
          </span>
        </div>
      )}

      <div className="chart-template-filters document-template-filters" role="tablist" aria-label="职场公文分类">
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

      {filteredTemplates.length === 0 ? (
        <p className="document-template-empty">没有匹配的模板，请换个关键词或分类试试。</p>
      ) : (
        <div className="chart-template-grid document-template-grid">
          {filteredTemplates.map((template) => {
            const isActive = activeTemplateId === template.id
            return (
              <article
                key={template.id}
                className={`chart-template-card document-template-card ${isActive ? 'active' : ''}`}
                onClick={() => onSelect?.(template)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelect?.(template)
                  }
                }}
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
                    onClick={(event) => {
                      event.stopPropagation()
                      onApply(template)
                    }}
                  >
                    使用模板
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
