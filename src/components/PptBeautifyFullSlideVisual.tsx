import type { PptCoverTheme } from '../types/pptBeautify'
import type { PptFullLayoutStyle } from '../data/pptLayoutStyles'
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

function layoutClass(style: PptFullLayoutStyle, extra = '') {
  return ['ppt-layout', `ppt-layout-${style}`, extra].filter(Boolean).join(' ')
}

function BulletList({
  bullets,
  theme,
  style,
}: {
  bullets: string[]
  theme: PptCoverTheme
  style: PptFullLayoutStyle
}) {
  const preview = theme.preview
  const content = preview.content
  const bulletClass =
    style === 'editorial'
      ? 'ppt-beautify-full-bullet-editorial'
      : style === 'timeline'
        ? 'ppt-beautify-full-bullet-timeline'
        : style === 'tech-angular'
          ? 'ppt-beautify-full-bullet-tech'
          : 'ppt-beautify-full-bullet-card'

  if (bullets.length === 0) {
    return (
      <p className="ppt-beautify-full-empty-body" style={{ color: content.bodyColor }}>
        要点内容
      </p>
    )
  }

  return (
    <ul className={`ppt-beautify-full-bullets ppt-beautify-full-bullets-${style}`}>
      {bullets.map((bullet, index) => (
        <li
          key={`${index}-${bullet}`}
          className={bulletClass}
          style={{ borderColor: content.cardBorder, background: `${content.primaryColor}06` }}
        >
          {style === 'editorial' ? (
            <span className="ppt-beautify-full-bullet-dot" style={{ background: preview.accent }} aria-hidden="true" />
          ) : style === 'tech-angular' ? (
            <span className="ppt-beautify-full-bullet-tech-mark" style={{ color: preview.accent }}>
              {String(index + 1).padStart(2, '0')}
            </span>
          ) : style === 'timeline' ? (
            <span className="ppt-beautify-full-bullet-timeline-node" style={{ borderColor: preview.accent, background: content.primaryColor }} aria-hidden="true" />
          ) : (
            <span
              className="ppt-beautify-full-bullet-num"
              style={{ background: `linear-gradient(135deg, ${content.primaryColor}, ${preview.accent})`, color: '#fff' }}
            >
              {String(index + 1).padStart(2, '0')}
            </span>
          )}
          <span className="ppt-beautify-full-bullet-text" style={{ color: content.bodyColor }}>
            {bullet}
          </span>
          {style !== 'editorial' && style !== 'tech-angular' ? (
            <span className="ppt-beautify-full-bullet-stripe" style={{ background: preview.accent }} aria-hidden="true" />
          ) : null}
        </li>
      ))}
    </ul>
  )
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
  const style = theme.layoutStyle
  const preview = theme.preview
  const content = preview.content
  const bullets = display.bullets.slice(0, compact ? 2 : 5)
  const rootClass = [
    'ppt-beautify-slide',
    'ppt-beautify-full-slide',
    'ppt-beautify-full-content-slide',
    layoutClass(style),
    compact ? 'compact' : '',
    capture ? 'ppt-beautify-slide-capture' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const showAccentBar = style !== 'side-rail' && style !== 'editorial'
  const showMesh = style !== 'tech-angular'
  const showCard = style !== 'editorial'

  return (
    <div className={rootClass} style={{ background: content.pageBackground }}>
      {showMesh ? <div className="ppt-beautify-full-content-mesh" style={{ background: content.meshDecoration }} aria-hidden="true" /> : null}
      {!compact && showMesh ? (
        <>
          <div className="ppt-beautify-full-deco-ring ppt-beautify-full-deco-ring-a" style={{ borderColor: preview.accent }} aria-hidden="true" />
          <div className="ppt-beautify-full-deco-ring ppt-beautify-full-deco-ring-b" style={{ background: `${preview.accent}33` }} aria-hidden="true" />
        </>
      ) : null}
      {showAccentBar ? <div className="ppt-beautify-accent-bar" style={{ background: preview.accent }} aria-hidden="true" /> : null}

      {style === 'side-rail' ? (
        <div className="ppt-beautify-full-side-rail" style={{ background: content.headerBackground }}>
          <h3 style={{ color: content.headerTitleColor }}>{display.title || '正文标题'}</h3>
        </div>
      ) : style === 'editorial' ? (
        <div className="ppt-beautify-full-content-header editorial">
          <span className="ppt-beautify-full-editorial-rule" style={{ background: preview.accent }} aria-hidden="true" />
          <h3 style={{ color: content.primaryColor }}>{display.title || '正文标题'}</h3>
        </div>
      ) : style === 'tech-angular' ? (
        <div className="ppt-beautify-full-content-header tech" style={{ background: content.headerBackground }}>
          <span className="ppt-beautify-full-tech-tag" style={{ color: preview.accent }}>
            // SLIDE
          </span>
          <div className="ppt-beautify-full-tech-accent" style={{ background: preview.accent }} aria-hidden="true" />
          <h3 style={{ color: content.headerTitleColor }}>{display.title || '正文标题'}</h3>
        </div>
      ) : style === 'magazine' ? (
        <div className="ppt-beautify-full-content-header magazine">
          <span className="ppt-beautify-full-magazine-strip" style={{ background: preview.accent }} aria-hidden="true" />
          <h3 style={{ color: content.primaryColor }}>{display.title || '正文标题'}</h3>
          <span className="ppt-beautify-full-magazine-rule" style={{ background: preview.accent }} aria-hidden="true" />
        </div>
      ) : style === 'split-panel' ? (
        <div className="ppt-beautify-full-content-header split">
          <span className="ppt-beautify-full-split-pill" style={{ background: content.headerBackground, color: content.headerTitleColor }}>
            {display.title || '正文标题'}
          </span>
          <span className="ppt-beautify-full-split-line" style={{ background: preview.accent }} aria-hidden="true" />
        </div>
      ) : (
        <div className="ppt-beautify-full-content-header" style={{ background: content.headerBackground }}>
          <div className="ppt-beautify-full-content-header-shine" aria-hidden="true" />
          <div className="ppt-beautify-full-content-header-line" style={{ background: preview.accent }} aria-hidden="true" />
          {!compact ? <span className="ppt-beautify-full-content-tag">KEY POINTS</span> : null}
          <h3 style={{ color: content.headerTitleColor }}>{display.title || '正文标题'}</h3>
        </div>
      )}

      <div className="ppt-beautify-full-content-main">
        <div
          className={`ppt-beautify-full-content-card${showCard ? '' : ' editorial-flow'}`}
          style={{
            background: showCard ? content.bodyBackground : 'transparent',
            borderColor: content.cardBorder,
            boxShadow: compact || !showCard ? undefined : `0 12px 32px ${content.primaryColor}18, 0 2px 8px rgba(15,23,42,0.06)`,
          }}
        >
          <BulletList bullets={bullets} theme={theme} style={style} />
        </div>
      </div>

      {!compact ? (
        <div
          className={`ppt-beautify-full-content-footer${style === 'editorial' ? ' editorial' : ''}${style === 'side-rail' ? ' side-rail' : ''}`}
          style={style === 'editorial' ? undefined : { background: content.headerBackground }}
        >
          {style !== 'editorial' ? (
            <span className="ppt-beautify-full-footer-line" style={{ background: preview.accent }} aria-hidden="true" />
          ) : null}
          {pageNumber ? (
            <span
              className="ppt-beautify-full-page-pill"
              style={{
                color: style === 'editorial' ? content.bodyColor : content.headerTitleColor,
              }}
            >
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
  const content = preview.content
  const style = theme.layoutStyle
  const rootClass = [
    'ppt-beautify-slide',
    'ppt-beautify-full-slide',
    layoutClass(style),
    compact ? 'compact' : '',
    capture ? 'ppt-beautify-slide-capture' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (layout === 'title') {
    const isHero = style === 'hero-center' || style === 'gala-gold'
    const isSplit = style === 'split-panel'
    const isEditorial = style === 'editorial'
    const isMagazine = style === 'magazine'

    return (
      <div
        className={`${rootClass} ppt-beautify-cover-slide`}
        style={{ background: isEditorial ? content.pageBackground : isSplit ? content.pageBackground : preview.background }}
      >
        {preview.decoration && !isSplit ? (
          <div className="ppt-beautify-slide-decoration" style={{ background: preview.decoration }} aria-hidden="true" />
        ) : null}
        {isSplit ? (
          <>
            <div className="ppt-beautify-cover-split-left" style={{ background: content.headerBackground }} aria-hidden="true" />
            <div className="ppt-beautify-cover-split-accent" style={{ background: preview.accent }} aria-hidden="true" />
          </>
        ) : null}
        {isMagazine ? <div className="ppt-beautify-cover-magazine-band" style={{ background: content.headerBackground }} aria-hidden="true" /> : null}
        {isHero ? (
          <>
            <div className="ppt-beautify-cover-hero-orb ppt-beautify-cover-hero-orb-a" style={{ background: `${preview.accent}33` }} aria-hidden="true" />
            {style === 'gala-gold' ? (
              <>
                <div className="ppt-beautify-cover-gala-line ppt-beautify-cover-gala-line-a" style={{ background: preview.accent }} aria-hidden="true" />
                <div className="ppt-beautify-cover-gala-line ppt-beautify-cover-gala-line-b" style={{ background: preview.accent }} aria-hidden="true" />
              </>
            ) : null}
          </>
        ) : null}
        {!isHero && !isEditorial && !isSplit ? (
          <div className="ppt-beautify-accent-bar" style={{ background: preview.accent }} aria-hidden="true" />
        ) : null}
        {isEditorial ? (
          <span className="ppt-beautify-cover-editorial-mark" style={{ background: preview.accent }} aria-hidden="true" />
        ) : null}
        {!compact && !isHero && !isEditorial && theme.id !== 'minimal-gray' ? (
          <div className="ppt-beautify-full-footer-band" style={{ background: preview.accent, opacity: 0.35 }} aria-hidden="true" />
        ) : null}
        <div className={`ppt-beautify-themed-inner${isHero ? ' centered' : ''}${isSplit ? ' split-right' : ''}${isMagazine ? ' magazine' : ''}`}>
          <h2 style={{ color: isSplit || isEditorial ? content.primaryColor : preview.titleColor }}>{display.title || '主标题'}</h2>
          {display.subtitle ? (
            <p style={{ color: isSplit || isEditorial ? content.bodyColor : preview.subtitleColor }}>{display.subtitle}</p>
          ) : (
            <p style={{ color: isSplit || isEditorial ? content.bodyColor : preview.subtitleColor, opacity: 0.45 }}>副标题</p>
          )}
          <div className="ppt-beautify-themed-footer" style={{ color: isEditorial ? content.bodyColor : preview.footerColor }}>
            <span>{display.author || '汇报人'}</span>
            <span>{display.date || '2025.01.01'}</span>
          </div>
        </div>
      </div>
    )
  }

  if (layout === 'section' || layout === 'closing') {
    const isHero = style === 'hero-center' || style === 'gala-gold'
    const isSplit = style === 'split-panel'
    const isEditorial = style === 'editorial'

    return (
      <div
        className={`${rootClass} ppt-beautify-section-slide`}
        style={{ background: isEditorial ? content.pageBackground : preview.background }}
      >
        {!isHero && !isSplit && !isEditorial ? (
          <div className="ppt-beautify-accent-bar" style={{ background: preview.accent }} aria-hidden="true" />
        ) : null}
        {isSplit ? <div className="ppt-beautify-section-split-panel" style={{ background: content.headerBackground }} aria-hidden="true" /> : null}
        {layout === 'section' && !isHero && !isSplit && !isEditorial ? (
          <div className="ppt-beautify-full-section-accent" style={{ background: preview.accent }} aria-hidden="true" />
        ) : null}
        {isHero ? <div className="ppt-beautify-section-hero-ring" style={{ borderColor: preview.accent }} aria-hidden="true" /> : null}
        {isEditorial ? <span className="ppt-beautify-section-editorial-label" style={{ color: preview.accent }}>SECTION</span> : null}
        <div className={`ppt-beautify-full-section-inner${isHero ? ' centered' : ''}${isSplit ? ' split' : ''}${isEditorial ? ' editorial' : ''}`}>
          <h2 style={{ color: isEditorial ? content.primaryColor : preview.titleColor }}>
            {display.title || (layout === 'closing' ? '谢谢聆听' : '章节标题')}
          </h2>
          {display.bullets[0] ? (
            <p style={{ color: isEditorial ? content.bodyColor : preview.subtitleColor }}>{display.bullets[0]}</p>
          ) : null}
          {layout === 'closing' ? (
            <p className="ppt-beautify-full-closing-en" style={{ color: isEditorial ? content.bodyColor : preview.subtitleColor }}>
              Thank You
            </p>
          ) : null}
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
