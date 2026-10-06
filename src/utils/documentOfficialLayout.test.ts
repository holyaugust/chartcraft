import { describe, expect, it } from 'vitest'
import { GBT9704_SIGNATURE_ORG_RIGHT_CHARS } from '../data/gbt9704ExportSpec'
import { buildOfficialLayoutHtml } from './documentOfficialLayout'

describe('buildOfficialLayoutHtml', () => {
  it('styles the official title from the shared spec', () => {
    const html = buildOfficialLayoutHtml('关于放假的通知')
    expect(html).toContain('22pt')
    expect(html).toContain('小标宋')
  })

  it('indents a signature org line from the layout table', () => {
    const html = buildOfficialLayoutHtml('某某有限公司')
    const expected = `${GBT9704_SIGNATURE_ORG_RIGHT_CHARS / 100}em`
    expect(html).toMatch(new RegExp(`(?:padding-right|margin-right):${expected}`))
    expect(GBT9704_SIGNATURE_ORG_RIGHT_CHARS).toBe(400)
  })
})
