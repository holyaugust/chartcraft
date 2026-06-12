import type { ColorSchemeId } from '../types'
import { COLOR_SCHEMES } from '../utils/colorSchemes'

interface DiagramColorSchemePickerProps {
  value: ColorSchemeId
  disabled?: boolean
  onChange: (id: ColorSchemeId) => void
}

export default function DiagramColorSchemePicker({
  value,
  disabled,
  onChange,
}: DiagramColorSchemePickerProps) {
  return (
    <section className="diagram-side-block">
      <div className="doc-write-material-head">
        <h3>配色方案</h3>
      </div>
      <div className="color-scheme-grid diagram-color-scheme-grid">
        {COLOR_SCHEMES.map((scheme) => (
          <button
            key={scheme.id}
            type="button"
            className={`color-scheme-btn ${value === scheme.id ? 'active' : ''}`}
            disabled={disabled}
            title={scheme.label}
            onClick={() => onChange(scheme.id)}
          >
            <span className="color-swatches">
              {scheme.colors.slice(0, 4).map((color) => (
                <span key={color} className="color-swatch" style={{ background: color }} />
              ))}
            </span>
            <span className="color-scheme-label">{scheme.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
