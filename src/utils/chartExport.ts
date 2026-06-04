import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import type { EChartsOption } from 'echarts'
import { jsPDF } from 'jspdf'
import type { ExportScenario } from '../data/exportScenarios'
import { getClipboardPasteLayout, type ClipboardPasteLayout } from '../data/exportScenarios'
import { saveFile } from './saveFile'

export type ChartExportBackground = 'white' | 'transparent'

export function getExportBackgroundColor(background: ChartExportBackground): string {
  return background === 'transparent' ? 'transparent' : '#ffffff'
}

export function dataUrlToBlob(dataUrl: string, fallbackMime = 'image/png'): Blob {
  const [header, payload] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? fallbackMime

  if (header.includes('base64')) {
    const binary = atob(payload)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new Blob([bytes], { type: mime })
  }

  return new Blob([decodeURIComponent(payload)], { type: mime })
}

/** 导出时关闭动画，避免截图时柱/线尚未绘制 */
export function prepareChartOptionForExport(option: EChartsOption): EChartsOption {
  const next = JSON.parse(JSON.stringify(option)) as EChartsOption
  next.animation = false
  next.animationDuration = 0
  next.animationEasing = 'linear'

  if (Array.isArray(next.series)) {
    next.series = next.series.map((series) => {
      if (!series || typeof series !== 'object') return series
      return {
        ...series,
        animation: false,
        animationDuration: 0,
      }
    })
  }

  return next
}

function waitForChartRender(chart: echarts.ECharts): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      chart.off('finished', done)
      resolve()
    }

    chart.on('finished', done)
    requestAnimationFrame(() => {
      requestAnimationFrame(done)
    })
    window.setTimeout(done, 600)
  })
}

async function renderOffscreenChart(
  option: EChartsOption,
  width: number,
  height: number,
  renderer: 'canvas' | 'svg',
): Promise<echarts.ECharts> {
  const container = document.createElement('div')
  // 不用 left:-10000px，避免浏览器跳过 Canvas 绘制
  container.style.cssText = [
    `width:${width}px`,
    `height:${height}px`,
    'position:fixed',
    'left:0',
    'top:0',
    'opacity:0',
    'pointer-events:none',
    'z-index:-1',
  ].join(';')
  document.body.appendChild(container)

  const chart = echarts.init(container, undefined, { renderer, width, height })
  const exportOption = prepareChartOptionForExport(option)
  chart.setOption(exportOption, { notMerge: true, lazyUpdate: false })
  chart.resize({ width, height })
  await waitForChartRender(chart)
  return chart
}

function disposeOffscreenChart(chart: echarts.ECharts) {
  const dom = chart.getDom()
  echarts.dispose(chart)
  dom.parentElement?.removeChild(dom)
}

const MAX_EXPORT_PIXEL_RATIO = 4

/** 从预览区实时图表截图，布局与屏幕所见完全一致，仅提高清晰度 */
export function captureLiveChartPng(
  instance: ECharts,
  background: ChartExportBackground,
  targetWidth?: number,
): { dataUrl: string; width: number; height: number; pixelRatio: number } {
  const viewWidth = instance.getWidth()
  const viewHeight = instance.getHeight()

  if (viewWidth <= 0 || viewHeight <= 0) {
    throw new Error('图表尚未完成渲染，请稍后再导出')
  }

  let pixelRatio = targetWidth ? targetWidth / viewWidth : 3
  pixelRatio = Math.min(Math.max(pixelRatio, 1), MAX_EXPORT_PIXEL_RATIO)

  const dataUrl = instance.getDataURL({
    type: 'png',
    pixelRatio,
    backgroundColor: getExportBackgroundColor(background),
  })

  return {
    dataUrl,
    width: Math.round(viewWidth * pixelRatio),
    height: Math.round(viewHeight * pixelRatio),
    pixelRatio,
  }
}

