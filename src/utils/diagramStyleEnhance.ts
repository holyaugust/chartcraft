import type { ColorSchemeId } from '../types'
import type { DiagramKind } from '../types/diagram'
import type { MindmapTemplate } from '../data/mindmapTemplates'
import { getMindmapBranchColors } from '../data/mindmapTemplates'
import { contrastLabelColor, darkenColor, getColors, lightenColor } from './colorSchemes'

const INJECTED_CLASS_PREFIX = 'ccVivid'

function isFlowchartSource(source: string): boolean {
  const body = stripFrontmatter(source)
  const head = body.trimStart().split('\n')[0]?.trim() ?? ''
  return /^flowchart\b/i.test(head) || /^graph\b/i.test(head)
}

function stripFrontmatter(source: string): string {
  return source.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '')
}

/** 移除可能导致渲染失败的前置 layout 配置，保留纯 mindmap 语法 */
export function stripMindmapLayoutConfig(source: string): string {
  return stripFrontmatter(source).trim()
}

/** 规范化思维导图源码，确保以 mindmap 开头 */
export function prepareMindmapSource(source: string): string {
  let text = stripMindmapLayoutConfig(source)
  if (!text) return 'mindmap\n  root((主题))'

  if (/^flowchart\b/i.test(text) || /^graph\b/i.test(text)) {
    return text
  }

  if (!/^mindmap\b/i.test(text)) {
    text = `mindmap\n  root((主题))\n${text
      .split('\n')
      .map((line) => `    ${line.trim()}`)
      .join('\n')}`
  }

  return text
}

export function isMindmapFlowchartConflict(source: string): boolean {
  const body = stripMindmapLayoutConfig(source)
  const head = body.trimStart().split('\n')[0]?.trim() ?? ''
  return /^flowchart\b/i.test(head) || /^graph\b/i.test(head)
}

/** 从 Mermaid 源码中提取流程图节点 id */
export function extractFlowchartNodeIds(source: string): string[] {
  const ids = new Set<string>()
  const skipLine =
    /^(classDef|class|style|linkStyle|click|subgraph|end\b|direction\b|flowchart\b|graph\b|%%)/i

  for (const line of stripFrontmatter(source).split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || skipLine.test(trimmed)) continue

    const nodeDefRe = /\b([A-Za-z][A-Za-z0-9_]*)\s*(?:[\[\(\{]|:::)/g
    let match: RegExpExecArray | null
    while ((match = nodeDefRe.exec(trimmed))) ids.add(match[1])

    const edgeEndpointRe =
      /\b([A-Za-z][A-Za-z0-9_]*)\s*(?=(?:-->|---->|---|-\.->|==>|--o|--x|<-->|\&))/g
    while ((match = edgeEndpointRe.exec(trimmed))) ids.add(match[1])

    const edgeTargetRe =
      /(?:-->|---->|---|-\.->|==>|--o|--x|<-->)\s*(?:\|[^|]*\|\s*)?([A-Za-z][A-Za-z0-9_]*)/g
    while ((match = edgeTargetRe.exec(trimmed))) ids.add(match[1])
  }

  return [...ids]
}

function stripInjectedStyles(source: string): string {
  return stripFrontmatter(source)
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim()
      if (trimmed.startsWith(`classDef ${INJECTED_CLASS_PREFIX}`)) return false
      if (trimmed.startsWith('class ') && trimmed.includes(INJECTED_CLASS_PREFIX)) return false
      return true
    })
    .join('\n')
    .trim()
}

/** 为流程图节点注入绚丽多色 classDef */
export function injectFlowchartVividStyles(source: string, colorSchemeId: ColorSchemeId): string {
  if (!isFlowchartSource(source)) return source

  const cleaned = stripInjectedStyles(source)
  const nodeIds = extractFlowchartNodeIds(cleaned)
  if (nodeIds.length === 0) return cleaned

  const palette = getVividNodePalette(colorSchemeId)
  const classDefs = palette.map((color, index) => {
    const stroke = darkenColor(color, 0.22)
    const text = contrastLabelColor(color)
    return `classDef ${INJECTED_CLASS_PREFIX}${index} fill:${color},stroke:${stroke},color:${text},stroke-width:2.5px`
  })

  const classLines = nodeIds.map((id, index) => {
    const cls = `${INJECTED_CLASS_PREFIX}${index % palette.length}`
    return `class ${id} ${cls}`
  })

  const header = source.match(/^---\s*\n[\s\S]*?\n---\s*\n?/)?.[0] ?? ''
  return `${header}${cleaned}\n${classDefs.join('\n')}\n${classLines.join('\n')}`
}

