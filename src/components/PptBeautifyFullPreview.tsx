import type { PptCoverTheme } from '../types/pptBeautify'
import type { PresentationSlideLayout } from '../types/presentation'
import { PPT_LAYOUT_LABELS } from '../utils/pptBeautifyFull'
import type { ImportedPptxSlide } from '../utils/pptxImport'
import FullSlideVisual, { parseSlideDisplay, resolveLayout } from './PptBeautifyFullSlideVisual'

interface PptBeautifyFullPreviewProps {
  slides: ImportedPptxSlide[]
  theme: PptCoverTheme
  layoutOverrides?: Partial<Record<number, PresentationSlideLayout>>
  activeIndex: number
  onSelect: (index: number) => void
  enterprisePreview?: boolean
}

export default function PptBeautifyFullPreview({
  slides,
  theme,
  layoutOverrides,
  activeIndex,
  onSelect,
  enterprisePreview = false,
}: PptBeautifyFullPreviewProps) {
  if (slides.length === 0) {
    return (
      <p className="ppt-beautify-slide-empty">
        请先在阶段一生成大纲，或上传 PPT / 等待大纲同步后查看美化预览
      </p>
    )
  }

  const activeSlide = slides[activeIndex] ?? slides[0]
  const activeLayout = activeSlide ? resolveLayout(activeSlide, layoutOverrides) : 'content'
  const activeDisplay = activeSlide ? parseSlideDisplay(activeSlide, activeLayout) : { title: '', bullets: [] }

  return (
    <div className="ppt-beautify-full-preview">
      {enterprisePreview ? (
        <p className="ppt-beautify-full-preview-note">
          企业模板暂无 HTML 预览，下方为近似效果；精确排版请导出后在 PowerPoint / WPS 中查看。
        </p>
      ) : null}

      <div className="ppt-beautify-full-preview-hero">
        <div className="ppt-beautify-full-preview-hero-head">
          <span className="ppt-beautify-full-preview-badge">{PPT_LAYOUT_LABELS[activeLayout]}</span>
          <span>
            第 {activeIndex + 1} 页 / 共 {slides.length} 页 · 主题「{theme.name}」
          </span>
        </div>
        <FullSlideVisual layout={activeLayout} display={activeDisplay} theme={theme} pageNumber={activeIndex + 1} />
      </div>

      <div className="ppt-beautify-full-thumb-grid">
        {slides.map((slide) => {
          const layout = resolveLayout(slide, layoutOverrides)
          const display = parseSlideDisplay(slide, layout)
          return (
            <button
              key={slide.index}
              type="button"
              className={`ppt-beautify-full-thumb${slide.index === activeIndex ? ' active' : ''}`}
              onClick={() => onSelect(slide.index)}
              title={`第 ${slide.index + 1} 页 · ${PPT_LAYOUT_LABELS[layout]}`}
            >
              <FullSlideVisual layout={layout} display={display} theme={theme} compact />
              <span className="ppt-beautify-full-thumb-meta">
                {slide.index + 1}. {PPT_LAYOUT_LABELS[layout]}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
