import type { DiagramKind } from '../types/diagram'

function stripFrontmatter(source: string): string {
  return source.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '')
}

function stripInjectedClassLines(source: string): string {
  return stripFrontmatter(source)
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('classDef ccVivid')) return false
      if (trimmed.startsWith('class ') && trimmed.includes('ccVivid')) return false
      return true
    })
    .join('\n')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Mermaid 标签中需转义或加引号 */
export function formatMermaidLabel(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return '""'
  if (/["[\]{}()|<>#;]/.test(trimmed) || /\s/.test(trimmed)) {
    return `"${trimmed.replace(/"/g, '#quot;')}"`
  }
  return trimmed
}

export interface FlowchartNodeRef {
  id: string
  label: string
}

export interface MindmapNodeRef {
  lineIndex: number
  depth: number
  label: string
  isRoot: boolean
}

const FLOWCHART_SKIP_LINE =
  /^(classDef|class|style|linkStyle|click|subgraph|end\b|direction\b|flowchart\b|graph\b|%%)/i

/** 按首次定义顺序提取流程图节点 */
export function parseFlowchartNodes(source: string): FlowchartNodeRef[] {
  const cleaned = stripInjectedClassLines(source)
  const seen = new Set<string>()
  const nodes: FlowchartNodeRef[] = []

  for (const line of cleaned.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || FLOWCHART_SKIP_LINE.test(trimmed)) continue

    const nodeDefRe = /\b([A-Za-z][A-Za-z0-9_]*)\s*(?:[\[\(\{>]|:::)/g
    let match: RegExpExecArray | null
    while ((match = nodeDefRe.exec(trimmed))) {
      const id = match[1]
      if (seen.has(id)) continue
      seen.add(id)
      nodes.push({ id, label: extractFlowchartNodeLabelFromLine(trimmed, id) ?? id })
    }
  }

  return nodes
}

function extractFlowchartNodeLabelFromLine(line: string, nodeId: string): string | null {
  const id = escapeRegExp(nodeId)
  const patterns = [
    new RegExp(`\\b${id}\\s*\\(\\[([^\\]]*)\\]\\)`),
    new RegExp(`\\b${id}\\s*\\(\\(([^)]*)\\)\\)`),
    new RegExp(`\\b${id}\\s*\\[\\[([^\\]]*)\\]\\]`),
    new RegExp(`\\b${id}\\s*\\[(\\([^\\]]*)\\]\\)`),
    new RegExp(`\\b${id}\\s*\\[([^\\]]*)\\]`),
    new RegExp(`\\b${id}\\s*\\{([^}]*)\\}`),
    new RegExp(`\\b${id}\\s*>\\[([^\\]]*)\\]`),
    new RegExp(`\\b${id}\\s*\\[/([^/]*)/\\]`),
    new RegExp(`\\b${id}\\s*\\[\\\\([^\\\\]*)\\\\\\]`),
  ]

  for (const re of patterns) {
    const m = line.match(re)
    if (m) return unquoteMermaidLabel(m[1])
  }
  return null
}

function unquoteMermaidLabel(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/#quot;/g, '"')
  }
  return trimmed
}

function replaceFlowchartLabelInLine(line: string, nodeId: string, newLabel: string): string | null {
  const id = escapeRegExp(nodeId)
  const fmt = formatMermaidLabel(newLabel)
  const patterns: Array<{ re: RegExp; build: (m: RegExpMatchArray) => string }> = [
    {
      re: new RegExp(`^(\\s*.*?\\b${id}\\s*\\(\\[)([^\\]]*)(\\]\\).*)$`),
      build: (m) => `${m[1]}${fmt}${m[3]}`,
    },
    {
      re: new RegExp(`^(\\s*.*?\\b${id}\\s*\\(\\()([^)]*)(\\)\\).*)$`),
      build: (m) => `${m[1]}${fmt}${m[3]}`,
    },
    {
      re: new RegExp(`^(\\s*.*?\\b${id}\\s*\\[\\[)([^\\]]*)(\\]\\].*)$`),
      build: (m) => `${m[1]}${fmt}${m[3]}`,
    },
    {
      re: new RegExp(`^(\\s*.*?\\b${id}\\s*\\[)([^\\]]*)(\\].*)$`),
      build: (m) => `${m[1]}${fmt}${m[3]}`,
    },
    {
      re: new RegExp(`^(\\s*.*?\\b${id}\\s*\\{)([^}]*)(\\}.*)$`),
      build: (m) => `${m[1]}${fmt}${m[3]}`,
    },
    {
      re: new RegExp(`^(\\s*.*?\\b${id}\\s*>\\[)([^\\]]*)(\\].*)$`),
      build: (m) => `${m[1]}${fmt}${m[3]}`,
    },
    {
      re: new RegExp(`^(\\s*.*?\\b${id}\\s*\\[/)([^/]*)(/\\].*)$`),
      build: (m) => `${m[1]}${fmt}${m[3]}`,
    },
  ]

  for (const { re, build } of patterns) {
    const match = line.match(re)
    if (match) return build(match)
  }
  return null
}

/** 更新流程图某节点文字，同步 Mermaid 源码 */
export function updateFlowchartNodeLabel(source: string, nodeId: string, newLabel: string): string {
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const replaced = replaceFlowchartLabelInLine(lines[i], nodeId, newLabel)
    if (replaced) {
      lines[i] = replaced
      return lines.join('\n')
    }
  }
  return source
}

/** 解析思维导图节点（按渲染顺序） */
export function parseMindmapNodes(source: string): MindmapNodeRef[] {
  const lines = source.split('\n')
  const result: MindmapNodeRef[] = []
  let foundMindmap = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^mindmap\b/i.test(trimmed)) {
      foundMindmap = true
      continue
    }
    if (!foundMindmap) continue
    if (/^(classDef|class|style|%%)/i.test(trimmed)) continue

    const indent = line.match(/^(\s*)/)?.[1]?.length ?? 0
    const depth = Math.max(0, Math.floor(indent / 2))

    let label = trimmed
    let isRoot = false
    const rootWrapped = trimmed.match(/^root\s*\(\((.+)\)\)$/i)
    if (rootWrapped) {
      label = rootWrapped[1]
      isRoot = true
    } else {
      const parenWrapped = trimmed.match(/^\(\((.+)\)\)$/)
      if (parenWrapped) {
        label = parenWrapped[1]
        isRoot = true
      }
    }

    result.push({ lineIndex: i, depth, label, isRoot })
  }

  return result
}

