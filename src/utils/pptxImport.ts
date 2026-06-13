import JSZip from 'jszip'
import {
  applySlideTextPlanToXml,
  combineSlideTexts,
  extractTextsFromSlideXml,
  getSlidePlaceholderSummary,
  type SlideTextWritePlan,
} from './pptxTextExtract'
import type { PresentationOutline, PresentationSlide, PresentationSlideLayout } from '../types/presentation'

export interface ImportedPptxSlide {
  index: number
  filePath: string
  texts: string[]
  suggestedLayout: PresentationSlideLayout
  placeholderTypes: string[]
}

export interface ImportedPptx {
  fileName: string
  arrayBuffer: ArrayBuffer
  slideCount: number
  slides: ImportedPptxSlide[]
  combinedText: string
}

function sortSlidePaths(paths: string[]): string[] {
  return paths.sort((a, b) => {
    const na = Number.parseInt(a.match(/slide(\d+)\.xml/i)?.[1] ?? '0', 10)
    const nb = Number.parseInt(b.match(/slide(\d+)\.xml/i)?.[1] ?? '0', 10)
    return na - nb
  })
}

function classifyTemplateSlide(
  summary: ReturnType<typeof getSlidePlaceholderSummary>,
  index: number,
  totalSlides: number,
): PresentationSlideLayout {
  const placeholders = summary.placeholderTypes
  const joined = summary.texts.join(' ').toLowerCase()

  if (
    placeholders.some((ph) => ph === 'ctrTitle' || ph === 'title') &&
    placeholders.some((ph) => ph === 'subTitle')
  ) {
    return 'title'
  }

  if (index === 0 && placeholders.some((ph) => ph === 'ctrTitle' || ph === 'title')) {
    return 'title'
  }

  if (
    index === totalSlides - 1 &&
    (joined.includes('谢谢') || joined.includes('thank') || joined.includes('聆听') || joined.includes('结束'))
  ) {
    return 'closing'
  }

  if (
    summary.shapeCount <= 2 &&
    summary.texts.length <= 2 &&
    summary.texts.every((line) => line.length <= 24) &&
    !placeholders.some((ph) => ph === 'body' || ph === 'obj')
  ) {
    return 'section'
  }

  if (summary.texts.length >= 4 || placeholders.some((ph) => ph === 'body' || ph === 'obj')) {
    return 'content'
  }

  return index === 0 ? 'title' : 'content'
}

function buildSlideTextPlan(
  outlineSlide: PresentationSlide,
  outline: PresentationOutline,
): SlideTextWritePlan {
  const bullets = (outlineSlide.bullets ?? []).map((item) => String(item ?? '').trim()).filter(Boolean)
  const layout = outlineSlide.layout

  if (layout === 'title') {
    return {
      layout,
      title: String(outline.title || outlineSlide.title || '工作汇报').trim(),
      subtitle: outline.subtitle ? String(outline.subtitle).trim() : undefined,
      bullets: bullets.length > 0 ? bullets : undefined,
      clearUnused: true,
    }
  }

  if (layout === 'section' || layout === 'closing') {
    return {
      layout,
      title: String(outlineSlide.title ?? '').trim(),
      bullets: bullets.length > 0 ? bullets : undefined,
      clearUnused: true,
    }
  }

  if (layout === 'chart') {
    return {
      layout,
      title: String(outlineSlide.title ?? '数据分析图表').trim(),
      bullets: bullets.length > 0 ? bullets : undefined,
      clearUnused: true,
    }
  }

  return {
    layout: 'content',
    title: String(outlineSlide.title ?? '').trim(),
    bullets,
    clearUnused: true,
  }
}

export async function importPptxFile(file: File): Promise<ImportedPptx> {
  const lower = file.name.toLowerCase()
  if (!lower.endsWith('.pptx')) {
    throw new Error('仅支持 .pptx 格式的 PowerPoint 文件')
  }

  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  const slidePaths = sortSlidePaths(
    Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name)),
  )

  if (slidePaths.length === 0) {
    throw new Error('未能识别幻灯片内容，请确认文件未损坏')
  }

  const slides: ImportedPptxSlide[] = []
  for (let index = 0; index < slidePaths.length; index += 1) {
    const filePath = slidePaths[index]
    const entry = zip.file(filePath)
    if (!entry) continue
    const xml = await entry.async('string')
    const summary = getSlidePlaceholderSummary(xml)
    slides.push({
      index,
      filePath,
      texts: summary.texts.length > 0 ? summary.texts : extractTextsFromSlideXml(xml),
      suggestedLayout: classifyTemplateSlide(summary, index, slidePaths.length),
      placeholderTypes: summary.placeholderTypes,
    })
  }

  const combinedText = combineSlideTexts(slides)
  if (!combinedText.trim() && slides.every((slide) => slide.texts.length === 0)) {
    throw new Error('PPT 中没有可识别的文字内容（纯图片页暂不支持提取）')
  }

  return {
    fileName: file.name,
    arrayBuffer,
    slideCount: slides.length,
    slides,
    combinedText,
  }
}

/** 将大纲文本写回已上传 pptx，保留原模板版式 */
export async function exportPptxWriteBack(
  originalBuffer: ArrayBuffer,
  outline: PresentationOutline,
  templateSlides?: ImportedPptxSlide[],
): Promise<{ blob: Blob; updatedCount: number; skippedCount: number; templateSlideCount: number }> {
  const zip = await JSZip.loadAsync(originalBuffer)
  const slidePaths = sortSlidePaths(
    Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name)),
  )

  if (slidePaths.length === 0) {
    throw new Error('原 PPT 中没有可写回的幻灯片')
  }

  const updateCount = Math.min(slidePaths.length, outline.slides.length)
  for (let i = 0; i < updateCount; i += 1) {
    const filePath = slidePaths[i]
    const entry = zip.file(filePath)
    if (!entry) continue

    const xml = await entry.async('string')
    const outlineSlide = outline.slides[i]
    const templateHint = templateSlides?.[i]
    const plan = buildSlideTextPlan(
      templateHint && outlineSlide.layout === 'content'
        ? { ...outlineSlide, layout: templateHint.suggestedLayout }
        : outlineSlide,
      outline,
    )
    const nextXml = applySlideTextPlanToXml(xml, plan)
    zip.file(filePath, nextXml)
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })

  return {
    blob,
    updatedCount: updateCount,
    skippedCount: Math.max(0, outline.slides.length - slidePaths.length),
    templateSlideCount: slidePaths.length,
  }
}

export function buildTemplateStructureHint(slides: ImportedPptxSlide[]): string {
  return slides
    .map((slide) => {
      const sample = slide.texts.slice(0, 3).join(' / ') || '（无示例文字）'
      const placeholders =
        slide.placeholderTypes.length > 0 ? slide.placeholderTypes.join(', ') : '未识别占位符'
      return `第 ${slide.index + 1} 页 · layout=${slide.suggestedLayout} · 占位符=${placeholders} · 示例=${sample}`
    })
    .join('\n')
}
