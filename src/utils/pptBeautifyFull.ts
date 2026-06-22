/**

 * 第二阶段：全文 PPT 美化（按页型映射模板）

 */

import JSZip from 'jszip'

import { PPT_COVER_THEMES } from '../data/pptCoverThemes'

import type { FullBeautifyExportMode, PptCoverContent } from '../types/pptBeautify'

import type { PresentationSlideLayout } from '../types/presentation'

import { loadEnterpriseTemplateBinary, loadEnterpriseTemplateMeta } from './pptBeautifyEnterprise'

import {

  applySlideTextPlanToXml,

  getSlidePlaceholderSummary,

  type SlideTextWritePlan,

} from './pptxTextExtract'

import { importPptxFile, type ImportedPptx, type ImportedPptxSlide } from './pptxImport'



export type FullBeautifyTemplateSource =

  | { kind: 'builtin'; themeId: string }

  | { kind: 'enterprise'; templateId: string }



export interface FullBeautifyOptions {

  /** 页型 → 企业模板 slide 索引（0-based） */

  pageTypeTemplateMap?: Partial<Record<PresentationSlideLayout, number>>

  /** 用户手动覆盖的页型（slideIndex → layout） */

  layoutOverrides?: Partial<Record<number, PresentationSlideLayout>>

}



export interface FullBeautifyResult {

  blob: Blob

  updatedCount: number

  pageTypes: PresentationSlideLayout[]

  templateSlideCount: number

  truncatedCount: number

  warnings: string[]

}



export interface FullBeautifyAnalysis {

  imported: ImportedPptx

  pageTypes: PresentationSlideLayout[]

}



export const PPT_LAYOUT_LABELS: Record<PresentationSlideLayout, string> = {

  title: '标题页',
  section: '章节',
  content: '内容页',

  closing: '致谢',

  chart: '图表',

}



export const FULL_DECK_MAX_SLIDES = 14

/** 全文模板版本号，升级模板后递增以绕过浏览器缓存 */
const FULL_DECK_TEMPLATE_VERSION = '9'

function slideRelPath(slidePath: string): string {
  return slidePath.replace('ppt/slides/', 'ppt/slides/_rels/').replace('.xml', '.xml.rels')
}



const fullDeckCache = new Map<string, ArrayBuffer>()



function sortSlidePaths(paths: string[]): string[] {

  return paths.sort((a, b) => {

    const na = Number.parseInt(a.match(/slide(\d+)/i)?.[1] ?? '0', 10)

    const nb = Number.parseInt(b.match(/slide(\d+)/i)?.[1] ?? '0', 10)

    return na - nb

  })

}



function getSlidePathsFromZip(zip: JSZip): string[] {

  return sortSlidePaths(

    Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name)),

  )

}



export async function loadFullDeckTemplateBuffer(themeId: string): Promise<ArrayBuffer> {

  const cached = fullDeckCache.get(themeId)

  if (cached) return cached.slice(0)



  const theme = PPT_COVER_THEMES.find((item) => item.id === themeId)

  if (!theme) {

    throw new Error(`未找到主题「${themeId}」`)

  }



  const url = `${import.meta.env.BASE_URL}ppt-beautify/full/${theme.id}.pptx?v=${FULL_DECK_TEMPLATE_VERSION}`

  const response = await fetch(url)

  if (!response.ok) {

    throw new Error(`全文模板加载失败：${theme.name}（${response.status}）`)

  }

  const buffer = await response.arrayBuffer()

  fullDeckCache.set(themeId, buffer.slice(0))

  return buffer

}



async function analyzeSlidesFromBuffer(buffer: ArrayBuffer, fileName: string): Promise<ImportedPptx> {

  const file = new File([buffer], fileName, {

    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  })

  return importPptxFile(file)

}



/** 分析上传 PPT 每页建议版式 */

export async function analyzePptxPageTypes(file: File): Promise<FullBeautifyAnalysis> {

  const imported = await importPptxFile(file)

  return {

    imported,

    pageTypes: imported.slides.map((slide) => slide.suggestedLayout),

  }

}



