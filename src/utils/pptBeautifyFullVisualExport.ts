import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import html2canvas from 'html2canvas'

import FullSlideVisual, { parseSlideDisplay, resolveLayout } from '../components/PptBeautifyFullSlideVisual'
import { PPT_COVER_THEMES } from '../data/pptCoverThemes'
import type { PptCoverTheme } from '../types/pptBeautify'
import type { PresentationSlideLayout } from '../types/presentation'
import type { FullBeautifyResult } from './pptBeautifyFull'
import type { ImportedPptx } from './pptxImport'

export const FULL_VISUAL_CAPTURE_WIDTH = 1280
export const FULL_VISUAL_CAPTURE_HEIGHT = 720
export const FULL_VISUAL_CAPTURE_SCALE = 2

export interface FullVisualExportOptions {
  layoutOverrides?: Partial<Record<number, PresentationSlideLayout>>
  onProgress?: (current: number, total: number) => void
}

async function loadPptxGen() {
  const { default: PptxGen } = await import('pptxgenjs')
  return PptxGen
}

async function waitForPaint() {
  await document.fonts.ready
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

async function captureElementToDataUrl(element: HTMLElement): Promise<string> {
  const canvas = await html2canvas(element, {
    scale: FULL_VISUAL_CAPTURE_SCALE,
    backgroundColor: null,
    useCORS: true,
    logging: false,
    width: FULL_VISUAL_CAPTURE_WIDTH,
    height: FULL_VISUAL_CAPTURE_HEIGHT,
    windowWidth: FULL_VISUAL_CAPTURE_WIDTH,
    windowHeight: FULL_VISUAL_CAPTURE_HEIGHT,
  })

  const dataUrl = canvas.toDataURL('image/png')
  if (!dataUrl || dataUrl.length < 100) {
    throw new Error('幻灯片截图失败')
  }
  return dataUrl
}

async function captureSlideVisual(
  layout: PresentationSlideLayout,
  display: ReturnType<typeof parseSlideDisplay>,
  theme: PptCoverTheme,
  pageNumber?: number,
): Promise<string> {
  const host = document.createElement('div')
  host.className = 'ppt-beautify-capture-host'
  host.style.cssText = [
    'position:fixed',
    'left:-12000px',
    'top:0',
    `width:${FULL_VISUAL_CAPTURE_WIDTH}px`,
    `height:${FULL_VISUAL_CAPTURE_HEIGHT}px`,
    'overflow:hidden',
    'pointer-events:none',
  ].join(';')
  document.body.appendChild(host)

  const root = createRoot(host)
  try {
    flushSync(() => {
      root.render(
        createElement(FullSlideVisual, {
          layout,
          display,
          theme,
          capture: true,
          pageNumber,
        }),
      )
    })

    await waitForPaint()

    const slideEl = host.querySelector('.ppt-beautify-slide')
    if (!slideEl || !(slideEl instanceof HTMLElement)) {
      throw new Error('幻灯片渲染失败')
    }

    return await captureElementToDataUrl(slideEl)
  } finally {
    root.unmount()
    host.remove()
  }
}

/** 高保真导出：按 HTML 预览逐页截图，生成纯图片幻灯片 */
export async function exportFullBeautifiedVisualPptx(
  source: ImportedPptx,
  themeId: string,
  options?: FullVisualExportOptions,
): Promise<FullBeautifyResult> {
  const theme = PPT_COVER_THEMES.find((item) => item.id === themeId) ?? PPT_COVER_THEMES[0]
  const warnings: string[] = []
  const layoutOverrides = options?.layoutOverrides ?? {}

  const sourceSlides = source.slides.map((slide, index) => {
    const override = layoutOverrides[index]
    if (!override) return slide
    return { ...slide, suggestedLayout: override }
  })

  const outputCount = sourceSlides.length
  if (outputCount === 0) {
    throw new Error('没有可导出的幻灯片')
  }

  if (outputCount > 30) {
    warnings.push(`共 ${outputCount} 页，高保真导出耗时较长，请耐心等待`)
  }

  warnings.push('高保真模式：每页为整页图片，导出后在 PowerPoint 中不可编辑文字')

  const PptxGen = await loadPptxGen()
  const pptx = new PptxGen()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'ChartCraft'
  pptx.title = source.fileName.replace(/\.pptx$/i, '')

  const pageTypes: PresentationSlideLayout[] = []
  let updatedCount = 0

  for (let i = 0; i < outputCount; i += 1) {
    options?.onProgress?.(i + 1, outputCount)

    const sourceSlide = sourceSlides[i]!
    const layout = resolveLayout(sourceSlide, layoutOverrides)
    pageTypes.push(layout)

    const display = parseSlideDisplay(sourceSlide, layout)
    const pageNumber = layout === 'content' ? i + 1 : undefined
    const dataUrl = await captureSlideVisual(layout, display, theme, pageNumber)

    const slide = pptx.addSlide()
    slide.addImage({
      data: dataUrl,
      x: 0,
      y: 0,
      w: 10,
      h: 5.625,
    })

    updatedCount += 1
  }

  const result = await pptx.write({ outputType: 'blob' })
  if (!(result instanceof Blob)) {
    throw new Error('PPT 导出失败')
  }

  return {
    blob: result,
    updatedCount,
    pageTypes,
    templateSlideCount: outputCount,
    truncatedCount: 0,
    warnings,
  }
}
