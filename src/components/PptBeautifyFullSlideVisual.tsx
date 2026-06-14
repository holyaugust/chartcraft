import type { PptCoverTheme } from '../types/pptBeautify'
import type { PresentationSlideLayout } from '../types/presentation'
import type { ImportedPptxSlide } from '../utils/pptxImport'

export interface SlideDisplay {
  title: string
  subtitle?: string
  author?: string
  date?: string
  bullets: string[]
}

export function resolveLayout(slide: ImportedPptxSlide, overrides?: Partial<Record<number, PresentationSlideLayout>>) {
  return overrides?.[slide.index] ?? slide.suggestedLayout
}

export function parseSlideDisplay(slide: ImportedPptxSlide, layout: PresentationSlideLayout): SlideDisplay {
  const texts = slide.texts.map((line) => line.trim()).filter(Boolean)
  if (layout === 'title') {
    return {
      title: texts[0] ?? '演示文稿',
      subtitle: texts[1],
      author: texts[2],
      date: texts[3],
      bullets: [],
    }
  }
  return {
    title: texts[0] ?? '',
    bullets: texts.slice(1),
  }
}

function ContentSlideVisual({
  display,
  theme,
  compact,
  capture,
  pageNumber,
}: {
  display: SlideDisplay
  theme: PptCoverTheme
  compact?: boolean
  capture?: boolean
  pageNumber?: number
}) {
  const preview = theme.preview
  const content = preview.content
  const bullets = display.bullets.slice(0, compact ? 2 : 5)
  const rootClass = [
    'ppt-beautify-slide',
    'ppt-beautify-full-slide',
    'ppt-beautify-full-content-slide',
    compact ? 'compact' : '',
    capture ? 'ppt-beautify-slide-capture' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClass} style={{ background: content.pageBackground }}>
      <div className="ppt-beautify-full-content-mesh" style={{ background: content.meshDecoration }} aria-hidden="true" />
      {!compact ? (
        <>
          <div className="ppt-beautify-full-deco-ring ppt-beautify-full-deco-ring-a" style={{ borderColor: preview.accent }} aria-hidden="true" />
          <div className="ppt-beautify-full-deco-ring ppt-beautify-full-deco-ring-b" style={{ background: `${preview.accent}33` }} aria-hidden="true" />
        </>
      ) : null}
      <div className="ppt-beautify-accent-bar" style={{ background: preview.accent }} aria-hidden="true" />

      <div className="ppt-beautify-full-content-header" style={{ background: content.headerBackground }}>
        <div className="ppt-beautify-full-content-header-shine" aria-hidden="true" />
        <div className="ppt-beautify-full-content-header-line" style={{ background: preview.accent }} aria-hidden="true" />
        {!compact ? <span className="ppt-beautify-full-content-tag">KEY POINTS</span> : null}
        <h3 style={{ color: content.headerTitleColor }}>{display.title || '正文标题'}</h3>
      </div>

      <div className="ppt-beautify-full-content-main">
        <div
          className="ppt-beautify-full-content-card"
          style={{
            background: content.bodyBackground,
            borderColor: content.cardBorder,
            boxShadow: compact ? undefined : `0 12px 32px ${content.primaryColor}18, 0 2px 8px rgba(15,23,42,0.06)`,
          }}
        >
          {bullets.length > 0 ? (
            <ul className="ppt-beautify-full-bullets">
              {bullets.map((bullet, index) => (
                <li
                  key={`${index}-${bullet}`}
                  className="ppt-beautify-full-bullet-card"
                  style={{ borderColor: content.cardBorder, background: `${content.primaryColor}06` }}
                >
                  <span
                    className="ppt-beautify-full-bullet-num"
                    style={{
                      background: `linear-gradient(135deg, ${content.primaryColor}, ${preview.accent})`,
                      color: '#fff',
                    }}
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="ppt-beautify-full-bullet-text" style={{ color: content.bodyColor }}>
                    {bullet}
                  </span>
                  <span className="ppt-beautify-full-bullet-stripe" style={{ background: preview.accent }} aria-hidden="true" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="ppt-beautify-full-empty-body" style={{ color: content.bodyColor }}>
              要点内容
            </p>
          )}
        </div>
      </div>

      {!compact ? (
        <div className="ppt-beautify-full-content-footer" style={{ background: content.headerBackground }}>
          <span className="ppt-beautify-full-footer-line" style={{ background: preview.accent }} aria-hidden="true" />
          {pageNumber ? (
            <span className="ppt-beautify-full-page-pill" style={{ color: content.headerTitleColor }}>
              {pageNumber}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default function FullSlideVisual({
  layout,
  display,
  theme,
  compact = false,
  capture = false,
  pageNumber,
}: {
  layout: PresentationSlideLayout
  display: SlideDisplay
  theme: PptCoverTheme
  compact?: boolean
  capture?: boolean
  pageNumber?: number
}) {
  const preview = theme.preview
  const rootClass = [
    'ppt-beautify-slide',
    'ppt-beautify-full-slide',
    compact ? 'compact' : '',
    capture ? 'ppt-beautify-slide-capture' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (layout === 'title') {
    return (
      <div className={rootClass} style={{ background: preview.background }}>
        {preview.decoration ? (
          <div className="ppt-beautify-slide-decoration" style={{ background: preview.decoration }} aria-hidden="true" />
        ) : null}
        <div className="ppt-beautify-accent-bar" style={{ background: preview.accent }} aria-hidden="true" />
        {!compact && theme.id !== 'minimal-gray' ? (
          <div className="ppt-beautify-full-footer-band" style={{ background: preview.accent, opacity: 0.35 }} aria-hidden="true" />
        ) : null}
        <div className="ppt-beautify-themed-inner">
          <h2 style={{ color: preview.titleColor }}>{display.title || '主标题'}</h2>
          {display.subtitle ? (
            <p style={{ color: preview.subtitleColor }}>{display.subtitle}</p>
          ) : (
            <p style={{ color: preview.subtitleColor, opacity: 0.45 }}>副标题</p>
          )}
          <div className="ppt-beautify-themed-footer" style={{ color: preview.footerColor }}>
            <span>{display.author || '汇报人'}</span>
            <span>{display.date || '2025.01.01'}</span>
          </div>
        </div>
      </div>
    )
  }

  if (layout === 'section' || layout === 'closing') {
    return (
      <div className={rootClass} style={{ background: preview.background }}>
        <div className="ppt-beautify-accent-bar" style={{ background: preview.accent }} aria-hidden="true" />
        {layout === 'section' ? (
          <div className="ppt-beautify-full-section-accent" style={{ background: preview.accent }} aria-hidden="true" />
        ) : null}
        <div className="ppt-beautify-full-section-inner">
          <h2 style={{ color: preview.titleColor }}>{display.title || (layout === 'closing' ? '谢谢聆听' : '章节标题')}</h2>
          {display.bullets[0] ? <p style={{ color: preview.subtitleColor }}>{display.bullets[0]}</p> : null}
          {layout === 'closing' ? <p className="ppt-beautify-full-closing-en" style={{ color: preview.subtitleColor }}>Thank You</p> : null}
        </div>
      </div>
    )
  }

  return (
    <ContentSlideVisual
      display={display}
      theme={theme}
      compact={compact}
      capture={capture}
      pageNumber={pageNumber}
    />
  )
}
