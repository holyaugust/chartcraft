import { getPresentationTemplateById } from '../data/presentationTemplates'
import type { PresentationOutline, PresentationSlide, PresentationSlideLayout } from '../types/presentation'
import { requestDeepSeekPlainText } from './deepseek'

export interface PresentationTemplateSlideHint {
  index: number
  suggestedLayout: PresentationSlideLayout
  sampleTexts: string[]
  placeholderTypes: string[]
}

export interface PresentationWriteRequest {
  prompt: string
  templateId: string
  sourceDocument?: string
  templateSlideHints?: PresentationTemplateSlideHint[]
}

function buildSystemPrompt(): string {
  return `你是国企汇报 PPT 策划专家，熟悉领导汇报、工作汇报、专题汇报、述职汇报的页结构与表述规范。

输出要求：
1. 只输出一个 JSON 对象，不要 markdown、不要代码块、不要额外解释
2. JSON 结构：
{
  "title": "汇报标题",
  "subtitle": "副标题（单位/日期，可含占位）",
  "slides": [
    {
      "layout": "title|section|content|closing|chart",
      "title": "页标题",
      "bullets": ["要点1", "要点2"],
      "notes": "演讲备注（可选）"
    }
  ]
}
3. layout 说明：title=封面；section=章节过渡页（可无 bullets）；content=正文要点页；closing=致谢/结束；chart=图表页（可无 bullets，标题为图表说明）
4. 正文页 bullets 每页 3～5 条，每条 15～40 字，动词开头、数据化表述
5. 总页数 8～14 页（含封面与结束页）
6. 未定信息用「×××」占位`
}

function buildUserPrompt(request: PresentationWriteRequest): string {
  const template = getPresentationTemplateById(request.templateId)
  const sections: string[] = [
    `汇报需求：${request.prompt.trim()}`,
    `模板类型：${template?.name ?? '工作汇报'}`,
  ]

  if (template?.sceneHint) {
    sections.push(`场景说明：${template.sceneHint}`)
  }
  if (template?.suggestedStructure) {
    sections.push(`建议结构：${template.suggestedStructure}`)
  }

  if (request.sourceDocument?.trim()) {
    const excerpt =
      request.sourceDocument.length > 8000
        ? `${request.sourceDocument.slice(0, 8000)}\n…（已截断）`
        : request.sourceDocument
    sections.push('', '参考材料（提炼要点写入幻灯片，勿照搬无关段落）：', excerpt)
  }

  if (request.templateSlideHints?.length) {
    const hints = request.templateSlideHints
    sections.push(
      '',
      `【重要】已上传 PPT 模板，共 ${hints.length} 页。你必须生成恰好 ${hints.length} 页 slides（不多不少）。`,
      '每一页将按顺序写回对应模板页，请严格按下列页型与占位结构生成：',
    )
    hints.forEach((slide) => {
      const sample = slide.sampleTexts.slice(0, 2).join(' / ') || '无示例文字'
      sections.push(
        `- 第 ${slide.index + 1} 页：layout 必须为 "${slide.suggestedLayout}"；占位符 ${slide.placeholderTypes.join(', ') || '未知'}；原模板示例：${sample}`,
      )
    })
    sections.push(
      '封面页 title 字段写 layout=title 的页标题；subtitle 写副标题；content 页写 bullets；section/closing 页通常只有 title、无 bullets 或仅 1 条。',
    )
  }

  sections.push('', '请生成完整汇报 PPT 的 JSON 大纲。')
  return sections.join('\n')
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim()
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch?.[1]) return fenceMatch[1].trim()

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1)
  }

  return trimmed
}

function normalizeSlide(raw: Partial<PresentationSlide>): PresentationSlide | null {
  const title = raw.title?.trim()
  if (!title) return null

  const layout = raw.layout ?? 'content'
  const validLayouts = new Set(['title', 'section', 'content', 'closing', 'chart'])
  const normalizedLayout = validLayouts.has(layout) ? layout : 'content'

  const bullets = Array.isArray(raw.bullets)
    ? raw.bullets.map((item) => String(item).trim()).filter(Boolean)
    : undefined

  return {
    layout: normalizedLayout as PresentationSlide['layout'],
    title,
    bullets: bullets?.length ? bullets : undefined,
    notes: raw.notes?.trim() || undefined,
    chartImageDataUrl: raw.chartImageDataUrl?.trim() || undefined,
  }
}