/** 更新思维导图某行节点文字 */
export function updateMindmapNodeLabel(source: string, lineIndex: number, newLabel: string): string {
  const lines = source.split('\n')
  const line = lines[lineIndex]
  if (!line) return source

  const indent = line.match(/^(\s*)/)?.[1] ?? ''
  const trimmed = line.trim()

  if (/^root\s*\(\(/i.test(trimmed)) {
    lines[lineIndex] = `${indent}root((${newLabel}))`
  } else if (/^\(\(.+\)\)$/.test(trimmed)) {
    lines[lineIndex] = `${indent}((${newLabel}))`
  } else {
    lines[lineIndex] = `${indent}${newLabel}`
  }

  return lines.join('\n')
}

export function getSvgNodeText(group: Element): string {
  const foreign = group.querySelector('foreignObject')
  if (foreign) {
    return (foreign.textContent ?? '').replace(/\s+/g, ' ').trim()
  }
  const parts = [...group.querySelectorAll('text, tspan')]
    .map((el) => el.textContent ?? '')
    .filter(Boolean)
  return parts.join('').replace(/\s+/g, ' ').trim()
}

function collectEditableNodeGroups(svgEl: Element, kind: DiagramKind): Element[] {
  if (kind === 'mindmap') {
    const fromClass = [...svgEl.querySelectorAll('g[class*="mindmap-node"]')]
    if (fromClass.length > 0) return fromClass

    return [...svgEl.querySelectorAll('g.section, g.node, g[class*="node"]')].filter((group) => {
      const cls = group.getAttribute('class') ?? ''
      if (/\bedge\b/.test(cls) || /\blabel\b/.test(cls)) return false
      return group.querySelector('rect, circle, ellipse, path, polygon, foreignObject') != null
    })
  }

  const fromClass = [...svgEl.querySelectorAll('g[class*="node"]')].filter((group) => {
    const cls = group.getAttribute('class') ?? ''
    return /\bnode\b/.test(cls) && !/\bedge\b/.test(cls) && !/\blabel\b/.test(cls)
  })
  if (fromClass.length > 0) return fromClass

  return [...svgEl.querySelectorAll('g[id]')].filter((group) => {
    const id = group.getAttribute('id') ?? ''
    if (!/(?:flowchart-|graph-|[A-Za-z][A-Za-z0-9_]*-)\d+/.test(id)) return false
    return group.querySelector('rect, polygon, path, circle, ellipse, foreignObject') != null
  })
}

export function resolveEditableNodeGroup(target: Element): Element | null {
  return (
    target.closest('[data-cc-node-id], [data-cc-line-index]') ??
    target.closest('g[class*="mindmap-node"], g[class*="node"]')
  )
}

/** 获取节点内可直接编辑的标签元素（优先 Mermaid HTML 标签） */
export function getInlineLabelElement(nodeGroup: Element): HTMLElement | null {
  const htmlLabel = nodeGroup.querySelector(
    'foreignObject div, foreignObject span, foreignObject p',
  )
  if (htmlLabel instanceof HTMLElement) return htmlLabel

  const foreign = nodeGroup.querySelector('foreignObject')
  if (foreign instanceof HTMLElement && foreign.firstElementChild instanceof HTMLElement) {
    return foreign.firstElementChild
  }

  return null
}

export function readInlineLabelText(element: HTMLElement): string {
  return (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim()
}

export function selectElementContents(element: HTMLElement): void {
  const range = document.createRange()
  range.selectNodeContents(element)
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

export interface NodeEditLayout {
  left: number
  top: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  fontWeight: string
  color: string
  textAlign: 'left' | 'center' | 'right'
  text: string
}

/** 计算节点文字编辑浮层的位置与样式（相对预览容器） */
export function computeNodeEditLayout(nodeGroup: Element, shell: HTMLElement): NodeEditLayout {
  const shellRect = shell.getBoundingClientRect()
  const labelEl = getInlineLabelElement(nodeGroup)
  const targetRect = (labelEl ?? nodeGroup).getBoundingClientRect()

  const left = targetRect.left - shellRect.left
  const top = targetRect.top - shellRect.top
  const width = Math.max(Math.ceil(targetRect.width) + 8, 56)
  const height = Math.max(Math.ceil(targetRect.height) + 6, 28)

  let fontSize = 14
  let fontFamily = '"Microsoft YaHei", "PingFang SC", sans-serif'
  let fontWeight = '600'
  let color = '#1e293b'
  let textAlign: 'left' | 'center' | 'right' = 'center'

  if (labelEl) {
    const cs = window.getComputedStyle(labelEl)
    fontSize = Number.parseFloat(cs.fontSize) || fontSize
    fontFamily = cs.fontFamily || fontFamily
    fontWeight = cs.fontWeight || fontWeight
    color = cs.color || color
    const align = cs.textAlign
    if (align === 'left' || align === 'right' || align === 'center') {
      textAlign = align
    }
  } else {
    const textEl = nodeGroup.querySelector('text')
    if (textEl) {
      fontSize = Number.parseFloat(textEl.getAttribute('font-size') ?? '') || fontSize
      color = textEl.getAttribute('fill') ?? color
      const anchor = textEl.getAttribute('text-anchor')
      if (anchor === 'start') textAlign = 'left'
      else if (anchor === 'end') textAlign = 'right'
    }
  }

  const text =
    nodeGroup.getAttribute('data-cc-label') ||
    (labelEl ? readInlineLabelText(labelEl) : '') ||
    getSvgNodeText(nodeGroup)

  return { left, top, width, height, fontSize, fontFamily, fontWeight, color, textAlign, text }
}
export function findEditableNodeFromEvent(event: MouseEvent): Element | null {
  const pick = (el: Element | null | undefined) =>
    el ? resolveEditableNodeGroup(el) : null

  const fromTarget = pick(event.target as Element | null)
  if (fromTarget) return fromTarget

  return pick(document.elementFromPoint(event.clientX, event.clientY))
}

export function resolveDiagramNodeForEdit(
  canvas: Element | null,
  event: MouseEvent,
  selected?: { nodeId?: string; lineIndex?: number } | null,
): Element | null {
  const fromEvent = findEditableNodeFromEvent(event)
  if (fromEvent) return fromEvent

  if (!canvas || !selected) return null

  if (selected.nodeId) {
    const byId = canvas.querySelector(`[data-cc-node-id="${CSS.escape(selected.nodeId)}"]`)
    if (byId) return byId
  }
  if (selected.lineIndex != null && !Number.isNaN(selected.lineIndex)) {
    const byLine = canvas.querySelector(`[data-cc-line-index="${selected.lineIndex}"]`)
    if (byLine) return byLine
  }

  return null
}

export interface NodeEditTarget {
  nodeId?: string
  lineIndex?: number
}

/** 解析节点对应的源码编辑目标（含无 metadata 时的序号回退） */
export function resolveNodeEditTarget(
  nodeGroup: Element,
  source: string,
  kind: DiagramKind,
): NodeEditTarget {
  const nodeId = nodeGroup.getAttribute('data-cc-node-id') ?? undefined
  if (nodeId) return { nodeId }

  const lineIndexRaw = nodeGroup.getAttribute('data-cc-line-index')
  if (lineIndexRaw != null) {
    const lineIndex = Number.parseInt(lineIndexRaw, 10)
    if (!Number.isNaN(lineIndex)) return { lineIndex }
  }

  const svgEl = nodeGroup.closest('svg') ?? nodeGroup
  const groups = collectEditableNodeGroups(svgEl, kind)
  const index = groups.indexOf(nodeGroup)
  if (index < 0) return {}

  if (kind === 'flowchart') {
    const refs = parseFlowchartNodes(source)
    return refs[index]?.id ? { nodeId: refs[index].id } : {}
  }

  const refs = parseMindmapNodes(source)
  return refs[index]?.lineIndex != null ? { lineIndex: refs[index].lineIndex } : {}
}

function extractFlowchartNodeIdFromSvg(group: Element): string | null {
  const id = group.getAttribute('id') ?? ''
  const patterns = [
    /-([A-Za-z][A-Za-z0-9_]*)-\d+$/,
    /^flowchart-([A-Za-z][A-Za-z0-9_]*)-\d+$/,
    /^([A-Za-z][A-Za-z0-9_]*)-\d+$/,
  ]
  for (const re of patterns) {
    const m = id.match(re)
    if (m) return m[1]
  }
  return null
}

function tagEditableNode(group: Element, attrs: Record<string, string>): void {
  group.setAttribute('data-cc-editable', 'true')
  for (const [key, value] of Object.entries(attrs)) {
    group.setAttribute(key, value)
  }
  const cls = group.getAttribute('class') ?? ''
  if (!cls.includes('diagram-node-editable')) {
    group.setAttribute('class', `${cls} diagram-node-editable`.trim())
  }
  group.querySelectorAll('foreignObject, .label').forEach((el) => {
    el.setAttribute('data-cc-editable', 'true')
  })
}

function applyDiagramEditMetadataToElement(
  svgEl: Element,
  source: string,
  kind: DiagramKind,
): void {
  const nodeGroups = collectEditableNodeGroups(svgEl, kind)
  if (nodeGroups.length === 0) return

  if (kind === 'flowchart') {
    const refs = parseFlowchartNodes(source)
    const idToRef = new Map(refs.map((ref) => [ref.id, ref]))

    nodeGroups.forEach((group, index) => {
      const nodeId = extractFlowchartNodeIdFromSvg(group) ?? refs[index]?.id
      if (!nodeId) return
      const label = idToRef.get(nodeId)?.label ?? getSvgNodeText(group)
      tagEditableNode(group, {
        'data-cc-node-id': nodeId,
        'data-cc-label': label,
      })
    })
  } else {
    const refs = parseMindmapNodes(source)
    nodeGroups.forEach((group, index) => {
      const ref = refs[index]
      if (!ref) return
      tagEditableNode(group, {
        'data-cc-line-index': String(ref.lineIndex),
        'data-cc-label': ref.label,
        ...(ref.isRoot ? { 'data-cc-is-root': 'true' } : {}),
      })
    })
  }
}

/** 为 SVG 节点附加可编辑元数据 */
export function attachDiagramEditMetadata(svg: string, source: string, kind: DiagramKind): string {
  if (typeof DOMParser === 'undefined') return svg

  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const svgEl = doc.documentElement
  if (svgEl.querySelector('parsererror')) return svg

  applyDiagramEditMetadataToElement(svgEl, source, kind)

  return new XMLSerializer().serializeToString(svgEl)
}

/** 在浏览器 DOM 中附加可编辑元数据（innerHTML 插入后调用） */
export function attachDiagramEditMetadataToDom(
  root: Element,
  source: string,
  kind: DiagramKind,
): void {
  const svgEl = root.tagName.toLowerCase() === 'svg' ? root : root.querySelector('svg')
  if (!svgEl) return
  applyDiagramEditMetadataToElement(svgEl, source, kind)
}
