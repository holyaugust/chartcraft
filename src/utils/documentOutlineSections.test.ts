import { describe, expect, it } from 'vitest'
import {
  SHORT_SECTION_CHAR_THRESHOLD,
  buildOutlineDirectory,
  resolveOutlineSectionRange,
} from './documentOutlineSections'

const sample = [
  '特发服务2027年度资本运作计划报告',
  '一、企业基本情况',
  '特发服务以综合物业管理服务为核心业务，构建以综合物业管理为核心、政务服务与增值服务协同并进的多元化经营模式。公司上市以来持续积极开展资本运作，围绕主业实施系列股权并购与整合动作，积累了可复制的整合经验。',
  '二、2027年资本运作总体思路和主要方向',
  '（一）总体思路',
  '2027年，公司将深入贯彻集团关于资本运作工作的总体部署。',
  '（二）主要方向',
  '围绕主业做强做优。',
].join('\n')

const outline = [
  '一、企业基本情况',
  '二、2027年资本运作总体思路和主要方向',
  '（一）总体思路',
  '（二）主要方向',
]

describe('documentOutlineSections', () => {
  it('resolves a section from heading to the next peer/higher heading', () => {
    const section = resolveOutlineSectionRange(sample, outline, '一、企业基本情况')
    expect(section).not.toBeNull()
    expect(sample.slice(section!.headingStart, section!.headingEnd)).toContain('一、企业基本情况')
    expect(sample.slice(section!.bodyStart, section!.sectionEnd)).toContain('综合物业管理')
    expect(sample.slice(section!.bodyStart, section!.sectionEnd)).not.toContain('二、2027年')
  })

  it('builds directory entries with char counts and short flags', () => {
    const entries = buildOutlineDirectory(sample, outline)
    expect(entries).toHaveLength(4)

    const first = entries.find((item) => item.title.includes('企业基本情况'))
    expect(first?.found).toBe(true)
    expect(first?.charCount).toBeGreaterThan(20)
    expect(first?.short).toBe(false)

    const last = entries.find((item) => item.title.includes('主要方向'))
    expect(last?.found).toBe(true)
    expect(last?.charCount).toBeLessThan(SHORT_SECTION_CHAR_THRESHOLD)
    expect(last?.short).toBe(true)
  })

  it('marks missing headings as not found', () => {
    const entries = buildOutlineDirectory(sample, ['九、不存在的章节'])
    expect(entries[0]?.found).toBe(false)
    expect(entries[0]?.charCount).toBe(0)
    expect(entries[0]?.short).toBe(false)
  })

  it('finds （一）总体思路 even when the outline adds a顿号 after the number', () => {
    const noisyOutline = [
      '一、企业基本情况',
      '二、2027年资本运作总体思路和主要方向',
      '（一）、总体思路',
      '（二）、主要方向',
    ]
    const section = resolveOutlineSectionRange(sample, noisyOutline, '（一）、总体思路')
    expect(section).not.toBeNull()
    expect(sample.slice(section!.headingStart, section!.headingEnd)).toContain('（一）总体思路')
    expect(sample.slice(section!.bodyStart, section!.sectionEnd)).toContain('深入贯彻')
    const entries = buildOutlineDirectory(sample, noisyOutline)
    expect(entries.find((e) => e.title.includes('总体思路'))?.found).toBe(true)
  })

  it('anchors 总体思路 to the subsection line, not the parent title that also contains those words', () => {
    const section = resolveOutlineSectionRange(sample, outline, '（一）总体思路')
    expect(section).not.toBeNull()
    const heading = sample.slice(section!.headingStart, section!.headingEnd)
    expect(heading.trim()).toBe('（一）总体思路')
    expect(heading).not.toContain('2027年资本运作总体思路和主要方向')
  })
})