/** 从上传 PPT 第一页提取封面字段 */

export function extractCoverFromSlides(slides: ImportedPptx['slides']): PptCoverContent {

  const first = slides[0]

  const texts = first?.texts ?? []

  return {

    title: texts[0]?.trim() || '',

    subtitle: texts[1]?.trim() || '',

    author: texts[2]?.trim() || '',

    date: texts[3]?.trim() || '',

  }

}



export function buildSlideTextPlanFromImported(slide: ImportedPptxSlide): SlideTextWritePlan {

  const texts = slide.texts.map((line) => line.trim()).filter(Boolean)

  const layout = slide.suggestedLayout



  if (layout === 'title') {

    return {

      layout: slide.index === 0 ? 'cover' : 'title',

      title: texts[0] ?? '',

      subtitle: texts[1],

      author: texts[2],

      date: texts[3],

      clearUnused: texts.length > 0,

    }

  }



  if (layout === 'section' || layout === 'closing') {

    return {

      layout,

      title: texts[0] ?? '',

      bullets: texts.length > 1 ? texts.slice(1) : undefined,

      clearUnused: texts.length > 0,

    }

  }



  const bulletLines = texts.length > 1 ? texts.slice(1, 6) : []

  return {

    layout: 'content',

    title: texts[0] ?? '',

    bullets: bulletLines.length > 0 ? bulletLines : ['要点内容'],

    contentMultiCard: true,

    maxBulletSlots: 5,

    clearUnused: texts.length > 0,

  }

}



function buildTemplatePool(slides: ImportedPptxSlide[]): Map<PresentationSlideLayout, number[]> {

  const pool = new Map<PresentationSlideLayout, number[]>()

  for (const slide of slides) {

    const list = pool.get(slide.suggestedLayout) ?? []

    list.push(slide.index)

    pool.set(slide.suggestedLayout, list)

  }

  return pool

}



function pickTemplateSlideIndex(

  layout: PresentationSlideLayout,

  pool: Map<PresentationSlideLayout, number[]>,

  counters: Map<PresentationSlideLayout, number>,

  explicitMap?: FullBeautifyOptions['pageTypeTemplateMap'],

): number {

  if (explicitMap?.[layout] !== undefined) {

    return explicitMap[layout]!

  }



  const fallbackOrder: PresentationSlideLayout[] =

    layout === 'chart' ? ['chart', 'content'] : [layout, 'content', 'section', 'title']



  let candidates: number[] = []

  for (const key of fallbackOrder) {

    const list = pool.get(key)

    if (list && list.length > 0) {

      candidates = list

      break

    }

  }



  if (candidates.length === 0) {

    return 0

  }



  const counter = counters.get(layout) ?? 0

  const picked = candidates[counter % candidates.length]!

  counters.set(layout, counter + 1)

  return picked

}



async function trimPptxToSlideCount(zip: JSZip, slideCount: number): Promise<void> {

  const slidePaths = getSlidePathsFromZip(zip)

  if (slideCount >= slidePaths.length) return



  for (const path of slidePaths.slice(slideCount)) {

    zip.remove(path)

    const relPath = path.replace('ppt/slides/', 'ppt/slides/_rels/').replace('.xml', '.xml.rels')

    if (zip.files[relPath]) {

      zip.remove(relPath)

    }

  }



  const presPath = 'ppt/presentation.xml'

  const presEntry = zip.file(presPath)

  if (!presEntry) return



  let presXml = await presEntry.async('string')

  const sldIdPattern = /<p:sldId\b[^>]*\/>/gi

  const matches = [...presXml.matchAll(sldIdPattern)]

  if (matches.length > slideCount) {

    const removeSet = new Set(matches.slice(slideCount).map((match) => match[0]))

    presXml = presXml.replace(sldIdPattern, (segment) => (removeSet.has(segment) ? '' : segment))

    zip.file(presPath, presXml)

  }



  const ctPath = '[Content_Types].xml'

  const ctEntry = zip.file(ctPath)

  if (ctEntry) {

    let ctXml = await ctEntry.async('string')

    for (const path of slidePaths.slice(slideCount)) {

      const partName = `/${path}`

      const overridePattern = new RegExp(

        `<Override[^>]*PartName="${partName.replace(/\//g, '\\/')}"[^>]*/>`,

        'gi',

      )

      ctXml = ctXml.replace(overridePattern, '')

    }

    zip.file(ctPath, ctXml)

  }



  const presRelPath = 'ppt/_rels/presentation.xml.rels'

  const presRelEntry = zip.file(presRelPath)

  if (presRelEntry) {

    let relXml = await presRelEntry.async('string')

    const relPattern = /<Relationship\b[^>]*\/>/gi

    const relMatches = [...relXml.matchAll(relPattern)]

    const slideRels = relMatches.filter((match) => /Type="[^"]*\/slide"/i.test(match[0]))

    if (slideRels.length > slideCount) {

      const removeRels = new Set(slideRels.slice(slideCount).map((match) => match[0]))

      relXml = relXml.replace(relPattern, (segment) => (removeRels.has(segment) ? '' : segment))

      zip.file(presRelPath, relXml)

    }

  }

}



