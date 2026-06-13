import {
  formatMermaidLabel,
  parseFlowchartNodes,
  parseMindmapNodes,
  type MindmapNodeRef,
} from './diagramSourceEdit'

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

const FLOWCHART_SKIP_LINE =
  /^(classDef|class|style|linkStyle|click|subgraph|end\b|direction\b|flowchart\b|graph\b|%%)/i

const FLOWCHART_META_LINE = /^(classDef|class|style|linkStyle|click|%%)/i

function splitSourceLines(source: string): string[] {
  return source.split('\n')
}

function findFlowchartBodyInsertIndex(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i]?.trim() ?? ''
    if (!trimmed) continue
    if (FLOWCHART_META_LINE.test(trimmed)) continue
    return i + 1
  }
  return lines.length
}

function getFlowchartIndent(lines: string[]): string {
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || FLOWCHART_SKIP_LINE.test(trimmed)) continue
    if (/-->|---/.test(trimmed) || /[\[\(\{]/.test(trimmed)) {
      return line.match(/^(\s*)/)?.[1] ?? '    '
    }
  }
  return '    '
}

/** 生成未占用的流程图节点 ID */
export function generateNextFlowchartNodeId(source: string): string {
  const ids = new Set(parseFlowchartNodes(source).map((node) => node.id))
  for (let i = 65; i <= 90; i++) {
    const id = String.fromCharCode(i)
    if (!ids.has(id)) return id
  }
  let n = 1
  while (ids.has(`N${n}`)) n++
  return `N${n}`
}

function buildFlowchartNodeExpr(nodeId: string, nodeType: 'step' | 'decision', label: string): string {
  const fmt = formatMermaidLabel(label)
  if (nodeType === 'decision') return `${nodeId}{${fmt}}`
  return `${nodeId}[${fmt}]`
}

function formatFlowchartEdge(fromId: string, to: string, edgeLabel?: string): string {
  const label = edgeLabel?.trim()
  if (label) return `${fromId} -->|${label}| ${to}`
  return `${fromId} --> ${to}`
}

function edgeAlreadyExists(lines: string[], fromNodeId: string, toNodeId: string): boolean {
  const from = escapeRegExp(fromNodeId)
  const to = escapeRegExp(toNodeId)
  return lines.some((line) => {
    const trimmed = line.trim()
    if (!trimmed || FLOWCHART_SKIP_LINE.test(trimmed)) return false
    return new RegExp(`^\\b${from}\\s*-->(?:\\|[^|]*\\|)?\\s*\\b${to}\\b`).test(trimmed)
  })
}

function isFlowchartDecisionNode(source: string, nodeId: string): boolean {
  const id = escapeRegExp(nodeId)
  return stripInjectedClassLines(source)
    .split('\n')
    .some((line) => new RegExp(`\\b${id}\\s*\\{`).test(line.trim()))
}

function findFirstSingleOutgoingEdgeLine(lines: string[], nodeId: string): number {
  const id = escapeRegExp(nodeId)
  const edgeRe = new RegExp(`^\\s*\\b${id}\\s*-->\\s*(.+)$`)
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]?.trim() ?? ''
    if (!trimmed || FLOWCHART_SKIP_LINE.test(trimmed)) continue
    const match = trimmed.match(edgeRe)
    if (!match) continue
    const target = match[1].trim()
    if (target.includes('-->')) continue
    return i
  }
  return -1
}

function countOutgoingEdges(lines: string[], nodeId: string): number {
  const id = escapeRegExp(nodeId)
  let count = 0
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || FLOWCHART_SKIP_LINE.test(trimmed)) continue
    if (new RegExp(`^\\b${id}\\s*-->`).test(trimmed)) count++
  }
  return count
}

