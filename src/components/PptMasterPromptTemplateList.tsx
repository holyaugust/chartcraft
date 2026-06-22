import type { PptMasterPromptTemplate } from '../data/pptMasterPromptTemplates'
import { promptTemplateToText } from '../data/pptMasterPromptTemplates'

interface PptMasterPromptTemplateListProps {
  templates: PptMasterPromptTemplate[]
  disabled?: boolean
  onSelect: (text: string) => void
}

function PromptTemplateBody({ template }: { template: PptMasterPromptTemplate }) {
  return (
    <p className="ppt-master-prompt-template-body">
      {template.segments.map((seg, index) =>
        seg.type === 'text' ? (
          <span key={index}>{seg.value}</span>
        ) : (
          <mark
            key={index}
            className="ppt-master-prompt-slot"
            title={`可替换 · ${seg.label}`}
          >
            {seg.value}
          </mark>
        ),
      )}
    </p>
  )
}

export default function PptMasterPromptTemplateList({
  templates,
  disabled = false,
  onSelect,
}: PptMasterPromptTemplateListProps) {
  return (
    <div className="ppt-master-prompt-template-list">
      <div className="ppt-master-prompt-template-list-head">
        <h4 className="ppt-master-prompt-template-list-title">精品提示词示例 · 点击替换左侧</h4>
      </div>
      <div className="ppt-master-prompt-template-scroll">
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            className="ppt-master-prompt-template-card"
            disabled={disabled}
            onClick={() => onSelect(promptTemplateToText(template))}
          >
            <div className="ppt-master-prompt-template-card-head">
              <strong>{template.title}</strong>
              <span className="ppt-master-prompt-template-tag">{template.tag}</span>
            </div>
            <PromptTemplateBody template={template} />
          </button>
        ))}
      </div>
    </div>
  )
}
