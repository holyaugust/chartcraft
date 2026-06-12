import type { ColorSchemeId } from '../types'

export type DiagramKind = 'flowchart' | 'mindmap'

export interface DiagramDraft {
  source: string
  prompt: string
  title: string
  flowchartTemplateId?: string
  mindmapTemplateId?: string
  colorSchemeId?: ColorSchemeId
}
