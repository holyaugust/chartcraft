import { describe, expect, it } from 'vitest'
import { classifyOfficialParagraph } from './docxFormattedExport'
import { layoutRoleForLine } from './documentLayoutRole'

describe('layoutRoleForLine', () => {
  it('delegates official lines to the existing classifier', () => {
    expect(layoutRoleForLine('official', '一、重点工作')).toBe(
      classifyOfficialParagraph('一、重点工作'),
    )
  })

  it('keeps a contract sentence about 甲方 as body', () => {
    expect(layoutRoleForLine('contract', '甲方应在十日内付款。', { isFirstContentLine: false })).toBe('body')
  })

  it('classifies contract title, article, and signature', () => {
    expect(layoutRoleForLine('contract', '采购合同', { isFirstContentLine: true })).toBe('contractTitle')
    expect(layoutRoleForLine('contract', '第一条 标的')).toBe('article')
    expect(layoutRoleForLine('contract', '1.1 价款')).toBe('article')
    expect(layoutRoleForLine('contract', '甲方：某某公司')).toBe('signature')
  })

  it('classifies feasibility title and chapter', () => {
    expect(layoutRoleForLine('feasibility', '某某项目可行性研究报告', { isFirstContentLine: true })).toBe('reportTitle')
    expect(layoutRoleForLine('feasibility', '第一章 总论')).toBe('chapter')
    expect(layoutRoleForLine('feasibility', '一、编制依据')).toBe('chapter')
    expect(layoutRoleForLine('feasibility', '本章说明范围。')).toBe('body')
  })

  it('does not assign a paragraph role to a table line', () => {
    expect(layoutRoleForLine('general', '甲 | 乙')).toBe('table')
  })

  it('uses the existing heading rule for a general document', () => {
    expect(layoutRoleForLine('general', '一、标题')).toBe('heading')
    expect(layoutRoleForLine('general', '普通句子。')).toBe('body')
  })
})
