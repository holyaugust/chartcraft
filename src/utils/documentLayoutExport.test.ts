import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { createFormattedDocxFromPlainText } from './docxFormattedExport'
import { exportDocumentToDocx } from './docxExport'

async function documentXml(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) throw new Error('missing word/document.xml')
  return xml
}

describe('document layout export', () => {
  it('exports an unconfirmed plain document with the general table', async () => {
    const xml = await documentXml(await exportDocumentToDocx('采购合同\n第一条 标的', {}).then((r) => r.buffer))
    expect(xml).not.toContain('w:line="560"')
    expect(xml).not.toContain('仿宋_GB2312')
    expect(xml).toContain('w:line="444"')
    expect(xml).toContain('宋体')
  })

  it('exports a confirmed genre even when an original buffer asks to write back', async () => {
    const original = await createFormattedDocxFromPlainText('旧公文', 'official')
    const xml = await documentXml(
      await exportDocumentToDocx('采购合同', {
        originalBuffer: original,
        preferFormatted: false,
        layoutGenre: 'contract',
      }).then((r) => r.buffer),
    )
    expect(xml).toContain('w:line="360"')
    expect(xml).toContain('宋体')
    expect(xml).not.toContain('仿宋_GB2312')
  })

  it('exports an official heading with the official table', async () => {
    const xml = await documentXml(await createFormattedDocxFromPlainText('一、重点', 'official'))
    expect(xml).toContain('w:line="560"')
    expect(xml).toContain('黑体')
  })

  it('writes back into the original document when the genre is unconfirmed', async () => {
    const original = await createFormattedDocxFromPlainText('旧公文', 'official')
    const xml = await documentXml(
      await exportDocumentToDocx('旧公文改', {
        originalBuffer: original,
        originalFullText: '旧公文',
        preferFormatted: false,
        layoutGenre: null,
      }).then((r) => r.buffer),
    )
    expect(xml).toContain('w:line="560"')
    expect(xml).not.toContain('w:line="444"')
  })
})
