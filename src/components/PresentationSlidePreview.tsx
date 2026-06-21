import { useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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

function SlideFrame({
  slide,
  outline,
  template,
  variant,
  maxBullets,
}: {
  slide: PresentationSlide
  outline: PresentationOutline
  template: PresentationTemplate
  variant: 'main' | 'thumb'
  maxBullets?: number
}) {
  const { primaryColor, accentColor, backgroundColor } = template.theme
  const frameClass = `presentation-slide-frame presentation-slide-frame-${variant}`
  const bullets = slide.bullets ?? []
  const visibleBullets = maxBullets ? bullets.slice(0, maxBullets) : bullets

  if (slide.layout === 'title') {
    return (
      <div className={frameClass} style={{ background: '#FFFFFF' }}>
        <div className="presentation-slide-title-band" style={{ background: `#${primaryColor}` }}>
          <div className="presentation-slide-gold-line" style={{ background: `#${accentColor}` }} />
          <h4 style={{ color: '#fff' }}>{outline.title}</h4>
          {outline.subtitle ? <p className="presentation-slide-sub">{outline.subtitle}</p> : null}
        </div>
      </div>
    )
  }

  if (slide.layout === 'section') {
    return (
      <div className={`${frameClass} presentation-slide-section`} style={{ background: `#${primaryColor}` }}>
        <div className="presentation-slide-section-line" style={{ background: `#${accentColor}` }} />
        <h4 style={{ color: '#fff' }}>{slide.title}</h4>
      </div>
    )
  }

  if (slide.layout === 'closing') {
    return (
      <div className={`${frameClass} presentation-slide-closing`} style={{ background: `#${primaryColor}` }}>
        <h4 style={{ color: '#fff' }}>{slide.title || '谢谢'}</h4>
      </div>
    )
  }

  if (slide.layout === 'chart') {
    return (
      <div className={frameClass} style={{ background: '#FFFFFF' }}>
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
    )
  }

  return (
    <div className={frameClass} style={{ background: `#${backgroundColor}` }}>
      <div className="presentation-slide-header" style={{ background: `#${primaryColor}` }}>
        <div className="presentation-slide-gold-line" style={{ background: `#${accentColor}` }} />
        <h4 style={{ color: '#fff' }}>{slide.title}</h4>
      </div>
      <div className="presentation-slide-body-card">
        <ul>
          {visibleBullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function PresentationSlidePreview({
  outline,
  template,
  activeIndex,
  onSelect,
}: PresentationSlidePreviewProps) {
  const stripRef = useRef<HTMLDivElement>(null)
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([])

  const activeSlide = outline.slides[activeIndex] ?? outline.slides[0]
  const safeIndex = activeSlide ? activeIndex : 0

  useEffect(() => {
    thumbRefs.current[safeIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [safeIndex])

  const scrollStrip = (direction: 'left' | 'right') => {
    const strip = stripRef.current
    if (!strip) return
    const amount = Math.max(strip.clientWidth * 0.75, 200)
    strip.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  if (!activeSlide) return null

  return (
    <div className="presentation-slide-preview presentation-slide-preview-stage">
      <div className="presentation-slide-preview-main">
        <div className="presentation-slide-preview-main-caption">
          <span className="presentation-slide-preview-page-no">
            第 {safeIndex + 1} / {outline.slides.length} 页
          </span>
          <span className="presentation-slide-preview-page-type">{layoutLabel(activeSlide.layout)}</span>
          <strong>{activeSlide.title || outline.title}</strong>
        </div>
        <SlideFrame slide={activeSlide} outline={outline} template={template} variant="main" />
      </div>

      <div className="presentation-slide-preview-filmstrip">
        <button
          type="button"
          className="presentation-slide-preview-nav"
          aria-label="向左浏览缩略图"
          onClick={() => scrollStrip('left')}
        >
          <ChevronLeft size={18} />
        </button>

        <div className="presentation-slide-preview-strip" ref={stripRef}>
          {outline.slides.map((slide, index) => (
            <button
              key={`${index}-${slide.title}`}
              type="button"
              ref={(node) => {
                thumbRefs.current[index] = node
              }}
              className={`presentation-slide-thumb${index === safeIndex ? ' active' : ''}`}
              aria-label={`第 ${index + 1} 页：${slide.title}`}
              aria-current={index === safeIndex ? 'true' : undefined}
              onClick={() => onSelect(index)}
            >
              <SlideFrame
                slide={slide}
                outline={outline}
                template={template}
                variant="thumb"
                maxBullets={3}
              />
              <span className="presentation-slide-meta">
                {index + 1}. {layoutLabel(slide.layout)}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="presentation-slide-preview-nav"
          aria-label="向右浏览缩略图"
          onClick={() => scrollStrip('right')}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}
