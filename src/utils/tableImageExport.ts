import { canvasToBlob, renderTableToCanvas } from './tableCanvasExport'
import { saveFile } from './saveFile'

function prepareLiveTableForExport(tableScroll: HTMLElement): () => void {
  tableScroll.classList.add('table-export-capture')

  const table = tableScroll.querySelector('.data-table')
  const hadAxisHidden = table?.classList.contains('sheet-axis-hidden') ?? false
  if (table instanceof HTMLElement) {
    table.classList.add('sheet-axis-hidden')
  }

  const prevOverflow = tableScroll.style.overflow
  const prevMaxHeight = tableScroll.style.maxHeight
  tableScroll.style.overflow = 'visible'
  tableScroll.style.maxHeight = 'none'

  const snapshots: Array<{
    snapshot: HTMLElement
    input: HTMLInputElement
    highlight: HTMLElement | null
  }> = []

  tableScroll.querySelectorAll('.cell-input-wrap').forEach((wrap) => {
    if (!(wrap instanceof HTMLElement)) return
    const input = wrap.querySelector('input')
    if (!(input instanceof HTMLInputElement)) return

    const highlight = wrap.querySelector('.cell-formula-highlight') as HTMLElement | null
    const snapshot = document.createElement('div')
    snapshot.className = 'cell-export-snapshot'
    snapshot.setAttribute('aria-hidden', 'true')

    if (highlight) {
      snapshot.innerHTML = highlight.innerHTML
      const hs = getComputedStyle(highlight)
      snapshot.style.font = hs.font
      snapshot.style.color = hs.color
      snapshot.style.textAlign = hs.textAlign
      snapshot.style.padding = hs.padding
      snapshot.style.lineHeight = hs.lineHeight
      snapshot.style.whiteSpace = 'pre'
      snapshot.style.boxSizing = 'border-box'
      snapshot.style.width = '100%'
    } else {
      snapshot.textContent = input.value
      const cs = getComputedStyle(input)
      snapshot.style.font = cs.font
      snapshot.style.color = cs.color
      snapshot.style.textAlign = cs.textAlign
      snapshot.style.padding = cs.padding
      snapshot.style.lineHeight = cs.lineHeight
      snapshot.style.fontWeight = cs.fontWeight
      snapshot.style.boxSizing = 'border-box'
      snapshot.style.width = '100%'
    }

    input.style.display = 'none'
    if (highlight) highlight.style.display = 'none'
    wrap.appendChild(snapshot)
    snapshots.push({ snapshot, input, highlight })
  })

  return () => {
    for (const { snapshot, input, highlight } of snapshots) {
      snapshot.remove()
      input.style.display = ''
      if (highlight) highlight.style.removeProperty('display')
    }
    if (table instanceof HTMLElement) {
      if (!hadAxisHidden) table.classList.remove('sheet-axis-hidden')
    }
    tableScroll.classList.remove('table-export-capture')
    tableScroll.style.overflow = prevOverflow
    tableScroll.style.maxHeight = prevMaxHeight
  }
}

export async function exportTableToImage(
  themedElement: HTMLElement,
  filename = `table-${Date.now()}.png`,
): Promise<boolean> {
  const tableScroll = themedElement.querySelector('.table-scroll')
  if (!tableScroll || !(tableScroll instanceof HTMLElement)) {
    throw new Error('未找到可导出的表格')
  }

  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

  const restore = prepareLiveTableForExport(tableScroll)
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

  try {
    const width = tableScroll.scrollWidth
    const height = tableScroll.scrollHeight
    if (width <= 0 || height <= 0) {
      throw new Error('表格尺寸异常，无法导出')
    }

    const canvas = renderTableToCanvas(tableScroll, 2)
    const blob = await canvasToBlob(canvas)
    return saveFile(blob, {
      suggestedName: filename,
      description: 'PNG 图片',
      accept: { 'image/png': ['.png'] },
    })
  } finally {
    restore()
  }
}
