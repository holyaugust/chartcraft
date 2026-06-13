import type { SmartGraphicColumnKind, SmartGraphicItem, SmartGraphicState } from '../types/smartGraphic'
import { createStateFromTemplate, getSmartGraphicTemplate, SMART_GRAPHIC_TEMPLATES } from '../data/smartGraphicTemplates'
import {
  isDeepSeekVisionEnabled,
  isDeepSeekVisionUnsupportedError,
  requestDeepSeekPlainText,
  requestDeepSeekVision,
} from './deepseek'
import { extractTextFromImage } from './smartGraphicOcr'

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

function buildTemplateCatalog(): string {
  return SMART_GRAPHIC_TEMPLATES.map(
    (template) =>
      `- id: "${template.id}" | ${template.name} | layout: ${template.layout} | 项数: ${template.itemCount} | ${template.description}`,
  ).join('\n')
}

function normalizeItem(raw: Record<string, unknown>, index: number, templateId: string): SmartGraphicItem {
  const title = typeof raw.title === 'string' ? raw.title.trim() : `项目 ${index + 1}`
  const body = typeof raw.body === 'string' ? raw.body.trim() : ''

  const item: SmartGraphicItem = { title, body }

  if (templateId === 'biz-dashboard-pv') {
    const columnKind = raw.columnKind as SmartGraphicColumnKind | undefined
    if (columnKind) item.columnKind = columnKind

    if (Array.isArray(raw.flowSteps)) {
      item.flowSteps = raw.flowSteps.map((step) => String(step).trim()).filter(Boolean)
    }

    if (Array.isArray(raw.metrics)) {
      item.metrics = raw.metrics
        .map((metric) => {
          if (!metric || typeof metric !== 'object') return null
          const record = metric as Record<string, unknown>
          return {
            label: typeof record.label === 'string' ? record.label.trim() : '指标',
            value: typeof record.value === 'string' ? record.value.trim() : '—',
          }
        })
        .filter((metric): metric is { label: string; value: string } => metric !== null)
    }
  }

  return item
}

function countNumberedListItems(text: string): number {
  const matches = text.match(/(?:^|\n)\s*[1-9][0-9]?[.、．)]\s*\S/gm)
  return matches?.length ?? 0
}

function isDashboardLikeText(text: string): boolean {
  return /四列|仪表盘|执行过程|关键节点|人力投入|资源投入|项目阶段|资源高效|flowSteps|columnKind/.test(text)
}

function countMeaningfulItems(rawItems: unknown[]): number {
  return rawItems.filter((item) => {
    if (!item || typeof item !== 'object') return false
    const record = item as Record<string, unknown>
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    const body = typeof record.body === 'string' ? record.body.trim() : ''
    return Boolean(title || body)
  }).length
}

function pickTemplateForImage(parsed: Record<string, unknown>, ocrText: string): string {
  const rawItems = Array.isArray(parsed.items) ? parsed.items : []
  const aiCount = countMeaningfulItems(rawItems)
  const listCount = countNumberedListItems(ocrText)
  const effectiveCount = Math.max(aiCount, listCount, rawItems.length)

  const aiTemplateId = typeof parsed.templateId === 'string' ? parsed.templateId : ''
  const aiTemplate = aiTemplateId ? getSmartGraphicTemplate(aiTemplateId) : undefined

  if (aiTemplate && aiTemplate.id !== 'biz-dashboard-pv') {
    return aiTemplate.id
  }

  const dashboardLike = isDashboardLikeText(ocrText) || isDashboardLikeText(JSON.stringify(parsed))

  if (dashboardLike && effectiveCount >= 4) {
    return 'biz-dashboard-pv'
  }

  if (aiTemplate?.id === 'biz-dashboard-pv' && !dashboardLike && effectiveCount <= 3) {
    if (effectiveCount === 3) return 'parallel-v3-list'
    if (effectiveCount === 4) return 'parallel-h4-card'
    return 'parallel-h3-card'
  }

  if (effectiveCount === 3) return 'parallel-v3-list'
  if (effectiveCount === 4) return 'parallel-h4-card'
  if (effectiveCount >= 5) return 'process-h4-step'

  return aiTemplate?.id ?? 'parallel-h3-card'
}