async function loadTemplateImported(source: FullBeautifyTemplateSource): Promise<ImportedPptx> {

  if (source.kind === 'builtin') {

    const buffer = await loadFullDeckTemplateBuffer(source.themeId)

    return analyzeSlidesFromBuffer(buffer, `${source.themeId}.pptx`)

  }



  const meta = loadEnterpriseTemplateMeta().find((item) => item.id === source.templateId)

  if (!meta) {

    throw new Error('企业模板不存在或已被删除')

  }

  const buffer = await loadEnterpriseTemplateBinary(source.templateId)

  if (!buffer) {

    throw new Error(`无法读取企业模板「${meta.name}」`)

  }

  return analyzeSlidesFromBuffer(buffer, meta.fileName)

}



async function loadTemplateBuffer(source: FullBeautifyTemplateSource): Promise<ArrayBuffer> {

  if (source.kind === 'builtin') {

    return loadFullDeckTemplateBuffer(source.themeId)

  }

  const buffer = await loadEnterpriseTemplateBinary(source.templateId)

  if (!buffer) {

    throw new Error('企业模板二进制数据缺失')

  }

  return buffer.slice(0)

}



/** 第二阶段入口：按页型映射模板并导出全文美化 pptx */

export async function exportFullBeautifiedPptx(

  source: ImportedPptx,

  templateSource: FullBeautifyTemplateSource,

  options?: FullBeautifyOptions,

): Promise<FullBeautifyResult> {

  const warnings: string[] = []

  const sourceSlides = source.slides.map((slide, index) => {

    const override = options?.layoutOverrides?.[index]

    if (!override) return slide

    return { ...slide, suggestedLayout: override }

  })



  const sourceCount = sourceSlides.length

  let outputCount = sourceCount



  const templateImported = await loadTemplateImported(templateSource)

  const templateBuffer = await loadTemplateBuffer(templateSource)

  const templatePool = buildTemplatePool(templateImported.slides)

  const counters = new Map<PresentationSlideLayout, number>()



  const zip = await JSZip.loadAsync(templateBuffer)

  const templateSlidePaths = getSlidePathsFromZip(zip)



  if (templateSlidePaths.length === 0) {

    throw new Error('模板 PPT 中没有可用幻灯片')

  }



  if (sourceCount > templateSlidePaths.length) {

    outputCount = templateSlidePaths.length

    warnings.push(

      `源文件共 ${sourceCount} 页，模板最多支持 ${templateSlidePaths.length} 页，已美化前 ${outputCount} 页`,

    )

  }



  const templateXmlCache = new Map<number, string>()
  const templateRelCache = new Map<number, string>()

  for (let i = 0; i < templateImported.slides.length; i += 1) {

    const path = templateSlidePaths[i]

    if (!path) continue

    const entry = zip.file(path)

    if (entry) {

      templateXmlCache.set(i, await entry.async('string'))

    }

    const relPath = slideRelPath(path)
    const relEntry = zip.file(relPath)
    if (relEntry) {
      templateRelCache.set(i, await relEntry.async('string'))
    }

  }



  let updatedCount = 0

  const pageTypes: PresentationSlideLayout[] = []



  for (let i = 0; i < outputCount; i += 1) {

    const sourceSlide = sourceSlides[i]!

    const layout = sourceSlide.suggestedLayout

    pageTypes.push(layout)



    const templateIndex = pickTemplateSlideIndex(layout, templatePool, counters, options?.pageTypeTemplateMap)

    const templateXml = templateXmlCache.get(templateIndex)

    if (!templateXml) {

      warnings.push(`第 ${i + 1} 页未找到匹配的模板页，已跳过`)

      continue

    }



    const plan: SlideTextWritePlan = {
      ...buildSlideTextPlanFromImported(sourceSlide),
      ...(layout === 'content' ? { pageNumber: i + 1 } : {}),
    }

    const nextXml = applySlideTextPlanToXml(templateXml, plan)

    const outputPath = templateSlidePaths[i]!

    zip.file(outputPath, nextXml)

    const templateRel = templateRelCache.get(templateIndex)
    if (templateRel) {
      zip.file(slideRelPath(outputPath), templateRel)
    }

    updatedCount += 1

  }



  if (outputCount < templateSlidePaths.length) {

    await trimPptxToSlideCount(zip, outputCount)

  }



  const blob = await zip.generateAsync({

    type: 'blob',

    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',

  })



  return {

    blob,

    updatedCount,

    pageTypes,

    templateSlideCount: templateSlidePaths.length,

    truncatedCount: Math.max(0, sourceCount - outputCount),

    warnings,

  }

}



