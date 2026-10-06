import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadWriteMaterials } from './documentWriteStorage'
import {
  MAX_WRITE_REFERENCE_FILES,
  extractLegacyDocText,
  extractWriteReferenceText,
  takeReferenceUploadBatch,
} from './writeReferenceExtract'

vi.mock('./smartGraphicOcr', () => ({
  extractTextFromImage: vi.fn(async () => '图片识别正文'),
}))

vi.mock('./smartGraphicImage', async () => {
  const actual = await vi.importActual<typeof import('./smartGraphicImage')>('./smartGraphicImage')
  return {
    ...actual,
    readImageFileAsDataUrl: vi.fn(async () => 'data:image/png;base64,abc'),
  }
})

function fileFrom(name: string, data: BlobPart | Uint8Array): File {
  if (data instanceof Uint8Array) {
    const copy = new ArrayBuffer(data.byteLength)
    new Uint8Array(copy).set(data)
    return new File([copy], name)
  }
  return new File([data], name)
}

function utf16le(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length * 2)
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    bytes[index * 2] = code & 0xff
    bytes[index * 2 + 1] = code >> 8
  }
  return bytes
}

function makeSimplePdf(text: string): Uint8Array {
  const chunks: string[] = []
  const offsets: number[] = [0]
  const push = (value: string) => {
    chunks.push(value)
  }
  const length = () => chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const obj = (body: string) => {
    offsets.push(length())
    push(`${offsets.length - 1} 0 obj\n${body}\nendobj\n`)
  }

  push('%PDF-1.4\n')
  const stream = `BT /F1 24 Tf 50 100 Td (${text}) Tj ET`
  obj('<< /Type /Catalog /Pages 2 0 R >>')
  obj('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  obj('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>')
  obj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  obj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const xrefAt = length()
  let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`
  for (let index = 1; index < offsets.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  }
  xref += `trailer << /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`
  push(xref)
  return new TextEncoder().encode(chunks.join(''))
}

describe('takeReferenceUploadBatch', () => {
  it('keeps room for files up to the limit', () => {
    const batch = takeReferenceUploadBatch(3, ['a', 'b', 'c'])
    expect(batch.accepted).toEqual(['a', 'b'])
    expect(batch.ignoredCount).toBe(1)
    expect(batch.atCapacity).toBe(false)
  })

  it('rejects a batch when five files are already kept', () => {
    const batch = takeReferenceUploadBatch(MAX_WRITE_REFERENCE_FILES, ['a'])
    expect(batch.accepted).toEqual([])
    expect(batch.atCapacity).toBe(true)
  })
})

describe('extractWriteReferenceText', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads plain text and markdown', async () => {
    await expect(extractWriteReferenceText(fileFrom('note.txt', '通知正文'))).resolves.toBe('通知正文')
    await expect(extractWriteReferenceText(fileFrom('note.md', '# 标题'))).resolves.toBe('# 标题')
  })

  it('reads csv and xlsx sheets as text', async () => {
    const csv = await extractWriteReferenceText(fileFrom('销售.csv', '月份,销售额\n1月,8200'))
    expect(csv).toContain('月份')
    expect(csv).toContain('8200')

    const workbook = XLSX.utils.book_new()
    const sheet = XLSX.utils.aoa_to_sheet([
      ['月份', '销售额'],
      ['1月', 8200],
    ])
    XLSX.utils.book_append_sheet(workbook, sheet, '销售')
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const xlsx = await extractWriteReferenceText(fileFrom('销售.xlsx', bytes))
    expect(xlsx).toContain('销售')
    expect(xlsx).toContain('8200')
  })

  it('reads pptx slide text', async () => {
    const zip = new JSZip()
    zip.file(
      'ppt/slides/slide1.xml',
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
        <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>季度汇报要点</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
      </p:sld>`,
    )
    const blob = await zip.generateAsync({ type: 'blob' })
    const text = await extractWriteReferenceText(new File([blob], '汇报.pptx'))
    expect(text).toContain('季度汇报要点')
  })

  it('reads a text-layer pdf', async () => {
    const text = await extractWriteReferenceText(fileFrom('brief.pdf', makeSimplePdf('HelloRef')))
    expect(text).toContain('HelloRef')
  })

  it('tells the user when a pdf has no text layer', async () => {
    const empty = makeSimplePdf('')
    await expect(extractWriteReferenceText(fileFrom('scan.pdf', empty))).rejects.toThrow(/图片/)
  })

  it('reads legacy doc text stored as utf-16', () => {
    const phrase = '关于开展办公自动化培训的通知'
    const payload = new Uint8Array(16 + phrase.length * 2)
    payload.set(utf16le(phrase), 16)
    expect(extractLegacyDocText(payload)).toContain(phrase)
  })

  it('reads a legacy doc file and asks for docx when no text is found', async () => {
    const phrase = '关于开展办公自动化培训的通知'
    const payload = new Uint8Array(16 + phrase.length * 2)
    payload.set(utf16le(phrase), 16)
    await expect(extractWriteReferenceText(fileFrom('旧稿.doc', payload))).resolves.toContain(phrase)
    await expect(extractWriteReferenceText(fileFrom('空白.doc', new Uint8Array(32)))).rejects.toThrow(/docx/)
  })

  it('recognizes image text through the existing ocr path', async () => {
    const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])
    await expect(extractWriteReferenceText(fileFrom('截图.png', png))).resolves.toBe('图片识别正文')
  })

  it('rejects unknown formats', async () => {
    await expect(extractWriteReferenceText(fileFrom('资料.exe', 'x'))).rejects.toThrow(/不支持/)
  })
})

describe('loadWriteMaterials', () => {
  it('keeps up to five saved reference files', () => {
    const files = Array.from({ length: 5 }, (_, index) => ({
      id: String(index),
      name: `a${index}.txt`,
      text: '正文',
    }))
    localStorage.setItem(
      'chartcraft-write-materials',
      JSON.stringify({
        prompt: '写一份通知',
        saveMaterials: true,
        referenceFiles: files,
        typeId: 'auto',
        subtypeId: null,
      }),
    )
    expect(loadWriteMaterials().referenceFiles).toHaveLength(5)
  })
})