/** 在选中节点后追加步骤或判断节点；单出边时插入链中 */
export function addFlowchartNodeDownstream(
  source: string,
  afterNodeId: string,
  nodeType: 'step' | 'decision',
  label?: string,
  edgeLabel?: string,
): string {
  const lines = splitSourceLines(source)
  const outCount = countOutgoingEdges(lines, afterNodeId)
  if (isFlowchartDecisionNode(source, afterNodeId) && outCount > 0) {
    return addFlowchartBranch(source, afterNodeId, nodeType, label, edgeLabel)
  }

  const indent = getFlowchartIndent(lines)
  const newId = generateNextFlowchartNodeId(source)
  const defaultLabel = nodeType === 'decision' ? '新判断?' : '新步骤'
  const nodeExpr = buildFlowchartNodeExpr(newId, nodeType, label ?? defaultLabel)

  const outIdx = findFirstSingleOutgoingEdgeLine(lines, afterNodeId)
  if (outIdx >= 0) {
    const trimmed = lines[outIdx].trim()
    const id = escapeRegExp(afterNodeId)
    const match = trimmed.match(new RegExp(`^(\\s*\\b${id}\\s*-->\\s*)(.+)$`))
    if (match) {
      const target = match[2].trim().replace(/^\|[^|]*\|\s*/, '')
      lines[outIdx] = `${indent}${formatFlowchartEdge(afterNodeId, nodeExpr, edgeLabel)}`
      lines.splice(outIdx + 1, 0, `${indent}${formatFlowchartEdge(newId, target)}`)
      return lines.join('\n')
    }
  }

  const insertAt = findFlowchartBodyInsertIndex(lines)
  lines.splice(insertAt, 0, `${indent}${formatFlowchartEdge(afterNodeId, nodeExpr, edgeLabel)}`)
  return lines.join('\n')
}

/** 从判断节点追加一条并行分支 */
export function addFlowchartBranch(
  source: string,
  fromNodeId: string,
  nodeType: 'step' | 'decision' = 'step',
  label?: string,
  edgeLabel?: string,
): string {
  const lines = splitSourceLines(source)
  const indent = getFlowchartIndent(lines)
  const newId = generateNextFlowchartNodeId(source)
  const defaultLabel = nodeType === 'decision' ? '新判断?' : '新分支'
  const nodeExpr = buildFlowchartNodeExpr(newId, nodeType, label ?? defaultLabel)
  const insertAt = findFlowchartBodyInsertIndex(lines)
  lines.splice(insertAt, 0, `${indent}${formatFlowchartEdge(fromNodeId, nodeExpr, edgeLabel)}`)
  return lines.join('\n')
}

/** 将两个已有节点相连（可选边标签） */
export function connectFlowchartNodes(
  source: string,
  fromNodeId: string,
  toNodeId: string,
  edgeLabel?: string,
): string {
  if (fromNodeId === toNodeId) return source
  const lines = splitSourceLines(source)
  if (edgeAlreadyExists(lines, fromNodeId, toNodeId)) return source
  const indent = getFlowchartIndent(lines)
  const insertAt = findFlowchartBodyInsertIndex(lines)
  lines.splice(insertAt, 0, `${indent}${formatFlowchartEdge(fromNodeId, toNodeId, edgeLabel)}`)
  return lines.join('\n')
}

function lineReferencesFlowchartNode(line: string, nodeId: string): boolean {
  const id = escapeRegExp(nodeId)
  const trimmed = line.trim()
  if (!trimmed) return false
  if (new RegExp(`^\\b${id}\\s*[\[\(\{>]`).test(trimmed)) return true
  if (new RegExp(`^class\\s+${id}\\b`).test(trimmed)) return true
  if (new RegExp(`\\b${id}\\b`).test(trimmed) && /-->|---|-\.->|==>/.test(trimmed)) return true
  return false
}

function parseEdgeTarget(rest: string): string {
  const match = rest.trim().match(/^([A-Za-z][A-Za-z0-9_]*)/)
  return match?.[1] ?? ''
}

function bridgeFlowchartEdges(lines: string[], nodeId: string): string[] {
  const id = escapeRegExp(nodeId)
  const incoming: string[] = []
  const outgoing: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || FLOWCHART_SKIP_LINE.test(trimmed)) continue

    const outMatch = trimmed.match(new RegExp(`^\\b${id}\\s*-->`))
    if (outMatch) {
      const rest = trimmed.replace(new RegExp(`^\\b${id}\\s*-->(?:\\|[^|]*\\|)?\\s*`), '')
      const target = parseEdgeTarget(rest)
      if (target) outgoing.push(target)
    }

    const inMatch = trimmed.match(
      new RegExp(`^(\\S+)\\s*-->(?:\\|[^|]*\\|)?\\s*\\b${id}\\b`),
    )
    if (inMatch && inMatch[1] !== nodeId) {
      incoming.push(inMatch[1])
    }
  }

  const filtered = lines.filter((line) => !lineReferencesFlowchartNode(line, nodeId))
  if (incoming.length === 1 && outgoing.length === 1) {
    const indent = getFlowchartIndent(lines)
    filtered.splice(findFlowchartBodyInsertIndex(filtered), 0, `${indent}${incoming[0]} --> ${outgoing[0]}`)
  }
  return filtered
}

