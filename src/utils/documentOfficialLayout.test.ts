import { describe, expect, it } from 'vitest'
import { buildOfficialLayoutHtml } from './documentOfficialLayout'

describe('buildOfficialLayoutHtml', () => {
  it('styles the official title from the shared spec', () => {
    const html = buildOfficialLayoutHtml('关于放假的通知')
    expect(html).toContain('22pt')
    expect(html).toContain('小标宋')
  })
})