/** 流程图节点用高饱和色循环 */
export function getVividNodePalette(colorSchemeId: ColorSchemeId): string[] {
  const colors = getColors(colorSchemeId)
  if (colorSchemeId === 'mono' || colorSchemeId === 'business') {
    return colors.slice(0, 4).map((color, index) =>
      index % 2 === 0 ? color : lightenColor(color, 0.25),
    )
  }
  if (colorSchemeId === 'pastel') {
    return colors.map((color) => lightenColor(color, 0.08))
  }
  return colors
}

function getMindmapNodeSection(group: Element): number | null {
  const match = (group.getAttribute('class') ?? '').match(/section-(\d+)/)
  return match ? Number.parseInt(match[1], 10) : null
}

function isMindmapRootNode(group: Element, index: number): boolean {
  const cls = group.getAttribute('class') ?? ''
  return index === 0 || /\broot\b/i.test(cls) || cls.includes('section-root')
}

function ensureMindmapSvgDefs(
  doc: Document,
  svgEl: SVGSVGElement,
  palette: string[],
): void {
  let defs = svgEl.querySelector('defs')
  if (!defs) {
    defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs')
    svgEl.insertBefore(defs, svgEl.firstChild)
  }

  if (!defs.querySelector('#cc-mindmap-shadow')) {
    const filter = doc.createElementNS('http://www.w3.org/2000/svg', 'filter')
    filter.setAttribute('id', 'cc-mindmap-shadow')
    filter.setAttribute('x', '-25%')
    filter.setAttribute('y', '-25%')
    filter.setAttribute('width', '150%')
    filter.setAttribute('height', '150%')

    const shadow = doc.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow')
    shadow.setAttribute('dx', '0')
    shadow.setAttribute('dy', '3')
    shadow.setAttribute('stdDeviation', '4.5')
    shadow.setAttribute('flood-color', palette[0] ?? '#6366f1')
    shadow.setAttribute('flood-opacity', '0.28')
    filter.appendChild(shadow)
    defs.appendChild(filter)
  }

  if (!defs.querySelector('#cc-mindmap-glow')) {
    const filter = doc.createElementNS('http://www.w3.org/2000/svg', 'filter')
    filter.setAttribute('id', 'cc-mindmap-glow')
    filter.setAttribute('x', '-40%')
    filter.setAttribute('y', '-40%')
    filter.setAttribute('width', '180%')
    filter.setAttribute('height', '180%')

    const glow = doc.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow')
    glow.setAttribute('dx', '0')
    glow.setAttribute('dy', '0')
    glow.setAttribute('stdDeviation', '6')
    glow.setAttribute('flood-color', palette[1] ?? palette[0] ?? '#a855f7')
    glow.setAttribute('flood-opacity', '0.45')
    filter.appendChild(glow)
    defs.appendChild(filter)
  }

  if (!defs.querySelector('#cc-mindmap-root-grad')) {
    const rootGrad = doc.createElementNS('http://www.w3.org/2000/svg', 'radialGradient')
    rootGrad.setAttribute('id', 'cc-mindmap-root-grad')
    rootGrad.setAttribute('cx', '35%')
    rootGrad.setAttribute('cy', '35%')
    rootGrad.setAttribute('r', '75%')

    ;[0.15, 0.55, 1].forEach((offset, index) => {
      const stop = doc.createElementNS('http://www.w3.org/2000/svg', 'stop')
      stop.setAttribute('offset', `${offset * 100}%`)
      const base = palette[index % palette.length]
      stop.setAttribute('stop-color', index === 0 ? lightenColor(base, 0.18) : index === 1 ? base : darkenColor(base, 0.12))
      rootGrad.appendChild(stop)
    })
    defs.appendChild(rootGrad)
  }

  palette.forEach((color, index) => {
    const branchGradId = `cc-mindmap-branch-grad-${index}`
    if (defs!.querySelector(`#${branchGradId}`)) return

    const gradient = doc.createElementNS('http://www.w3.org/2000/svg', 'linearGradient')
    gradient.setAttribute('id', branchGradId)
    gradient.setAttribute('x1', '0%')
    gradient.setAttribute('y1', '0%')
    gradient.setAttribute('x2', '100%')
    gradient.setAttribute('y2', '100%')

    const stop1 = doc.createElementNS('http://www.w3.org/2000/svg', 'stop')
    stop1.setAttribute('offset', '0%')
    stop1.setAttribute('stop-color', lightenColor(color, 0.14))

    const stop2 = doc.createElementNS('http://www.w3.org/2000/svg', 'stop')
    stop2.setAttribute('offset', '100%')
    stop2.setAttribute('stop-color', color)

    gradient.appendChild(stop1)
    gradient.appendChild(stop2)
    defs!.appendChild(gradient)

    const leafGradId = `cc-mindmap-leaf-grad-${index}`
    if (defs!.querySelector(`#${leafGradId}`)) return

    const leafGrad = doc.createElementNS('http://www.w3.org/2000/svg', 'linearGradient')
    leafGrad.setAttribute('id', leafGradId)
    leafGrad.setAttribute('x1', '0%')
    leafGrad.setAttribute('y1', '0%')
    leafGrad.setAttribute('x2', '0%')
    leafGrad.setAttribute('y2', '100%')

    const leafStop1 = doc.createElementNS('http://www.w3.org/2000/svg', 'stop')
    leafStop1.setAttribute('offset', '0%')
    leafStop1.setAttribute('stop-color', lightenColor(color, 0.9))

    const leafStop2 = doc.createElementNS('http://www.w3.org/2000/svg', 'stop')
    leafStop2.setAttribute('offset', '100%')
    leafStop2.setAttribute('stop-color', lightenColor(color, 0.78))

    leafGrad.appendChild(leafStop1)
    leafGrad.appendChild(leafStop2)
    defs!.appendChild(leafGrad)
  })
}