export function parsePresentationOutline(raw: string): PresentationOutline {
  const jsonText = extractJsonObject(raw)
  const parsed = JSON.parse(jsonText) as Partial<PresentationOutline>

  const title = parsed.title?.trim() || '工作汇报'
  const slides = (parsed.slides ?? [])
    .map((item) => normalizeSlide(item))
    .filter((item): item is PresentationSlide => item !== null)

  if (slides.length === 0) {
    throw new Error('AI 未返回有效幻灯片结构')
  }

  return {
    title,
    subtitle: parsed.subtitle?.trim() || undefined,
    slides,
  }
}

export async function generatePresentationOutline(
  request: PresentationWriteRequest,
): Promise<PresentationOutline> {
  const raw = await requestDeepSeekPlainText({
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(request),
    temperature: 0.45,
    maxTokens: 8192,
  })

  return parsePresentationOutline(raw)
}

export function outlineToPreviewText(outline: PresentationOutline): string {
  const lines: string[] = [`# ${outline.title}`]
  if (outline.subtitle) lines.push(outline.subtitle)
  lines.push('')

  outline.slides.forEach((slide, index) => {
    lines.push(`## 第 ${index + 1} 页 · ${slide.layout} · ${slide.title}`)
    if (slide.bullets?.length) {
      slide.bullets.forEach((bullet) => lines.push(`- ${bullet}`))
    }
    if (slide.notes) lines.push(`> 备注：${slide.notes}`)
    lines.push('')
  })

  return lines.join('\n').trimEnd()
}

const PREVIEW_HEADING = /^##\s*第\s*(\d+)\s*页\s*·\s*(\w+)\s*·\s*(.+)$/
const PREVIEW_BULLET = /^-\s+(.+)$/
const PREVIEW_NOTE = /^>\s*备注：(.+)$/

/** 将 Markdown 风格大纲文本解析回 JSON 结构（与 outlineToPreviewText 互逆） */
export function previewTextToOutline(text: string, fallbackTitle = '工作汇报'): PresentationOutline | null {
  const lines = text.split('\n')
  let title = fallbackTitle
  let subtitle: string | undefined
  const slides: PresentationSlide[] = []
  let current: PresentationSlide | null = null

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line.trim()) continue

    if (line.startsWith('# ')) {
      title = line.slice(2).trim() || title
      continue
    }

    if (!line.startsWith('## ') && !line.startsWith('- ') && !line.startsWith('> ') && slides.length === 0 && !current) {
      subtitle = line.trim()
      continue
    }

    const headingMatch = line.match(PREVIEW_HEADING)
    if (headingMatch) {
      if (current) slides.push(current)
      const layoutRaw = headingMatch[2]
      const validLayouts = new Set(['title', 'section', 'content', 'closing', 'chart'])
      current = {
        layout: (validLayouts.has(layoutRaw) ? layoutRaw : 'content') as PresentationSlide['layout'],
        title: headingMatch[3].trim(),
        bullets: [],
      }
      continue
    }

    if (!current) continue

    const bulletMatch = line.match(PREVIEW_BULLET)
    if (bulletMatch) {
      current.bullets = [...(current.bullets ?? []), bulletMatch[1].trim()]
      continue
    }

    const noteMatch = line.match(PREVIEW_NOTE)
    if (noteMatch) {
      current.notes = noteMatch[1].trim()
    }
  }

  if (current) slides.push(current)
  if (slides.length === 0) return null

  return {
    title,
    subtitle,
    slides: slides.map((slide) => ({
      ...slide,
      bullets: slide.bullets?.length ? slide.bullets : undefined,
    })),
  }
}

export function parseOutlineFromStorage(outlineJson: string, previewText: string, fallbackTitle?: string): PresentationOutline | null {
  if (outlineJson.trim()) {
    try {
      return parsePresentationOutline(outlineJson)
    } catch {
      /* fall through */
    }
  }
  return previewTextToOutline(previewText, fallbackTitle)
}
