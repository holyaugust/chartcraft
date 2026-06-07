import { PRESENTATION_TEMPLATES } from '../data/presentationTemplates'
import type { PresentationTemplate } from '../types/presentation'

interface PresentationTemplateLibraryProps {
  activeTemplateId?: string | null
  onSelect: (template: PresentationTemplate) => void
}

export default function PresentationTemplateLibrary({
  activeTemplateId,
  onSelect,
}: PresentationTemplateLibraryProps) {
  return (
    <div className="document-template-library presentation-template-library">
      <div className="chart-template-library-header">
        <h3>汇报模板</h3>
        <p>选择模板后生成 PPT 大纲与幻灯片</p>
      </div>
      <div className="chart-template-grid">
        {PRESENTATION_TEMPLATES.map((template) => {
          const isActive = activeTemplateId === template.id
          return (
            <article
              key={template.id}
              className={`chart-template-card document-template-card presentation-template-card ${isActive ? 'active' : ''}`}
              onClick={() => onSelect(template)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(template)
                }
              }}
            >
              <div className="presentation-template-accent" aria-hidden="true" />
              <h4>{template.name}</h4>
              <p>{template.description}</p>
              <p className="presentation-template-structure">{template.suggestedStructure}</p>
            </article>
          )
        })}
      </div>
    </div>
  )
}