function applyMindmapTextStyle(
  group: Element,
  options: { fill: string; weight: string; isHtml?: boolean },
): void {
  group.querySelectorAll('text, tspan').forEach((textEl) => {
    textEl.setAttribute('fill', options.fill)
    textEl.setAttribute('font-weight', options.weight)
  })
  if (options.isHtml) {
    group.querySelectorAll('foreignObject div, foreignObject span, foreignObject p').forEach((textEl) => {
      textEl.setAttribute('style', `color:${options.fill};font-weight:${options.weight};`)
    })
  }
}

function getMindmapBranchPalette(
  colorSchemeId: ColorSchemeId,
  mindmapTemplate?: MindmapTemplate,
): string[] {
  return getMindmapBranchColors(mindmapTemplate, colorSchemeId, getColors(colorSchemeId))
}

function ensureSvgDefs(
  doc: Document,
  svgEl: SVGSVGElement,
  palette: string[],
  options: { shadowColor: string; forMindmap?: boolean },
): void {
  let defs = svgEl.querySelector('defs')
  if (!defs) {
    defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs')
    svgEl.insertBefore(defs, svgEl.firstChild)
  }

  const shadowId = options.forMindmap ? 'cc-mindmap-shadow' : 'cc-diagram-shadow'
  if (!defs.querySelector(`#${shadowId}`)) {
    const filter = doc.createElementNS('http://www.w3.org/2000/svg', 'filter')
    filter.setAttribute('id', shadowId)
    filter.setAttribute('x', '-20%')
    filter.setAttribute('y', '-20%')
    filter.setAttribute('width', '140%')
    filter.setAttribute('height', '140%')

    const blur = doc.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow')
    blur.setAttribute('dx', '0')
    blur.setAttribute('dy', options.forMindmap ? '2' : '3')
    blur.setAttribute('stdDeviation', options.forMindmap ? '3' : '4')
    blur.setAttribute('flood-color', options.shadowColor)
    blur.setAttribute('flood-opacity', options.forMindmap ? '0.14' : '0.18')
    filter.appendChild(blur)
    defs.appendChild(filter)
  }

  palette.forEach((color, index) => {
    const gradId = `cc-node-grad-${index}`
    if (defs!.querySelector(`#${gradId}`)) return

    const gradient = doc.createElementNS('http://www.w3.org/2000/svg', 'linearGradient')
    gradient.setAttribute('id', gradId)
    gradient.setAttribute('x1', '0%')
    gradient.setAttribute('y1', '0%')
    gradient.setAttribute('x2', '100%')
    gradient.setAttribute('y2', '100%')

    const stop1 = doc.createElementNS('http://www.w3.org/2000/svg', 'stop')
    stop1.setAttribute('offset', '0%')
    stop1.setAttribute('stop-color', lightenColor(color, options.forMindmap ? 0.06 : 0.12))

    const stop2 = doc.createElementNS('http://www.w3.org/2000/svg', 'stop')
    stop2.setAttribute('offset', '100%')
    stop2.setAttribute('stop-color', color)

    gradient.appendChild(stop1)
    gradient.appendChild(stop2)
    defs!.appendChild(gradient)
  })
}

