import { renderAsync } from 'docx-preview'

export interface DocxPreviewResult {
  /** 预览区可见纯文本（用于与 XML 提取结果对照） */
  visibleText: string
}

export async function renderDocxPreview(
  arrayBuffer: ArrayBuffer,
  container: HTMLElement,
): Promise<DocxPreviewResult> {
  container.replaceChildren()

  const styleContainer = document.createElement('div')
  styleContainer.className = 'docx-preview-styles'
  const bodyContainer = document.createElement('div')
  bodyContainer.className = 'docx-preview-body'

  container.append(styleContainer, bodyContainer)

  await renderAsync(arrayBuffer, bodyContainer, styleContainer, {
    className: 'docx-preview-page',
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    breakPages: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    ignoreLastRenderedPageBreak: false,
  })

  return { visibleText: bodyContainer.innerText.replace(/\u00a0/g, ' ').trim() }
}
