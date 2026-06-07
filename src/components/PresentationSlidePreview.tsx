import type { PresentationOutline, PresentationSlide, PresentationTemplate } from '../types/presentation'

interface PresentationSlidePreviewProps {
  outline: PresentationOutline
  template: PresentationTemplate
  activeIndex: number
  onSelect: (index: number) => void
}

function layoutLabel(layout: PresentationSlide['layout']): string {
  switch (layout) {
    case 'title':
      return '封面'
    case 'section':
      return '章节'
    case 'content':
      return '正文'
    case 'closing':
      return '结束'
    case 'chart':
      return '图表'
    default:
      return layout
  }
}

function SlideCard({
  slide,
  outline,
  template,
  index,
  isActive,
  onSelect,
}: {
  slide: PresentationSlide
  outline: PresentationOutline
  template: PresentationTemplate
  index: number
  isActive: boolean
  onSelect: () => void
}) {
  const { primaryColor, accentColor, backgroundColor } = template.theme

  if (slide.layout === 'title') {
    return (
      <button
        type="button"
        className={`presentation-slide-card${isActive ? ' active' : ''}`}
        onClick={onSelect}
      >
        <div className="presentation-slide-frame" style={{ background: '#FFFFFF' }}>
          <div className="presentation-slide-title-band" style={{ background: `#${primaryColor}` }}>
            <div className="presentation-slide-gold-line" style={{ background: `#${accentColor}` }} />
            <h4 style={{ color: '#fff' }}>{outline.title}</h4>
            {outline.subtitle ? <p className="presentation-slide-sub">{outline.subtitle}</p> : null}
          </div>
        </div>
        <span className="presentation-slide-meta">
          {index + 1}. {layoutLabel(slide.layout)}
        </span>
      </button>
    )
  }

  if (slide.layout === 'section') {
    return (
      <button
        type="button"
        className={`presentation-slide-card${isActive ? ' active' : ''}`}
        onClick={onSelect}
      >
        <div className="presentation-slide-frame presentation-slide-section" style={{ background: `#${primaryColor}` }}>
          <div className="presentation-slide-section-line" style={{ background: `#${accentColor}` }} />
          <h4 style={{ color: '#fff' }}>{slide.title}</h4>
        </div>
        <span className="presentation-slide-meta">
          {index + 1}. {layoutLabel(slide.layout)}
        </span>
      </button>
    )
  }

  if (slide.layout === 'closing') {
    return (
      <button
        type="button"
        className={`presentation-slide-card${isActive ? ' active' : ''}`}
        onClick={onSelect}
      >
        <div className="presentation-slide-frame presentation-slide-closing" style={{ background: `#${primaryColor}` }}>
          <h4 style={{ color: '#fff' }}>{slide.title || '谢谢'}</h4>
        </div>
        <span className="presentation-slide-meta">
          {index + 1}. {layoutLabel(slide.layout)}
        </span>
      </button>
    )
  }

  if (slide.layout === 'chart') {
    return (
      <button
        type="button"
        className={`presentation-slide-card${isActive ? ' active' : ''}`}
        onClick={onSelect}
      >
        <div className="presentation-slide-frame" style={{ background: '#FFFFFF' }}>
          <div className="presentation-slide-header" style={{ background: `#${primaryColor}` }}>
            <div className="presentation-slide-gold-line" style={{ background: `#${accentColor}` }} />
            <h4 style={{ color: '#fff' }}>{slide.title}</h4>
          </div>
          <div className="presentation-slide-chart-area">
            {slide.chartImageDataUrl ? (
              <img src={slide.chartImageDataUrl} alt="" />
            ) : (
              <span>图表占位</span>
            )}
          </div>
        </div>
        <span className="presentation-slide-meta">
          {index + 1}. {layoutLabel(slide.layout)}
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      className={`presentation-slide-card${isActive ? ' active' : ''}`}
      onClick={onSelect}
    >
      <div className="presentation-slide-frame" style={{ background: `#${backgroundColor}` }}>
        <div className="presentation-slide-header" style={{ background: `#${primaryColor}` }}>
          <div className="presentation-slide-gold-line" style={{ background: `#${accentColor}` }} />
          <h4 style={{ color: '#fff' }}>{slide.title}</h4>
        </div>
        <div className="presentation-slide-body-card">
          <ul>
            {(slide.bullets ?? []).slice(0, 4).map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      </div>
      <span className="presentation-slide-meta">
        {index + 1}. {layoutLabel(slide.layout)}
      </span>
    </button>
  )
}

export default function PresentationSlidePreview({
  outline,
  template,
  activeIndex,
  onSelect,
}: PresentationSlidePreviewProps) {
  return (
    <div className="presentation-slide-preview">
      <div className="presentation-slide-preview-grid">
        {outline.slides.map((slide, index) => (
          <SlideCard
            key={`${index}-${slide.title}`}
            slide={slide}
            outline={outline}
            template={template}
            index={index}
            isActive={index === activeIndex}
            onSelect={() => onSelect(index)}
          />
        ))}
      </div>
    </div>
  )
}
