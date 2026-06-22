import type { PptMasterFieldGuide, PptMasterWritingExample } from '../data/pptMasterWritingGuide'

interface PptMasterFieldHintRowProps {
  guide: PptMasterFieldGuide
}

/** 一行提示 + 「?」展开完整说明 */
export function PptMasterFieldHintRow({ guide }: PptMasterFieldHintRowProps) {
  return (
    <div className="ppt-master-field-hint-row">
      <p className="ppt-master-field-hint-text">{guide.subtitle}</p>
      <details className="ppt-master-field-help">
        <summary className="ppt-master-field-help-trigger" title="查看填写说明">
          ?
        </summary>
        <div className="ppt-master-field-help-body">
          <div className="ppt-master-field-guide-grid">
            <div className="ppt-master-field-guide-col">
              <strong className="ppt-master-field-guide-label ppt-master-field-guide-label-do">适合写</strong>
              <ul className="ppt-master-field-guide-list">
                {guide.affects.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="ppt-master-field-guide-col">
              <strong className="ppt-master-field-guide-label ppt-master-field-guide-label-dont">不必写</strong>
              <ul className="ppt-master-field-guide-list ppt-master-field-guide-list-muted">
                {guide.notFor.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </details>
    </div>
  )
}

interface PptMasterWritingExampleGroupProps {
  title: string
  examples: PptMasterWritingExample[]
  disabled?: boolean
  onSelect: (text: string) => void
}

export function PptMasterWritingExampleGroup({
  title,
  examples,
  disabled = false,
  onSelect,
}: PptMasterWritingExampleGroupProps) {
  return (
    <div className="ppt-master-writing-example-group">
      <h4 className="ppt-master-writing-example-title">{title}</h4>
      <div className="ppt-master-writing-example-chips">
        {examples.map((item) => (
          <button
            key={item.text}
            type="button"
            className="ppt-master-writing-example-chip"
            disabled={disabled}
            title={item.caption}
            onClick={() => onSelect(item.text)}
          >
            {item.text}
          </button>
        ))}
      </div>
    </div>
  )
}
