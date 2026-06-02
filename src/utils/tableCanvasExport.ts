const UNSUPPORTED_CSS_COLOR = /color-mix\s*\(|oklch\s*\(|oklab\s*\(|lab\s*\(|lch\s*\(|color\s*\(/i

function isSafeCssColor(value: string): boolean {
  if (!value || value === 'none' || value === 'transparent') return true
  return !UNSUPPORTED_CSS_COLOR.test(value)
}

function pickSafeColor(...values: string[]): string {
  for (const value of values) {
    if (isSafeCssColor(value)) return value
  }
  return '#ffffff'
}

function parseWidth(value: string): number {
  const n = Number.parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

interface CellDrawInfo {
  x: number
  y: number
  w: number
  h: number
  style: CSSStyleDeclaration
  text: string | null
  textStyle: CSSStyleDeclaration | null
}

function isSheetAxisCell(cell: HTMLElement): boolean {
  return (
    cell.classList.contains('sheet-corner') ||
    cell.classList.contains('sheet-col-header') ||
    cell.classList.contains('sheet-row-header')
  )
}

function collectCells(root: HTMLElement, rootRect: DOMRect): CellDrawInfo[] {
  const items: CellDrawInfo[] = []

  root.querySelectorAll('th, td').forEach((cell) => {
    if (!(cell instanceof HTMLElement)) return
    if (isSheetAxisCell(cell)) return
    if (cell.offsetWidth === 0 && cell.offsetHeight === 0) return

    const rect = cell.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    if (w <= 0 || h <= 0) return

    const snapshot = cell.querySelector('.cell-export-snapshot')
    const input = cell.querySelector('input')
    let text: string | null = null
    let textStyle: CSSStyleDeclaration | null = null

    if (snapshot instanceof HTMLElement) {
      text = snapshot.textContent
      textStyle = getComputedStyle(snapshot)
    } else if (input instanceof HTMLInputElement) {
      text = input.value
      textStyle = getComputedStyle(input)
    } else {
      text = cell.textContent?.trim() ?? null
      textStyle = getComputedStyle(cell)
    }

    items.push({
      x: rect.left - rootRect.left,
      y: rect.top - rootRect.top,
      w,
      h,
      style: getComputedStyle(cell),
      text,
      textStyle,
    })
  })

  return items
}

function drawBorders(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  style: CSSStyleDeclaration,
) {
  const sides = [
    { width: style.borderTopWidth, color: style.borderTopColor, sx: x, sy: y, ex: x + w, ey: y },
    {
      width: style.borderRightWidth,
      color: style.borderRightColor,
      sx: x + w,
      sy: y,
      ex: x + w,
      ey: y + h,
    },
    {
      width: style.borderBottomWidth,
      color: style.borderBottomColor,
      sx: x,
      sy: y + h,
      ex: x + w,
      ey: y + h,
    },
    { width: style.borderLeftWidth, color: style.borderLeftColor, sx: x, sy: y, ex: x, ey: y + h },
  ]

  for (const side of sides) {
    const width = parseWidth(side.width)
    if (width <= 0) continue
    ctx.strokeStyle = pickSafeColor(side.color, '#e2e8f0')
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(side.sx, side.sy)
    ctx.lineTo(side.ex, side.ey)
    ctx.stroke()
  }
}

function drawLinearGradientBackground(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  backgroundImage: string,
  fallback: string,
) {
  const match = backgroundImage.match(
    /linear-gradient\(\s*(?:to\s+(\w+)|([\d.]+deg))?\s*,\s*(.+)\)/i,
  )
  if (!match) {
    ctx.fillStyle = pickSafeColor(fallback, '#ffffff')
    ctx.fillRect(x, y, w, h)
    return
  }

  const direction = match[1] || match[2] || '180deg'
  const stopsRaw = match[3]
  const stops = stopsRaw.split(/,(?![^(]*\))/).map((part) => part.trim())
  const colors = stops
    .map((stop) => stop.replace(/\s+\d+(?:\.\d+)?%$/, '').trim())
    .filter((color) => isSafeCssColor(color))

  if (colors.length < 2) {
    ctx.fillStyle = pickSafeColor(colors[0] || fallback, '#ffffff')
    ctx.fillRect(x, y, w, h)
    return
  }

  let gradient: CanvasGradient
  if (direction === 'right' || direction === '90deg') {
    gradient = ctx.createLinearGradient(x, y, x + w, y)
  } else if (direction === 'left' || direction === '270deg') {
    gradient = ctx.createLinearGradient(x + w, y, x, y)
  } else if (direction === 'top' || direction === '0deg') {
    gradient = ctx.createLinearGradient(x, y + h, x, y)
  } else {
    gradient = ctx.createLinearGradient(x, y, x, y + h)
  }

  const step = 1 / (colors.length - 1)
  colors.forEach((color, index) => gradient.addColorStop(index * step, color))
  ctx.fillStyle = gradient
  ctx.fillRect(x, y, w, h)
}

function fillBackground(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  style: CSSStyleDeclaration,
) {
  const bgImage = style.backgroundImage
  const bgColor = style.backgroundColor

  if (bgImage && bgImage !== 'none' && bgImage.includes('linear-gradient')) {
    drawLinearGradientBackground(ctx, x, y, w, h, bgImage, bgColor)
    return
  }

  if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
    ctx.fillStyle = pickSafeColor(bgColor, '#ffffff')
    ctx.fillRect(x, y, w, h)
  }
}

function drawCellText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  style: CSSStyleDeclaration,
) {
  ctx.fillStyle = pickSafeColor(style.color, '#334155')
  ctx.font = [
    style.fontStyle,
    style.fontVariant,
    style.fontWeight,
    style.fontSize,
    style.fontFamily,
  ]
    .filter(Boolean)
    .join(' ')
  ctx.textBaseline = 'middle'

  const align = style.textAlign || 'left'
  const paddingLeft = parseWidth(style.paddingLeft) || 12
  const paddingRight = parseWidth(style.paddingRight) || 12
  let textX = x + paddingLeft
  if (align === 'center') textX = x + w / 2
  if (align === 'right') textX = x + w - paddingRight
  ctx.textAlign = align as CanvasTextAlign

  ctx.fillText(text, textX, y + h / 2, Math.max(0, w - paddingLeft - paddingRight))
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const r = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/** 用浏览器已解析的计算样式绘制表格，不依赖 html2canvas 的 CSS 解析器。 */
export function renderTableToCanvas(root: HTMLElement, scale = 2): HTMLCanvasElement {
  const width = root.scrollWidth
  const height = root.scrollHeight
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')

  ctx.scale(scale, scale)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  const rootRect = root.getBoundingClientRect()
  const rootStyle = getComputedStyle(root)
  const borderRadius = parseWidth(rootStyle.borderRadius)

  if (borderRadius > 0) {
    ctx.save()
    drawRoundedRectPath(ctx, 0, 0, width, height, borderRadius)
    ctx.clip()
  }

  fillBackground(ctx, 0, 0, width, height, rootStyle)

  const cells = collectCells(root, rootRect)
  for (const cell of cells) {
    fillBackground(ctx, cell.x, cell.y, cell.w, cell.h, cell.style)
  }

  drawBorders(ctx, 0, 0, width, height, rootStyle)
  for (const cell of cells) {
    drawBorders(ctx, cell.x, cell.y, cell.w, cell.h, cell.style)
  }

  for (const cell of cells) {
    if (cell.text && cell.textStyle) {
      drawCellText(ctx, cell.x, cell.y, cell.w, cell.h, cell.text, cell.textStyle)
    }
  }

  if (borderRadius > 0) {
    ctx.restore()
    ctx.strokeStyle = pickSafeColor(rootStyle.borderColor, '#e2e8f0')
    ctx.lineWidth = parseWidth(rootStyle.borderWidth) || 1
    drawRoundedRectPath(ctx, 0.5, 0.5, width - 1, height - 1, borderRadius)
    ctx.stroke()
  }

  return canvas
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('生成图片失败'))
    }, 'image/png')
  })
}