function mergeGeneratedState(
  templateId: string,
  parsed: Record<string, unknown>,
  sourceImageUrl?: string,
  fromImage = false,
): SmartGraphicState {
  const template = getSmartGraphicTemplate(templateId) ?? getSmartGraphicTemplate('parallel-h3-card')!
  const base = createStateFromTemplate(template)
  const itemCount = template.itemCount
  const isBusiness = template.layout === 'business-dashboard-4col'

  const rawItems = Array.isArray(parsed.items) ? parsed.items : []
  const items = rawItems.slice(0, itemCount).map((item, index) => {
    if (!item || typeof item !== 'object') {
      if (fromImage) {
        return { title: `项目 ${index + 1}`, body: '' }
      }
      return base.items[index] ?? { title: `项目 ${index + 1}`, body: '' }
    }
    const normalized = normalizeItem(item as Record<string, unknown>, index, template.id)
    if (fromImage) {
      const result: SmartGraphicItem = {
        title: normalized.title,
        body: normalized.body,
      }
      if (isBusiness) {
        if (normalized.columnKind) result.columnKind = normalized.columnKind
        if (normalized.flowSteps?.length) result.flowSteps = normalized.flowSteps
        if (normalized.metrics?.length) result.metrics = normalized.metrics
      }
      return result
    }

    const fallback = base.items[index]
    return {
      ...fallback,
      ...normalized,
      columnKind: normalized.columnKind ?? fallback?.columnKind,
      flowSteps: normalized.flowSteps?.length ? normalized.flowSteps : fallback?.flowSteps,
      metrics: normalized.metrics?.length ? normalized.metrics : fallback?.metrics,
    }
  })

  while (items.length < itemCount) {
    items.push(
      fromImage
        ? { title: `项目 ${items.length + 1}`, body: '' }
        : (base.items[items.length] ?? { title: `项目 ${items.length + 1}`, body: '' }),
    )
  }

  return {
    ...base,
    templateId: template.id,
    title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : fromImage ? '智能图形' : base.title,
    subtitle: typeof parsed.subtitle === 'string' ? parsed.subtitle.trim() : fromImage ? '' : base.subtitle,
    footerGroupA:
      typeof parsed.footerGroupA === 'string'
        ? parsed.footerGroupA.trim()
        : fromImage
          ? ''
          : (base.footerGroupA ?? ''),
    footerGroupB:
      typeof parsed.footerGroupB === 'string'
        ? parsed.footerGroupB.trim()
        : fromImage
          ? ''
          : (base.footerGroupB ?? ''),
    items,
    sourceImageUrl,
  }
}

export async function generateSmartGraphicContent(input: {
  prompt: string
  itemCount: number
  layoutName: string
  categoryLabel: string
  templateId?: string
}): Promise<{
  title: string
  subtitle: string
  items: SmartGraphicItem[]
  footerGroupA?: string
  footerGroupB?: string
}> {
  const isBusiness = input.templateId === 'biz-dashboard-pv'

  const businessSchema = isBusiness
    ? `
若版式为四列仪表盘，items 每项还需：
- columnKind: "flow" | "metrics-pair" | "metrics-split" | "metrics-row"
- flowSteps: string[]（仅 flow 栏）
- metrics: [{ "label": "标签", "value": "数值" }]
并额外输出 footerGroupA、footerGroupB（底栏两组标题）。`
    : ''

  const systemPrompt = `你是演示文稿智能图形策划专家。根据用户需求，为「${input.categoryLabel} · ${input.layoutName}」版式生成结构化文案。
必须只输出 JSON：
{
  "title": "主标题",
  "subtitle": "副标题，可选简短说明",
  "items": [
    { "title": "项标题", "body": "1～2 句说明" }
  ]${isBusiness ? ',\n  "footerGroupA": "底栏左",\n  "footerGroupB": "底栏右"' : ''}
}
${businessSchema}
items 数组长度必须恰好为 ${input.itemCount}。title 每项不超过 10 字，body 每项不超过 40 字。不要 markdown。`

  const userPrompt = `需求：${input.prompt.trim()}\n请生成 ${input.itemCount} 项内容。`

  const raw = await requestDeepSeekPlainText({
    systemPrompt,
    userPrompt,
    temperature: 0.45,
    maxTokens: 2048,
  })

  const parsed = JSON.parse(extractJsonObject(raw)) as {
    title?: string
    subtitle?: string
    footerGroupA?: string
    footerGroupB?: string
    items?: Array<Record<string, unknown>>
  }

  const state = mergeGeneratedState(input.templateId ?? 'parallel-h3-card', parsed)
  return {
    title: state.title,
    subtitle: state.subtitle,
    items: state.items,
    footerGroupA: state.footerGroupA,
    footerGroupB: state.footerGroupB,
  }
}

