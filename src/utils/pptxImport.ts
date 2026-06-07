import JSZip from 'jszip'
import { applyTextsToSlideXml, combineSlideTexts, extractTextsFromSlideXml } from './pptxTextExtract'
import type { PresentationOutline, PresentationSlide } from '../types/presentation'

export interface ImportedPptxSlide {
  index: number
  filePath: string
  texts: string[]
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
    slides.push({
      index,
      filePath,
      texts: extractTextsFromSlideXml(xml),
    })
  }

  const combinedText = combineSlideTexts(slides)
  if (!combinedText.trim()) {
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

function slideTexts(
  outlineSlide: PresentationSlide,
  outline: PresentationOutline,
): { title: string; bullets: string[] } {
  const bullets = (outlineSlide.bullets ?? []).map((item) => String(item ?? '').trim()).filter(Boolean)

  if (outlineSlide.layout === 'title') {
    return {
      title: String(outline.title || outlineSlide.title || '工作汇报').trim(),
      bullets: outline.subtitle ? [String(outline.subtitle).trim()] : bullets,
    }
  }
  if (outlineSlide.layout === 'section' || outlineSlide.layout === 'closing') {
    return { title: String(outlineSlide.title ?? '').trim(), bullets }
  }
  if (outlineSlide.layout === 'chart') {
    return { title: String(outlineSlide.title ?? '数据分析图表').trim(), bullets }
  }
  return {
    title: String(outlineSlide.title ?? '').trim(),
    bullets,
  }
}

/** 将大纲文本写回已上传 pptx，保留原模板版式 */
export async function exportPptxWriteBack(
  originalBuffer: ArrayBuffer,
  outline: PresentationOutline,
): Promise<{ blob: Blob; updatedCount: number; skippedCount: number }> {
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
    const { title, bullets } = slideTexts(outline.slides[i], outline)
    const nextXml = applyTextsToSlideXml(xml, title, bullets)
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
  }
}