/** 删除流程图节点及相关连线 */
export function deleteFlowchartNode(source: string, nodeId: string): string {
  return bridgeFlowchartEdges(splitSourceLines(source), nodeId).join('\n')
}

function getMindmapLineIndent(line: string): number {
  return line.match(/^(\s*)/)?.[1]?.length ?? 0
}

function findMindmapSubtreeEnd(lines: string[], lineIndex: number): number {
  const baseIndent = getMindmapLineIndent(lines[lineIndex] ?? '')
  let end = lineIndex + 1
  while (end < lines.length) {
    const line = lines[end]
    if (!line?.trim()) {
      end++
      continue
    }
    if (/^mindmap\b/i.test(line.trim())) break
    if (/^(classDef|class|style|%%)/i.test(line.trim())) break
    const indent = getMindmapLineIndent(line)
    if (indent <= baseIndent) break
    end++
  }
  return end
}

function getMindmapNodeIndent(source: string, lineIndex: number): string {
  return source.split('\n')[lineIndex]?.match(/^(\s*)/)?.[1] ?? '  '
}

/** 在思维导图节点下添加子节点 */
export function addMindmapChild(source: string, parentLineIndex: number, label = '新节点'): string {
  const lines = splitSourceLines(source)
  const parentIndent = getMindmapNodeIndent(source, parentLineIndex)
  const childIndent = `${parentIndent}  `
  const insertAt = findMindmapSubtreeEnd(lines, parentLineIndex)
  lines.splice(insertAt, 0, `${childIndent}${label}`)
  return lines.join('\n')
}

/** 在思维导图节点后添加同级节点 */
export function addMindmapSibling(source: string, lineIndex: number, label = '新节点'): string {
  const lines = splitSourceLines(source)
  const indent = getMindmapNodeIndent(source, lineIndex)
  const insertAt = findMindmapSubtreeEnd(lines, lineIndex)
  lines.splice(insertAt, 0, `${indent}${label}`)
  return lines.join('\n')
}

/** 删除思维导图节点及其子孙 */
export function deleteMindmapNode(source: string, lineIndex: number): string {
  const refs = parseMindmapNodes(source)
  const target = refs.find((ref) => ref.lineIndex === lineIndex)
  if (!target || target.isRoot) return source

  const lines = splitSourceLines(source)
  const end = findMindmapSubtreeEnd(lines, lineIndex)
  lines.splice(lineIndex, end - lineIndex)
  return lines.join('\n')
}

export function isMindmapRootNode(source: string, lineIndex: number): boolean {
  return parseMindmapNodes(source).some((ref) => ref.lineIndex === lineIndex && ref.isRoot)
}

export function isFlowchartDecision(source: string, nodeId: string): boolean {
  return isFlowchartDecisionNode(source, nodeId)
}

export interface DiagramNodeSelection {
  nodeId?: string
  lineIndex?: number
  label: string
  isRoot?: boolean
}

export function getNodeSelectionFromElement(target: Element): DiagramNodeSelection | null {
  const group =
    target.closest('[data-cc-node-id], [data-cc-line-index]') ??
    target.closest('g[class*="mindmap-node"], g[class*="node"]')
  if (!group) return null

  const nodeId = group.getAttribute('data-cc-node-id') ?? undefined
  const lineIndexRaw = group.getAttribute('data-cc-line-index')
  const lineIndex = lineIndexRaw != null ? Number.parseInt(lineIndexRaw, 10) : undefined
  const label = group.getAttribute('data-cc-label') ?? ''

  return {
    nodeId,
    lineIndex: Number.isNaN(lineIndex) ? undefined : lineIndex,
    label,
    isRoot: group.getAttribute('data-cc-is-root') === 'true',
  }
}

export function getMindmapRef(source: string, lineIndex: number): MindmapNodeRef | undefined {
  return parseMindmapNodes(source).find((ref) => ref.lineIndex === lineIndex)
}