/** 预览用：读取单页占位符摘要 */

export async function readSlideSummaryFromBuffer(buffer: ArrayBuffer, slideIndex = 0): Promise<string[]> {

  const zip = await JSZip.loadAsync(buffer)

  const slidePaths = getSlidePathsFromZip(zip)

  const path = slidePaths[slideIndex]

  if (!path) return []

  const xml = await zip.file(path)!.async('string')

  return getSlidePlaceholderSummary(xml).texts

}



export function buildFullBeautifyFileName(
  sourceName: string,
  themeId: string,
  mode: FullBeautifyExportMode = 'editable',
): string {
  const base = sourceName.replace(/\.pptx$/i, '').replace(/[\\/:*?"<>|]/g, '_').slice(0, 36)
  if (mode === 'visual') {
    return `${base}-全文美化-高保真-${themeId}.pptx`
  }
  return `${base}-全文美化-${themeId}.pptx`
}



/** 将 AI 大纲转为全文美化可用的 slide 结构 */
export function outlineToImportedPptx(
  outline: import('../types/presentation').PresentationOutline,
  fileName?: string,
): ImportedPptx {
  const slides: ImportedPptxSlide[] = outline.slides.map((slide, index) => {
    const texts: string[] = []
    if (slide.layout === 'title') {
      texts.push(outline.title)
      if (outline.subtitle) texts.push(outline.subtitle)
      if (slide.bullets?.[0]) texts.push(slide.bullets[0])
      if (slide.bullets?.[1]) texts.push(slide.bullets[1])
    } else {
      texts.push(slide.title)
      if (slide.bullets?.length) texts.push(...slide.bullets)
    }

    const suggestedLayout =
      slide.layout === 'chart' ? 'content' : (slide.layout as ImportedPptxSlide['suggestedLayout'])

    return {
      index,
      filePath: `ppt/slides/slide${index + 1}.xml`,
      texts,
      suggestedLayout,
      placeholderTypes: [],
    }
  })

  return {
    fileName: fileName ?? `${outline.title.replace(/[\\/:*?"<>|]/g, '_')}.pptx`,
    arrayBuffer: new ArrayBuffer(0),
    slideCount: slides.length,
    slides,
    combinedText: slides.map((s, i) => `【第 ${i + 1} 页】\n${s.texts.join('\n')}`).join('\n\n'),
  }
}



export const PPT_LAYOUT_OPTIONS: PresentationSlideLayout[] = ['title', 'section', 'content', 'closing']


