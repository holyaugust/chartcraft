import { describe, expect, it } from 'vitest'
import { extractDocumentHeadings } from './documentHeadings'
import { buildDocumentTocDirectory } from './documentOutlineSections'

const sample = [
  '特发服务2027年度资本运作计划报告',
  '一、企业基本情况',
  '特发服务以综合物业管理服务为核心业务，构建以综合物业管理为核心、政务服务与增值服务协同并进的多元化经营模式。公司上市以来持续积极开展资本运作。',
  '二、2027年资本运作总体思路和主要方向',
  '（一）总体思路',
  '2027年，公司将深入贯彻集团关于资本运作工作的总体部署。',
  '（二）主要方向',
  '围绕主业做强做优。',
].join('\n')

describe('extractDocumentHeadings', () => {
  it('extracts numbered headings with levels and offsets from the body', () => {
    const headings = extractDocumentHeadings(sample)
    expect(headings.map((item) => item.title)).toEqual([
      '一、企业基本情况',
      '二、2027年资本运作总体思路和主要方向',
      '（一）总体思路',
      '（二）主要方向',
    ])
    expect(headings.map((item) => item.level)).toEqual([1, 1, 2, 2])
    expect(sample.slice(headings[2]!.start, headings[2]!.end)).toBe('（一）总体思路')
  })

  it('does not invent inductive titles that are not heading lines', () => {
    const headings = extractDocumentHeadings(sample)
    expect(headings.some((item) => item.title.includes('主业与经营'))).toBe(false)
  })
})

describe('buildDocumentTocDirectory', () => {
  it('builds a jumpable TOC from body headings without an AI outline', () => {
    const entries = buildDocumentTocDirectory(sample)
    expect(entries.every((entry) => entry.found)).toBe(true)
    const sub = entries.find((entry) => entry.title === '（一）总体思路')
    expect(sub).toBeTruthy()
    expect(sample.slice(sub!.section!.headingStart, sub!.section!.headingEnd)).toBe('（一）总体思路')
    expect(sample.slice(sub!.section!.bodyStart, sub!.section!.sectionEnd)).toContain('深入贯彻')
    expect(sample.slice(sub!.section!.bodyStart, sub!.section!.sectionEnd)).not.toContain('（二）主要方向')
  })

  it('excludes trailing 落款 from the last section', () => {
    const withSignature = [
      sample,
      '七、2027年基金运作计划',
      '公司2027年暂无基金运作计划，后续如有基金业务筹划及实施安排，将依规履行审批流程，及时做好更新上报。',
      '',
      '深圳市特发服务股份有限公司',
      '2026年9月30日',
    ].join('\n')

    const entries = buildDocumentTocDirectory(withSignature)
    const last = entries.find((entry) => entry.title.includes('基金运作计划'))
    expect(last).toBeTruthy()
    const slice = withSignature.slice(last!.section!.headingStart, last!.section!.sectionEnd)
    expect(slice).toContain('暂无基金运作计划')
    expect(slice).not.toContain('深圳市特发服务股份有限公司')
    expect(slice).not.toContain('2026年9月30日')
  })
})
