import html2canvas from 'html2canvas'
import { saveFile } from './saveFile'
import { getSmartGraphicColorTheme } from './smartGraphicColorSchemes'
import type { SmartGraphicColorSchemeId } from '../types/smartGraphic'

export async function captureElementToPng(element: HTMLElement, scale = 2, backgroundColor?: string): Promise<Blob> {
  const width = element.offsetWidth
  const height = element.offsetHeight
  const canvas = await html2canvas(element, {
    scale,
    backgroundColor: backgroundColor ?? '#fafbfd',
    useCORS: true,
    logging: false,
    width,
    height,
    windowWidth: width,
    windowHeight: height,
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNG 生成失败'))
    }, 'image/png')
  })
}

export async function saveSmartGraphicPngFromElement(
  element: HTMLElement,
  fileName?: string,
  colorSchemeId?: SmartGraphicColorSchemeId,
): Promise<boolean> {
  const theme = getSmartGraphicColorTheme(colorSchemeId ?? 'blue')
  const bg = colorSchemeId === 'blue' ? '#eef3fa' : theme.background
  const blob = await captureElementToPng(element, 2, bg)
  const safe = (fileName || '智能图形').replace(/[\\/:*?"<>|]/g, '_')
  return saveFile(blob, {
    suggestedName: `${safe}.png`,
    description: 'PNG 图片',
    accept: { 'image/png': ['.png'] },
  })
}

export async function copySmartGraphicPngFromElement(
  element: HTMLElement,
  colorSchemeId?: SmartGraphicColorSchemeId,
): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('当前浏览器不支持复制图片，请使用 Chrome / Edge 或改下载 PNG')
  }

  const theme = getSmartGraphicColorTheme(colorSchemeId ?? 'blue')
  const bg = colorSchemeId === 'blue' ? '#eef3fa' : theme.background
  const blob = await captureElementToPng(element, 2, bg)
  await navigator.clipboard.write([
    new ClipboardItem({
      'image/png': blob,
    }),
  ])
}
