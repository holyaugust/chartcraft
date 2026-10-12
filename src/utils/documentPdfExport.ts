import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { A4_PAGE_PX, buildOfficialLayoutPages } from './documentA4Layout'
import { saveFile } from './saveFile'

const PAGE_INLINE_STYLE = `
  box-sizing: border-box;
  width: ${A4_PAGE_PX.width}px;
  height: ${A4_PAGE_PX.height}px;
  padding: ${A4_PAGE_PX.paddingY}px ${A4_PAGE_PX.paddingX}px;
  background: #fff;
  color: #1e293b;
  overflow: hidden;
`.trim()

function applyOfficialLayoutStyles(page: HTMLElement) {
  page.style.cssText = PAGE_INLINE_STYLE
  const style = document.createElement('style')
  style.textContent = `
    .document-pdf-export-page .doc-layout-empty {
      margin: 40px 0;
      text-align: center;
      color: #94a3b8;
      font-size: 13px;
    }
    .document-pdf-export-page .doc-layout-gap { height: 12px; }
    .document-pdf-export-page .doc-layout-p {
      margin: 0 0 10px;
      font-size: 15px;
      line-height: 1.85;
      color: #1e293b;
      font-family: 'FangSong', '仿宋', 'STFangsong', 'Songti SC', serif;
      text-align: justify;
    }
    .document-pdf-export-page .doc-layout-title {
      text-align: center;
      font-family: 'STZhongsong', '华文中宋', 'SimSun', '宋体', 'Songti SC', serif;
      font-weight: 700;
      font-size: 22px;
      line-height: 1.55;
      text-indent: 0 !important;
      margin: 12px 0 22px;
      letter-spacing: 0.04em;
    }
    .document-pdf-export-page .doc-layout-redHeader,
    .document-pdf-export-page .doc-layout-enterpriseBanner {
      text-align: center;
      font-family: 'SimHei', '黑体', 'Microsoft YaHei', sans-serif;
      font-weight: 700;
      font-size: 18px;
      line-height: 1.6;
      text-indent: 0;
      margin: 8px 0 18px;
    }
    .document-pdf-export-page .doc-layout-redHeader { color: #c10000; }
    .document-pdf-export-page .doc-layout-recipient,
    .document-pdf-export-page .doc-layout-heading1,
    .document-pdf-export-page .doc-layout-heading2,
    .document-pdf-export-page .doc-layout-heading3,
    .document-pdf-export-page .doc-layout-heading4,
    .document-pdf-export-page .doc-layout-attachment,
    .document-pdf-export-page .doc-layout-copyTo,
    .document-pdf-export-page .doc-layout-closing { text-indent: 0; }
    .document-pdf-export-page .doc-layout-heading1 {
      font-family: 'SimHei', '黑体', 'Microsoft YaHei', sans-serif;
      font-weight: 700;
      margin-top: 18px;
    }
    .document-pdf-export-page .doc-layout-heading2 {
      font-family: 'KaiTi', '楷体', 'STKaiti', serif;
      font-weight: 700;
      margin-top: 14px;
    }
    .document-pdf-export-page .doc-layout-heading3,
    .document-pdf-export-page .doc-layout-heading4 {
      font-weight: 700;
      margin-top: 10px;
    }
    .document-pdf-export-page .doc-layout-body,
    .document-pdf-export-page .doc-layout-numberedItem { text-indent: 2em; }
    .document-pdf-export-page .doc-layout-signatureOrg,
    .document-pdf-export-page .doc-layout-signatureDate {
      text-align: right;
      text-indent: 0;
      margin-left: auto;
      max-width: 60%;
    }
  `
  page.appendChild(style)
}

function mountPdfPage(pageHtml: string): { host: HTMLDivElement; page: HTMLElement } {
  const host = document.createElement('div')
  host.setAttribute('data-document-pdf-export', 'true')
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;opacity:1;pointer-events:none;z-index:-1;'

  const page = document.createElement('div')
  page.className = 'document-official-layout-page document-pdf-export-page'
  applyOfficialLayoutStyles(page)

  const content = document.createElement('div')
  content.className = 'document-a4-page-content'
  content.innerHTML = pageHtml
  page.appendChild(content)

  host.appendChild(page)
  document.body.appendChild(host)
  return { host, page }
}

async function capturePageCanvas(page: HTMLElement): Promise<HTMLCanvasElement> {
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })

  return html2canvas(page, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    width: A4_PAGE_PX.width,
    height: A4_PAGE_PX.height,
    windowWidth: A4_PAGE_PX.width,
    windowHeight: A4_PAGE_PX.height,
  })
}

/** 按公文版式预览样式生成版式型 PDF Blob（每页单独截图，避免切字） */
export async function buildDocumentPdfBlob(content: string): Promise<Blob> {
  const text = content.replace(/\r\n/g, '\n').trim()
  if (!text) {
    throw new Error('文档内容为空，无法导出 PDF')
  }

  const { pagesHtml } = buildOfficialLayoutPages(text)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()

  for (let i = 0; i < pagesHtml.length; i += 1) {
    const { host, page } = mountPdfPage(pagesHtml[i] ?? '')
    try {
      const canvas = await capturePageCanvas(page)
      const imgData = canvas.toDataURL('image/jpeg', 0.92)
      if (i > 0) pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight)
    } finally {
      host.remove()
    }
  }

  return pdf.output('blob')
}

export async function exportDocumentToPdf(
  content: string,
  options: { fileName?: string } = {},
): Promise<boolean> {
  const blob = await buildDocumentPdfBlob(content)
  const suggestedName = options.fileName?.trim() || '报告文档.pdf'
  return saveFile(blob, {
    suggestedName: suggestedName.endsWith('.pdf') ? suggestedName : `${suggestedName}.pdf`,
    description: 'PDF 文档',
    accept: { 'application/pdf': ['.pdf'] },
  })
}