function enhanceFlowchartSvg(svg: string, colorSchemeId: ColorSchemeId): string {
  const palette = getVividNodePalette(colorSchemeId)
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const svgEl = doc.documentElement as unknown as SVGSVGElement
  if (svgEl.querySelector('parsererror')) return svg

  ensureSvgDefs(doc, svgEl, palette, { shadowColor: '#6366f1' })

  svgEl.querySelectorAll('g.node').forEach((group, index) => {
    const color = palette[index % palette.length]
    const shape = group.querySelector('rect, polygon, path, circle, ellipse')
    if (shape) {
      shape.setAttribute('fill', `url(#cc-node-grad-${index % palette.length})`)
      shape.setAttribute('stroke', darkenColor(color, 0.2))
      shape.setAttribute('stroke-width', '2.5')
      shape.setAttribute('filter', 'url(#cc-diagram-shadow)')
      if (shape.tagName === 'rect') {
        shape.setAttribute('rx', '12')
        shape.setAttribute('ry', '12')
      }
    }
    group.querySelectorAll('text, tspan').forEach((textEl) => {
      textEl.setAttribute('font-weight', '600')
    })
  })

  svgEl.querySelectorAll('g.edgePaths path, g.edgePath path, .flowchart-link, path.path').forEach(
    (path, index) => {
      const color = palette[(index + 1) % palette.length]
      path.setAttribute('stroke', color)
      path.setAttribute('stroke-width', '2.2')
      path.setAttribute('stroke-linecap', 'round')
      path.setAttribute('fill', 'none')
    },
  )

  svgEl.querySelectorAll('marker path, marker polygon').forEach((marker, index) => {
    const color = palette[index % palette.length]
    marker.setAttribute('fill', color)
    marker.setAttribute('stroke', color)
  })

  return new XMLSerializer().serializeToString(svgEl)
}

