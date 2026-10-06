import { describe, expect, it } from 'vitest'
import {
  GBT9704_LINE_SPACING,
  GBT9704_PAGE_MARGINS,
  GBT9704_SIZE_BODY,
  GBT9704_SIZE_HEADING2,
  GBT9704_SIZE_TITLE,
} from './gbt9704ExportSpec'
import { getLayoutSpec } from './documentLayoutSpecs'

describe('getLayoutSpec', () => {
  it('keeps the official page metrics on the existing constants', () => {
    const spec = getLayoutSpec('official')
    expect(spec.page.marginTwip).toEqual(GBT9704_PAGE_MARGINS)
    expect(spec.page.line).toBe(GBT9704_LINE_SPACING)
    expect(spec.page.lineRule).toBe('exact')
    expect(spec.roles.title).toMatchObject({
      fontEastAsia: '小标宋',
      fontAscii: 'Times New Roman',
      sizeHalfPoints: GBT9704_SIZE_TITLE,
      align: 'center',
    })
    expect(spec.roles.body).toMatchObject({
      fontEastAsia: '仿宋_GB2312',
      sizeHalfPoints: GBT9704_SIZE_BODY,
      align: 'both',
      firstLineIndentChars: 200,
    })
    expect(spec.roles.heading2.sizeHalfPoints).toBe(GBT9704_SIZE_HEADING2)
    expect(spec.roles.heading2.fontEastAsia).toBe('楷体_GB2312')
    expect(spec.roles.docNumber).toMatchObject({
      align: 'center',
      firstLineIndentChars: 0,
      spaceBefore: 120,
      spaceAfter: 160,
    })
    expect(spec.roles.signatureDate).toMatchObject({
      align: 'right',
      firstLineIndentChars: 0,
      spaceBefore: 120,
      spaceAfter: 200,
    })
    expect(spec.roles.meta.spaceBefore).toBe(120)
    expect(spec.roles.enterpriseBanner.spaceBefore).toBe(120)
    expect(spec.roles.metaLabel.spaceBefore).toBe(120)
    expect(spec.roles.redHeader.color).toBe('FF0000')
    expect(spec.roles.body.color).toBeUndefined()
    expect(spec.roles.title.color).toBeUndefined()
  })

  it('defines contract, feasibility, and general pages from the spec', () => {
    expect(getLayoutSpec('contract').page).toMatchObject({
      marginTwip: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720 },
      line: 360,
      lineRule: 'auto',
    })
    expect(getLayoutSpec('contract').roles.contractTitle).toMatchObject({
      fontEastAsia: '宋体',
      sizeHalfPoints: 44,
      bold: true,
      align: 'center',
      firstLineIndentChars: 0,
    })
    expect(getLayoutSpec('contract').roles.article).toMatchObject({
      fontEastAsia: '宋体',
      sizeHalfPoints: 24,
      bold: true,
      align: 'left',
      firstLineIndentChars: 0,
    })
    expect(getLayoutSpec('contract').roles.signature).toMatchObject({
      fontEastAsia: '宋体',
      sizeHalfPoints: 24,
      align: 'right',
    })
    expect(getLayoutSpec('feasibility').page.marginTwip.top).toBe(1417)
    expect(getLayoutSpec('feasibility').roles.reportTitle).toMatchObject({
      fontEastAsia: '黑体',
      sizeHalfPoints: 44,
      align: 'center',
    })
    expect(getLayoutSpec('feasibility').roles.chapter).toMatchObject({
      fontEastAsia: '黑体',
      sizeHalfPoints: 32,
      align: 'left',
      firstLineIndentChars: 0,
    })
    expect(getLayoutSpec('general').page).toMatchObject({ line: 444, lineRule: 'auto' })
    expect(getLayoutSpec('general').roles.heading.sizeHalfPoints).toBe(28)
    expect(getLayoutSpec('general').roles.body).toMatchObject({
      fontEastAsia: '宋体',
      sizeHalfPoints: 24,
      firstLineIndentChars: 200,
      align: 'both',
    })
  })
})
