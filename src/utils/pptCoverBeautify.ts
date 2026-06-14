import JSZip from 'jszip'
import { applySlideTextPlanToXml } from './pptxTextExtract'
import type { PptCoverContent } from '../types/pptBeautify'
import type { PptCoverTheme } from '../types/pptBeautify'
import { getPptCoverTheme } from '../data/pptCoverThemes'
import type { ImportedPptx } from './pptxImport'

const templateCache = new Map<string, ArrayBuffer>()

export async function loadCoverTemplateBuffer(theme: PptCoverTheme): Promise<ArrayBuffer> {
  const cached = templateCache.get(theme.id)
  if (cached) return cached.slice(0)

  const url = `${import.meta.env.BASE_URL}ppt-beautify/covers/${theme.templateFile}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`封面模板加载失败：${theme.name}（${response.status}）`)
  }
  const buffer = await response.arrayBuffer()
  templateCache.set(theme.id, buffer.slice(0))
  return buffer
}

export function extractCoverContentFromImportedPptx(imported: ImportedPptx): PptCoverContent {
  const first = imported.slides[0]
  const texts = first?.texts ?? []
  return {
    title: texts[0]?.trim() || '演示文稿',
    subtitle: texts[1]?.trim() || '',
    author: texts[2]?.trim() || '',
    date: texts[3]?.trim() || '',
  }
}

export async function exportBeautifiedCoverPptx(
  content: PptCoverContent,
  themeId: string,
): Promise<Blob> {
  const theme = getPptCoverTheme(themeId) ?? getPptCoverTheme('green-academic')!
  const buffer = await loadCoverTemplateBuffer(theme)
  const zip = await JSZip.loadAsync(buffer)

  const slidePath = Object.keys(zip.files).find((name) => /^ppt\/slides\/slide1\.xml$/i.test(name))
  if (!slidePath) {
    throw new Error('封面模板缺少第一页幻灯片')
  }

  const entry = zip.file(slidePath)
  if (!entry) {
    throw new Error('无法读取封面模板幻灯片')
  }

  const xml = await entry.async('string')
  const nextXml = applySlideTextPlanToXml(xml, {
    layout: 'cover',
    title: content.title.trim() || '演示文稿',
    subtitle: content.subtitle.trim(),
    author: content.author.trim(),
    date: content.date.trim(),
    clearUnused: true,
  })
  zip.file(slidePath, nextXml)

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })
}

export function buildCoverFileName(title: string, themeId: string): string {
  const safe = (title || '封面美化').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40)
  return `${safe}-${themeId}.pptx`
}