/** 思维导图：按分支着色，渐变节点 + 光晕 + 多级层次 */
function enhanceMindmapSvg(
  svg: string,
  colorSchemeId: ColorSchemeId,
  mindmapTemplate?: MindmapTemplate,
): string {
  const palette = getMindmapBranchPalette(colorSchemeId, mindmapTemplate)
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const svgEl = doc.documentElement as unknown as SVGSVGElement
  if (svgEl.querySelector('parsererror')) return svg

  ensureMindmapSvgDefs(doc, svgEl, palette)

  const nodeGroups = [
    ...svgEl.querySelectorAll('g.node'),
    ...svgEl.querySelectorAll('[class*="section-"]'),
    ...svgEl.querySelectorAll('[class*="mindmap-node"]'),
  ]

  const uniqueGroups = [...new Set(nodeGroups)]
  const sectionHeadSeen = new Set<number>()
  const sectionColors = new Map<number, string>()

  uniqueGroups.forEach((group, index) => {
    const isRoot = isMindmapRootNode(group, index)
    const section = getMindmapNodeSection(group)
    let branchIndex = 0

    if (!isRoot) {
      if (section != null) {
        if (!sectionColors.has(section)) {
          sectionColors.set(section, palette[(sectionColors.size + 1) % palette.length])
        }
        branchIndex = palette.indexOf(sectionColors.get(section) ?? palette[0])
        if (branchIndex < 0) branchIndex = section % palette.length
      } else {
        branchIndex = 1 + ((index - 1) % Math.max(palette.length - 1, 1))
      }
    }

    const color = palette[branchIndex % palette.length]
    const isBranchHead =
      !isRoot && (section == null ? index <= palette.length : !sectionHeadSeen.has(section))
    if (section != null) sectionHeadSeen.add(section)

    const isPrimaryBranch = isRoot || isBranchHead
    const shape = group.querySelector('rect, polygon, path, circle, ellipse')
    const hasHtmlLabel = group.querySelector('foreignObject') != null

    if (shape) {
      if (isRoot) {
        shape.setAttribute('fill', 'url(#cc-mindmap-root-grad)')
        shape.setAttribute('stroke', darkenColor(color, 0.18))
        shape.setAttribute('stroke-width', '3.5')
        shape.setAttribute('filter', 'url(#cc-mindmap-glow)')
        if (shape.tagName === 'circle' || shape.tagName === 'ellipse') {
          shape.setAttribute('stroke-width', '4')
        }
      } else if (isPrimaryBranch) {
        shape.setAttribute('fill', `url(#cc-mindmap-branch-grad-${branchIndex % palette.length})`)
        shape.setAttribute('stroke', darkenColor(color, 0.15))
        shape.setAttribute('stroke-width', '2.8')
        shape.setAttribute('filter', 'url(#cc-mindmap-shadow)')
        if (shape.tagName === 'rect') {
          shape.setAttribute('rx', '12')
          shape.setAttribute('ry', '12')
        }
      } else {
        shape.setAttribute('fill', `url(#cc-mindmap-leaf-grad-${branchIndex % palette.length})`)
        shape.setAttribute('stroke', color)
        shape.setAttribute('stroke-width', '2')
        if (shape.tagName === 'rect') {
          shape.setAttribute('rx', '8')
          shape.setAttribute('ry', '8')
        }
      }
    }

    if (isRoot) {
      applyMindmapTextStyle(group, {
        fill: '#ffffff',
        weight: '700',
        isHtml: hasHtmlLabel,
      })
    } else if (isPrimaryBranch) {
      applyMindmapTextStyle(group, {
        fill: '#ffffff',
        weight: '600',
        isHtml: hasHtmlLabel,
      })
    } else {
      applyMindmapTextStyle(group, {
        fill: darkenColor(color, 0.28),
        weight: '500',
        isHtml: hasHtmlLabel,
      })
    }
  })

  svgEl.querySelectorAll('path, line, polyline').forEach((edge, index) => {
    const className = edge.getAttribute('class') ?? ''
    if (className.includes('edge') || edge.closest('g.edgePaths, g.edgePath, g.edge')) {
      const color = palette[(index + 1) % palette.length]
      edge.setAttribute('stroke', color)
      edge.setAttribute('stroke-width', index % 3 === 0 ? '3' : '2.4')
      edge.setAttribute('stroke-linecap', 'round')
      edge.setAttribute('fill', 'none')
      edge.setAttribute('opacity', '0.92')
    }
  })

  svgEl.querySelectorAll('marker path, marker polygon').forEach((marker, index) => {
    const color = palette[index % palette.length]
    marker.setAttribute('fill', color)
    marker.setAttribute('stroke', color)
  })

  return new XMLSerializer().serializeToString(svgEl)
}

/** 渲染后 SVG 二次美化 */
export function enhanceDiagramSvg(
  svg: string,
  kind: DiagramKind,
  colorSchemeId: ColorSchemeId,
  mindmapTemplate?: MindmapTemplate,
): string {
  if (typeof DOMParser === 'undefined') return svg
  if (kind === 'mindmap') return enhanceMindmapSvg(svg, colorSchemeId, mindmapTemplate)
  return enhanceFlowchartSvg(svg, colorSchemeId)
}