export async function generateSmartGraphicFromImage(input: {
  imageDataUrl: string
  hint?: string
  onProgress?: (message: string) => void
}): Promise<SmartGraphicState> {
  const catalog = buildTemplateCatalog()

  const systemPrompt = `你是智能图形识别与还原专家。用户会上传一张 SmartArt / 信息图 / 汇报页截图。
请根据 OCR 文字或视觉信息，识别版式结构、标题、各区块文字与数字，并映射到平台模板库，输出可编辑 JSON。

可选模板（templateId 必须从中选一个）：
${catalog}

输出 JSON 格式：
{
  "templateId": "模板 id",
  "title": "主标题",
  "subtitle": "副标题（无则空字符串）",
  "footerGroupA": "仅 business-dashboard-4col 需要",
  "footerGroupB": "仅 business-dashboard-4col 需要",
  "items": [
    {
      "title": "栏/块标题",
      "body": "说明文字",
      "columnKind": "flow|metrics-pair|metrics-split|metrics-row（仅四列仪表盘）",
      "flowSteps": ["步骤1","步骤2"],
      "metrics": [{ "label": "标签", "value": "数值" }]
    }
  ]
}

规则：
1. 尽量忠实还原 OCR 原文，不要编造图片中不存在的条目或数字
2. items 数量必须与所选 template 的项数一致；若 OCR 只有 3 条编号列表，应选 parallel-v3-list（3 项），不要强行用 biz-dashboard-pv
3. 仅当 OCR 明确出现四列商务仪表盘结构（如：执行过程/关键节点/人力/资源 四栏）时，才选 biz-dashboard-pv
4. 列表类内容（1. 2. 3. 条目+说明）优先用 parallel-v3-list 或 parallel-h3-card，每项 title 为条目标题，body 为说明文字
5. 只输出 JSON，不要 markdown`

  const hintText = input.hint?.trim() ? `\n\n用户补充说明：${input.hint.trim()}` : ''
  let parsed: Record<string, unknown> | undefined
  let ocrText = ''

  if (isDeepSeekVisionEnabled()) {
    try {
      input.onProgress?.('正在通过视觉模型分析图片…')
      const raw = await requestDeepSeekVision({
        systemPrompt,
        userPrompt: `请分析这张图片，识别版式与全部可见文字，生成智能图形 JSON。${hintText}`,
        imageDataUrl: input.imageDataUrl,
        temperature: 0.2,
        maxTokens: 4096,
      })
      parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>
    } catch (err) {
      if (!isDeepSeekVisionUnsupportedError(err)) {
        throw err instanceof Error ? err : new Error('视觉模型分析失败')
      }
      input.onProgress?.('视觉模型不可用，改用 OCR 识别…')
    }
  }

  if (!parsed) {
    ocrText = await extractTextFromImage(input.imageDataUrl, input.onProgress)
    input.onProgress?.(`OCR 完成（${ocrText.length} 字），正在分析版式…`)
    const raw = await requestDeepSeekPlainText({
      systemPrompt,
      userPrompt: `以下是从一张 SmartArt / 信息图 / 汇报页截图中 OCR 识别出的文字（顺序可能不完全准确）：

"""
${ocrText}
"""

请根据文字内容推断最合适的版式，还原标题、各栏目、流程步骤、指标数字等，生成智能图形 JSON。
若 OCR 为 3 条编号列表，请用 parallel-v3-list，每项对应一条。${hintText}`,
      temperature: 0.25,
      maxTokens: 4096,
    })

    try {
      parsed = JSON.parse(extractJsonObject(raw)) as Record<string, unknown>
    } catch {
      throw new Error('AI 未能解析图片内容，请换一张更清晰的截图或补充文字说明后重试')
    }
  }

  const templateId = pickTemplateForImage(parsed, ocrText)

  return mergeGeneratedState(templateId, parsed, input.imageDataUrl, true)
}
