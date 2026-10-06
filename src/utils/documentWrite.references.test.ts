import { describe, expect, it } from 'vitest'
import { formatAttachedReferences } from './documentWrite'

describe('formatAttachedReferences', () => {
  it('joins uploaded files with the user request instead of treating them as imitation samples', () => {
    const block = formatAttachedReferences([
      { name: '销售.csv', text: '月份 | 销售额\n1月 | 8200' },
      { name: '纪要.docx', text: '会议决定下月启动重组。' },
    ])

    expect(block).toContain('销售.csv')
    expect(block).toContain('8200')
    expect(block).toContain('纪要.docx')
    expect(block).toContain('会议决定下月启动重组')
    expect(block).toContain('写作要求')
    expect(block).not.toMatch(/仿写/)
  })
})
