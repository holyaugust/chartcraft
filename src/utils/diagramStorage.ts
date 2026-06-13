import { DEFAULT_FLOWCHART_TEMPLATE_ID } from '../data/flowchartTemplates'
import { DEFAULT_MINDMAP_TEMPLATE_ID, MINDMAP_TEMPLATES } from '../data/mindmapTemplates'
import type { ColorSchemeId } from '../types'
import type { DiagramDraft, DiagramKind } from '../types/diagram'
import { DEFAULT_DIAGRAM_COLOR_SCHEME_ID } from './diagramColorSchemes'
import { prepareMindmapSource, isMindmapFlowchartConflict } from './diagramStyleEnhance'

const KEY_PREFIX = 'chartcraft-diagram-'

const DEFAULT_MINDMAP_SOURCE =
  MINDMAP_TEMPLATES.find((item) => item.id === DEFAULT_MINDMAP_TEMPLATE_ID)?.sampleSource ??
  MINDMAP_TEMPLATES[0].sampleSource

const VALID_COLOR_SCHEMES: ColorSchemeId[] = [
  'default',
  'ocean',
  'sunset',
  'forest',
  'vivid',
  'pastel',
  'business',
  'mono',
]

const DEFAULTS: Record<DiagramKind, DiagramDraft> = {
  flowchart: {
    source: `flowchart TD
    A([开始]) --> B[提交申请]
    B --> C{是否通过?}
    C -->|是| D[执行]
    C -->|否| E[退回修改]
    E --> B
    D --> F([结束])`,
    prompt: '',
    title: '业务流程图',
    flowchartTemplateId: DEFAULT_FLOWCHART_TEMPLATE_ID,
    colorSchemeId: DEFAULT_DIAGRAM_COLOR_SCHEME_ID,
  },
  mindmap: {
    source: DEFAULT_MINDMAP_SOURCE,
    prompt: '',
    title: '思维导图',
    mindmapTemplateId: DEFAULT_MINDMAP_TEMPLATE_ID,
    colorSchemeId: 'vivid',
  },
}

function normalizeColorSchemeId(value: unknown): ColorSchemeId {
  if (typeof value === 'string' && VALID_COLOR_SCHEMES.includes(value as ColorSchemeId)) {
    return value as ColorSchemeId
  }
  return DEFAULT_DIAGRAM_COLOR_SCHEME_ID
}

function isFlowchartMindmapConflict(source: string): boolean {
  const head = source.trimStart().split('\n')[0]?.trim() ?? ''
  return /^mindmap\b/i.test(head)
}

function repairDraftSource(kind: DiagramKind, source: string): string {
  if (kind === 'mindmap') {
    const prepared = prepareMindmapSource(source)
    if (isMindmapFlowchartConflict(prepared)) return DEFAULTS.mindmap.source
    return prepared
  }
  if (kind === 'flowchart' && isFlowchartMindmapConflict(source)) {
    return DEFAULTS.flowchart.source
  }
  return source
}

export function loadDiagramDraft(kind: DiagramKind): DiagramDraft {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${kind}`)
    if (!raw) return { ...DEFAULTS[kind] }
    const parsed = JSON.parse(raw) as Partial<DiagramDraft>
    const rawSource = parsed.source ?? DEFAULTS[kind].source
    const source = repairDraftSource(kind, rawSource)

    if (kind === 'mindmap' && source === DEFAULTS.mindmap.source && isMindmapFlowchartConflict(rawSource)) {
      return { ...DEFAULTS.mindmap }
    }
    if (kind === 'flowchart' && source === DEFAULTS.flowchart.source && isFlowchartMindmapConflict(rawSource)) {
      return { ...DEFAULTS.flowchart }
    }

    return {
      source,
      prompt: parsed.prompt ?? '',
      title: parsed.title ?? DEFAULTS[kind].title,
      flowchartTemplateId:
        kind === 'flowchart'
          ? parsed.flowchartTemplateId ?? DEFAULT_FLOWCHART_TEMPLATE_ID
          : undefined,
      mindmapTemplateId:
        kind === 'mindmap'
          ? parsed.mindmapTemplateId ?? DEFAULT_MINDMAP_TEMPLATE_ID
          : undefined,
      colorSchemeId:
        kind === 'mindmap'
          ? normalizeColorSchemeId(parsed.colorSchemeId ?? DEFAULTS.mindmap.colorSchemeId)
          : normalizeColorSchemeId(parsed.colorSchemeId),
    }
  } catch {
    return { ...DEFAULTS[kind] }
  }
}

export function saveDiagramDraft(kind: DiagramKind, draft: DiagramDraft): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}${kind}`, JSON.stringify(draft))
  } catch {
    /* ignore */
  }
}

export function getDiagramKindLabel(kind: DiagramKind): string {
  return kind === 'flowchart' ? '流程图' : '思维导图'
}