async function capturePngDataUrl(
  option: EChartsOption,
  background: ChartExportBackground,
  liveInstance: ECharts | undefined,
  targetWidth?: number,
  fallback?: { width: number; height: number; pixelRatio?: number },
): Promise<{ dataUrl: string; width: number; height: number }> {
  if (liveInstance) {
    return captureLiveChartPng(liveInstance, background, targetWidth)
  }

  if (!fallback) {
    throw new Error('图表未就绪，无法导出')
  }

  const dataUrl = await renderChartToPngDataUrl(option, {
    width: fallback.width,
    height: fallback.height,
    pixelRatio: fallback.pixelRatio ?? 2,
    background,
  })

  const ratio = fallback.pixelRatio ?? 2
  return {
    dataUrl,
    width: fallback.width * ratio,
    height: fallback.height * ratio,
  }
}

function ensurePngBlob(blob: Blob): Blob {
  if (blob.type === 'image/png') return blob
  return new Blob([blob], { type: 'image/png' })
}

/** 写入多种剪贴板格式，提升 Word / PowerPoint 兼容性 */
async function writeImageToClipboard(
  pngBlob: Blob,
  dataUrl: string,
  layout: ClipboardPasteLayout,
): Promise<void> {
  const blob = ensurePngBlob(pngBlob)

  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('当前浏览器不支持复制图片，请使用 Chrome / Edge 或改下载 PNG')
  }

  const { pasteWidthPt, pasteHeightPt } = layout
  const html = [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">',
    '<head><meta charset="utf-8"></head>',
    '<body>',
    '<!--StartFragment-->',
    `<img src="${dataUrl}" alt="chart" width="${pasteWidthPt}" height="${pasteHeightPt}" `,
    `style="width:${pasteWidthPt}pt;height:${pasteHeightPt}pt;" />`,
    '<!--EndFragment-->',
    '</body></html>',
  ].join('')

  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob,
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([''], { type: 'text/plain' }),
      }),
    ])
    return
  } catch {
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob,
      }),
    ])
  }
}

async function copyViaImageElement(dataUrl: string, layout: ClipboardPasteLayout): Promise<void> {
  const img = document.createElement('img')
  img.src = dataUrl
  img.style.width = `${layout.pasteWidthPt}pt`
  img.style.height = `${layout.pasteHeightPt}pt`
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('图片加载失败'))
  })

  const wrapper = document.createElement('div')
  wrapper.contentEditable = 'true'
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;'
  wrapper.appendChild(img)
  document.body.appendChild(wrapper)

  const selection = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(wrapper)
  selection?.removeAllRanges()
  selection?.addRange(range)

  try {
    const copied = document.execCommand('copy')
    if (!copied) {
      throw new Error('复制失败')
    }
  } finally {
    selection?.removeAllRanges()
    document.body.removeChild(wrapper)
  }
}

export async function renderChartToPngDataUrl(
  option: EChartsOption,
  params: {
    width: number
    height: number
    pixelRatio?: number
    background?: ChartExportBackground
  },
): Promise<string> {
  const { width, height, pixelRatio = 2, background = 'white' } = params
  const chart = await renderOffscreenChart(option, width, height, 'canvas')

  try {
    return chart.getDataURL({
      type: 'png',
      pixelRatio,
      backgroundColor: getExportBackgroundColor(background),
    })
  } finally {
    disposeOffscreenChart(chart)
  }
}

export async function renderChartToSvgDataUrl(
  option: EChartsOption,
  width: number,
  height: number,
  background: ChartExportBackground = 'white',
): Promise<string> {
  const chart = await renderOffscreenChart(option, width, height, 'svg')

  try {
    return chart.getDataURL({
      type: 'svg',
      backgroundColor: getExportBackgroundColor(background),
    })
  } finally {
    disposeOffscreenChart(chart)
  }
}

