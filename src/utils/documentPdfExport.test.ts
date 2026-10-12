import { beforeEach, describe, expect, it, vi } from 'vitest'

const html2canvasMock = vi.fn()
const saveFileMock = vi.fn()
const addImageMock = vi.fn()
const addPageMock = vi.fn()
const outputMock = vi.fn()

vi.mock('html2canvas', () => ({
  default: (...args: unknown[]) => html2canvasMock(...args),
}))

vi.mock('./saveFile', () => ({
  saveFile: (...args: unknown[]) => saveFileMock(...args),
}))

vi.mock('jspdf', () => {
  class MockJsPDF {
    internal = {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    }
    addImage(...args: unknown[]) {
      return addImageMock(...args)
    }
    addPage(...args: unknown[]) {
      return addPageMock(...args)
    }
    output(...args: unknown[]) {
      return outputMock(...args)
    }
  }
  return { jsPDF: MockJsPDF }
})

describe('documentPdfExport', () => {
  beforeEach(() => {
    html2canvasMock.mockReset()
    saveFileMock.mockReset()
    addImageMock.mockReset()
    addPageMock.mockReset()
    outputMock.mockReset()
    saveFileMock.mockResolvedValue(true)
    outputMock.mockReturnValue(new Blob(['%PDF-1.4'], { type: 'application/pdf' }))

    const canvas = document.createElement('canvas')
    canvas.width = 794
    canvas.height = 1200
    canvas.toDataURL = vi.fn(() => 'data:image/jpeg;base64,/9j/4AAQ') as typeof canvas.toDataURL
    html2canvasMock.mockResolvedValue(canvas)
  })

  it('rejects empty content', async () => {
    const { exportDocumentToPdf } = await import('./documentPdfExport')
    await expect(exportDocumentToPdf('   ')).rejects.toThrow(/为空/)
  })

  it('builds an official-layout page and saves a pdf blob', async () => {
    const { exportDocumentToPdf } = await import('./documentPdfExport')
    const saved = await exportDocumentToPdf('特发服务2027年度资本运作计划\n一、总体思路\n正文内容。', {
      fileName: '测试报告.pdf',
    })

    expect(saved).toBe(true)
    expect(html2canvasMock).toHaveBeenCalled()
    const captureTarget = html2canvasMock.mock.calls[0]?.[0] as HTMLElement
    expect(captureTarget.className).toContain('document-official-layout-page')
    expect(captureTarget.innerHTML).toContain('doc-layout')

    expect(addImageMock).toHaveBeenCalled()
    expect(saveFileMock).toHaveBeenCalled()
    const [blob, options] = saveFileMock.mock.calls[0] as [Blob, { suggestedName: string }]
    expect(options.suggestedName).toBe('测试报告.pdf')
    expect(blob.type).toContain('pdf')
    const header = new Uint8Array(await blob.slice(0, 4).arrayBuffer())
    expect(String.fromCharCode(...header)).toBe('%PDF')
  })
})
