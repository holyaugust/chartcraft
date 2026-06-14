import type { PptCoverContent } from '../types/pptBeautify'
import type { PptCoverTheme } from '../types/pptBeautify'

interface PptBeautifyCoverPreviewProps {
  mode: 'before' | 'after'
  content: PptCoverContent
  theme?: PptCoverTheme
}

export default function PptBeautifyCoverPreview({ mode, content, theme }: PptBeautifyCoverPreviewProps) {
  if (mode === 'before') {
    return (
      <div className="ppt-beautify-slide ppt-beautify-slide-plain">
        <div className="ppt-beautify-plain-inner">
          <h2>{content.title || '主标题'}</h2>
          {content.subtitle ? <p>{content.subtitle}</p> : null}
          {(content.author || content.date) && (
            <div className="ppt-beautify-plain-footer">
              {content.author ? <span>{content.author}</span> : null}
              {content.date ? <span>{content.date}</span> : null}
            </div>
          )}
        </div>
      </div>
    )
  }

  const preview = theme?.preview
  if (!preview) return null

  return (
    <div
      className="ppt-beautify-slide ppt-beautify-slide-themed"
      style={{
        background: preview.background,
      }}
    >
      {preview.decoration ? (
        <div className="ppt-beautify-slide-decoration" style={{ background: preview.decoration }} aria-hidden="true" />
      ) : null}
      <div className="ppt-beautify-accent-bar" style={{ background: preview.accent }} aria-hidden="true" />
      <div className="ppt-beautify-themed-inner">
        <h2 style={{ color: preview.titleColor }}>{content.title || '主标题'}</h2>
        {content.subtitle ? (
          <p style={{ color: preview.subtitleColor }}>{content.subtitle}</p>
        ) : (
          <p style={{ color: preview.subtitleColor, opacity: 0.5 }}>副标题</p>
        )}
        <div className="ppt-beautify-themed-footer" style={{ color: preview.footerColor }}>
          <span>{content.author || '汇报人'}</span>
          <span>{content.date || '2025.01.01'}</span>
        </div>
      </div>
    </div>
  )
}
