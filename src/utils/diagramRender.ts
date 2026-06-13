import type { ColorSchemeId } from '../types'
import type { DiagramKind } from '../types/diagram'
import type { MindmapTemplate } from '../data/mindmapTemplates'
import { getDiagramColorTheme } from './diagramColorSchemes'
import { attachDiagramEditMetadata } from './diagramSourceEdit'
import {
  enhanceDiagramSvg,
  injectFlowchartVividStyles,
  isMindmapFlowchartConflict,
  prepareMindmapSource,
  stripMindmapLayoutConfig,
} from './diagramStyleEnhance'

let lastRenderKey = ''
let renderCounter = 0

const FLOWCHART_THEME_CSS = `
  .node .label, .nodeLabel { font-weight: 600; }
  .edgeLabel .label { font-weight: 500; }
  .cluster .label text { font-weight: 700; }
  .flowchart-link { stroke-linecap: round; stroke-linejoin: round; }
`

const MINDMAP_THEME_CSS = `
  .node .label, .nodeLabel { font-weight: 600; letter-spacing: 0.01em; }
  .mindmap-node { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; }
  .edgePath path, .edgePaths path { stroke-linecap: round; stroke-linejoin: round; }
  .section-root .nodeLabel, .section-root text { font-weight: 700; }
`

async function getMermaid(kind: DiagramKind, colorSchemeId: ColorSchemeId, htmlLabels = true) {
  const mermaid = (await import('mermaid')).default

  const renderKey = `${kind}:${colorSchemeId}:${htmlLabels ? 'html' : 'svg'}`

  if (lastRenderKey !== renderKey) {
    const theme = getDiagramColorTheme(colorSchemeId)
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      htmlLabels,
      theme: 'base',
      themeVariables: {
        ...theme.themeVariables,
        ...(kind === 'mindmap'
          ? {
              primaryColor: '#ffffff',
              primaryBorderColor: '#cbd5e1',
              lineColor: theme.themeVariables.lineColor,
              fontSize: '15px',
            }
          : {}),
      },
      themeCSS: kind === 'mindmap' ? MINDMAP_THEME_CSS : FLOWCHART_THEME_CSS,
      flowchart: {
        htmlLabels,
        curve: 'basis',
        padding: 20,
        nodeSpacing: 58,
        rankSpacing: 72,
        diagramPadding: 18,
        useMaxWidth: true,
      },
    })
    lastRenderKey = renderKey
  }

  return mermaid
}

function buildMindmapFallbackSource(source: string): string {
  const lines = stripMindmapLayoutConfig(source)
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)

  const mindmapIndex = lines.findIndex((line) => /^mindmap\b/i.test(line.trim()))
  if (mindmapIndex >= 0) {
    return lines.slice(mindmapIndex).join('\n')
  }

  return `mindmap\n  root((主题))\n    分支一\n    分支二`
}

export interface RenderMermaidOptions {
  /** 预览默认 true；PNG 导出需 false，避免 foreignObject 污染 canvas */
  htmlLabels?: boolean
  attachEditMetadata?: boolean
}

export async function renderMermaidToSvg(
  source: string,
  kind: DiagramKind,
  colorSchemeId: ColorSchemeId,
  mindmapTemplate?: MindmapTemplate,
  options: RenderMermaidOptions = {},
): Promise<string> {
  const htmlLabels = options.htmlLabels ?? true
  const attachEditMetadata = options.attachEditMetadata ?? true
  const trimmed = source.trim()
  if (!trimmed) throw new Error('Mermaid 源码为空')

  if (kind === 'mindmap' && isMindmapFlowchartConflict(trimmed)) {
    throw new Error('当前源码是流程图格式。思维导图请使用 mindmap 树形语法，或点击右侧「含示例」载入模板。')
  }

  const renderSource =
    kind === 'flowchart' ? injectFlowchartVividStyles(trimmed, colorSchemeId) : prepareMindmapSource(trimmed)

  const mermaid = await getMermaid(kind, colorSchemeId, htmlLabels)
  renderCounter += 1
  const id = `chartcraft-mermaid-${kind}-${colorSchemeId}-${renderCounter}`

  try {
    const result = await mermaid.render(id, renderSource)
    const enhanced = enhanceDiagramSvg(result.svg, kind, colorSchemeId, mindmapTemplate)
    return attachEditMetadata ? attachDiagramEditMetadata(enhanced, source, kind) : enhanced
  } catch (firstErr) {
    if (kind !== 'mindmap') {
      const message = firstErr instanceof Error ? firstErr.message : 'Mermaid 渲染失败'
      throw new Error(message)
    }

    try {
      const fallbackSource = buildMindmapFallbackSource(renderSource)
      const result = await mermaid.render(`${id}-fallback`, fallbackSource)
      const enhanced = enhanceDiagramSvg(result.svg, kind, colorSchemeId, mindmapTemplate)
      return attachEditMetadata ? attachDiagramEditMetadata(enhanced, source, kind) : enhanced
    } catch {
      const message = firstErr instanceof Error ? firstErr.message : 'Mermaid 渲染失败'
      throw new Error(message)
    }
  }
}

export async function svgToPngBlob(svg: string, scale = 2, backgroundColor = '#ffffff'): Promise<Blob> {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const svgEl = doc.documentElement
  const width = Number.parseFloat(svgEl.getAttribute('width') ?? '800')
  const height = Number.parseFloat(svgEl.getAttribute('height') ?? '600')

  let w = width
  let h = height
  if (!Number.isFinite(w) || !Number.isFinite(h)) {
    const viewBox = svgEl.getAttribute('viewBox')?.split(/\s+/).map(Number) ?? []
    if (viewBox.length === 4) {
      w = viewBox[2]
      h = viewBox[3]
    } else {
      w = 960
      h = 640
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(w * scale)
  canvas.height = Math.ceil(h * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')

  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('SVG 转 PNG 失败'))
      image.src = url
    })
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  } finally {
    URL.revokeObjectURL(url)
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('PNG 导出失败'))
    }, 'image/png')
  })
}