export async function saveChartSvg(
  option: EChartsOption,
  width: number,
  height: number,
  filename: string,
  background: ChartExportBackground = 'white',
): Promise<boolean> {
  const dataUrl = await renderChartToSvgDataUrl(option, width, height, background)
  const blob = dataUrlToBlob(dataUrl, 'image/svg+xml;charset=utf-8')
  return saveFile(blob, {
    suggestedName: filename,
    description: 'SVG 矢量图',
    accept: { 'image/svg+xml': ['.svg'] },
  })
}

export async function saveChartPng(
  option: EChartsOption,
  scenario: ExportScenario,
  filename: string,
  background: ChartExportBackground,
  liveInstance?: ECharts,
): Promise<boolean> {
  const { dataUrl } = await capturePngDataUrl(option, background, liveInstance, scenario.width, {
    width: scenario.width,
    height: scenario.height,
    pixelRatio: scenario.pixelRatio,
  })
  const blob = dataUrlToBlob(dataUrl)
  return saveFile(blob, {
    suggestedName: filename,
    description: 'PNG 图片',
    accept: { 'image/png': ['.png'] },
  })
}

export async function copyChartPngToClipboard(
  option: EChartsOption,
  scenario: ExportScenario,
  background: ChartExportBackground,
  liveInstance?: ECharts,
): Promise<void> {
  const layout = getClipboardPasteLayout(scenario)
  const { dataUrl } = await capturePngDataUrl(
    option,
    background,
    liveInstance,
    layout.renderWidth,
    {
      width: layout.renderWidth,
      height: layout.renderHeight,
      pixelRatio: layout.pixelRatio,
    },
  )
  const blob = ensurePngBlob(dataUrlToBlob(dataUrl))

  try {
    await writeImageToClipboard(blob, dataUrl, layout)
  } catch {
    await copyViaImageElement(dataUrl, layout)
  }
}

export async function saveChartPdfFromPng(
  pngDataUrl: string,
  width: number,
  height: number,
  filename: string,
): Promise<boolean> {
  const pdf = new jsPDF({
    orientation: width >= height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [width, height],
  })
  pdf.addImage(pngDataUrl, 'PNG', 0, 0, width, height)
  const blob = pdf.output('blob')
  return saveFile(blob, {
    suggestedName: filename,
    description: 'PDF 文档',
    accept: { 'application/pdf': ['.pdf'] },
  })
}

export async function saveChartPdfA4Landscape(
  pngDataUrl: string,
  imgWidth: number,
  imgHeight: number,
  filename: string,
): Promise<boolean> {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 12
  const maxWidth = pageWidth - margin * 2
  const maxHeight = pageHeight - margin * 2
  const scale = Math.min(maxWidth / imgWidth, maxHeight / imgHeight)
  const drawWidth = imgWidth * scale
  const drawHeight = imgHeight * scale
  const x = (pageWidth - drawWidth) / 2
  const y = (pageHeight - drawHeight) / 2

  pdf.addImage(pngDataUrl, 'PNG', x, y, drawWidth, drawHeight)
  const blob = pdf.output('blob')
  return saveFile(blob, {
    suggestedName: filename,
    description: 'A4 PDF',
    accept: { 'application/pdf': ['.pdf'] },
  })
}

export async function saveScenarioChartPdf(
  option: EChartsOption,
  scenario: ExportScenario,
  filename: string,
  liveInstance?: ECharts,
): Promise<boolean> {
  const { dataUrl, width: imgWidth, height: imgHeight } = await capturePngDataUrl(
    option,
    'white',
    liveInstance,
    scenario.width,
    {
      width: scenario.width,
      height: scenario.height,
      pixelRatio: scenario.pixelRatio,
    },
  )

  if (scenario.useA4Pdf) {
    return saveChartPdfA4Landscape(dataUrl, imgWidth, imgHeight, filename)
  }

  return saveChartPdfFromPng(dataUrl, imgWidth, imgHeight, filename)
}
