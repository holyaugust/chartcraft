import type { SmartGraphicColorSchemeId, SmartGraphicItem, SmartGraphicState } from '../types/smartGraphic'
import { DEFAULT_SMART_GRAPHIC_COLOR_SCHEME } from '../types/smartGraphic'
import { createStateFromTemplate, getSmartGraphicTemplate, SMART_GRAPHIC_TEMPLATES } from '../data/smartGraphicTemplates'
import { SMART_GRAPHIC_COLOR_THEMES } from './smartGraphicColorSchemes'

const STORAGE_KEY = 'chartcraft-smart-graphic-draft'
const VALID_COLOR_IDS = new Set(SMART_GRAPHIC_COLOR_THEMES.map((theme) => theme.id))

function normalizeColorSchemeId(value: unknown): SmartGraphicColorSchemeId {
  if (typeof value === 'string' && VALID_COLOR_IDS.has(value as SmartGraphicColorSchemeId)) {
    return value as SmartGraphicColorSchemeId
  }
  return DEFAULT_SMART_GRAPHIC_COLOR_SCHEME
}

function normalizeItem(raw: Partial<SmartGraphicItem>, fallback: SmartGraphicItem): SmartGraphicItem {
  return {
    title: typeof raw.title === 'string' ? raw.title : fallback.title,
    body: typeof raw.body === 'string' ? raw.body : fallback.body,
    columnKind: raw.columnKind ?? fallback.columnKind,
    flowSteps: Array.isArray(raw.flowSteps)
      ? raw.flowSteps.map((step) => String(step))
      : fallback.flowSteps,
    metrics: Array.isArray(raw.metrics)
      ? raw.metrics.map((m) => ({
          label: String(m?.label ?? ''),
          value: String(m?.value ?? ''),
        }))
      : fallback.metrics,
  }
}

export function loadSmartGraphicDraft(): SmartGraphicState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return createStateFromTemplate(SMART_GRAPHIC_TEMPLATES[0])
    }
    const parsed = JSON.parse(raw) as Partial<SmartGraphicState>
    const template = getSmartGraphicTemplate(parsed.templateId ?? '') ?? SMART_GRAPHIC_TEMPLATES[0]
    const sampleItems = template.sampleItems
    const items = Array.isArray(parsed.items)
      ? parsed.items.map((item, index) => normalizeItem(item ?? {}, sampleItems[index] ?? { title: '', body: '' }))
      : sampleItems.map((item) => ({ ...item }))

    while (items.length < template.itemCount) {
      items.push({ title: `栏目 ${items.length + 1}`, body: '' })
    }

    return {
      templateId: template.id,
      title: typeof parsed.title === 'string' ? parsed.title : template.sampleTitle,
      subtitle: typeof parsed.subtitle === 'string' ? parsed.subtitle : template.sampleSubtitle,
      items: items.slice(0, template.itemCount),
      colorSchemeId: normalizeColorSchemeId(parsed.colorSchemeId),
      footerGroupA:
        typeof parsed.footerGroupA === 'string' ? parsed.footerGroupA : template.sampleFooterGroupA ?? '',
      footerGroupB:
        typeof parsed.footerGroupB === 'string' ? parsed.footerGroupB : template.sampleFooterGroupB ?? '',
    }
  } catch {
    return createStateFromTemplate(SMART_GRAPHIC_TEMPLATES[0])
  }
}

export function saveSmartGraphicDraft(state: SmartGraphicState): void {
  try {
    const { sourceImageUrl: _removed, ...draft } = state
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }))
  } catch {
    /* ignore */
  }
}
