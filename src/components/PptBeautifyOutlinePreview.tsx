import { Loader2 } from 'lucide-react'

import PresentationSlidePreview from './PresentationSlidePreview'

import type { PresentationOutline } from '../types/presentation'
import type { PresentationTemplate } from '../types/presentation'
import { outlineToPreviewText, previewTextToOutline } from '../utils/presentationWrite'

interface PptBeautifyOutlinePreviewProps {
  busy: boolean
  outline: PresentationOutline | null
  previewText: string
  viewMode: 'preview' | 'text'
  onViewModeChange: (mode: 'preview' | 'text') => void
  onPreviewTextChange: (text: string) => void
  onOutlineChange: (outline: PresentationOutline) => void
  activeSlideIndex: number
  onActiveSlideIndexChange: (index: number) => void
  previewTemplate: PresentationTemplate
  loadingMessage?: string
  emptyMessage?: string
}

export default function PptBeautifyOutlinePreview({
  busy,
  outline,
  previewText,
  viewMode,
  onViewModeChange,
  onPreviewTextChange,
  onOutlineChange,
  activeSlideIndex,
  onActiveSlideIndexChange,
  previewTemplate,
  loadingMessage = '正在生成 PPT 大纲，请稍候…',
  emptyMessage = '切换到此视图后将根据材料自动生成大纲',
}: PptBeautifyOutlinePreviewProps) {
  const handlePreviewTextChange = (text: string) => {
    onPreviewTextChange(text)
    const parsed = previewTextToOutline(text)
    if (parsed) onOutlineChange(parsed)
  }

  return (
    <>
      <div className="ppt-beautify-outline-toolbar ppt-beautify-template-outline-toolbar">
        <h4>PPT 大纲{outline ? ` · ${outline.slides.length} 页` : ''}</h4>
        <div className="ppt-beautify-outline-view-toggle">
          <button
            type="button"
            className={viewMode === 'preview' ? 'active' : ''}
            disabled={!outline}
            onClick={() => onViewModeChange('preview')}
          >
            卡片预览
          </button>
          <button
            type="button"
            className={viewMode === 'text' ? 'active' : ''}
            disabled={!outline}
            onClick={() => onViewModeChange('text')}
          >
            文本编辑
          </button>
        </div>
      </div>

      {busy && !outline ? (
        <div className="ppt-beautify-slide-empty ppt-beautify-outline-loading">
          <Loader2 size={28} className="spin" />
          <p>{loadingMessage}</p>
        </div>
      ) : !outline ? (
        <p className="ppt-beautify-slide-empty">{emptyMessage}</p>
      ) : viewMode === 'preview' ? (
        <PresentationSlidePreview
          outline={outline}
          template={previewTemplate}
          activeIndex={activeSlideIndex}
          onSelect={onActiveSlideIndexChange}
        />
      ) : (
        <textarea
          className="ppt-beautify-outline-text"
          value={previewText || outlineToPreviewText(outline)}
          onChange={(e) => handlePreviewTextChange(e.target.value)}
        />
      )}
    </>
  )
}
