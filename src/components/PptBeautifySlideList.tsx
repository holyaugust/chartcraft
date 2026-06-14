import type { PresentationSlideLayout } from '../types/presentation'

import { PPT_LAYOUT_LABELS } from '../utils/pptBeautifyFull'

import type { ImportedPptxSlide } from '../utils/pptxImport'



interface PptBeautifySlideListProps {

  slides: ImportedPptxSlide[]

  layoutOverrides?: Partial<Record<number, PresentationSlideLayout>>

  onLayoutChange?: (slideIndex: number, layout: PresentationSlideLayout) => void

}



export default function PptBeautifySlideList({

  slides,

  layoutOverrides,

  onLayoutChange,

}: PptBeautifySlideListProps) {

  if (slides.length === 0) {

    return <p className="ppt-beautify-slide-empty">上传 PPT 后将在此显示每页识别结果</p>

  }



  return (

    <div className="ppt-beautify-slide-list">

      <div className="ppt-beautify-slide-list-head" aria-hidden="true">

        <span>页码</span>

        <span>识别版式</span>

        <span>内容摘要</span>

      </div>

      <ul>

        {slides.map((slide) => {

          const layout = layoutOverrides?.[slide.index] ?? slide.suggestedLayout

          const preview = slide.texts.slice(0, 2).join(' · ') || '（无文字）'

          return (

            <li key={slide.index} className="ppt-beautify-slide-row">

              <span className="ppt-beautify-slide-num">第 {slide.index + 1} 页</span>

              {onLayoutChange ? (

                <select

                  className="ppt-beautify-slide-layout-select"

                  value={layout}

                  aria-label={`第 ${slide.index + 1} 页版式`}

                  onChange={(e) => onLayoutChange(slide.index, e.target.value as PresentationSlideLayout)}

                >

                  {(['title', 'section', 'content', 'closing'] as PresentationSlideLayout[]).map((item) => (

                    <option key={item} value={item}>

                      {PPT_LAYOUT_LABELS[item]}

                    </option>

                  ))}

                </select>

              ) : (

                <span className={`ppt-beautify-slide-badge layout-${layout}`}>{PPT_LAYOUT_LABELS[layout]}</span>

              )}

              <span className="ppt-beautify-slide-preview" title={slide.texts.join('\n')}>

                {preview}

              </span>

            </li>

          )

        })}

      </ul>

    </div>

  )

}


