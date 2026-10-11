import { describe, expect, it } from 'vitest'
import {
  normalizeStructureSuggestions,
  parseStructureSuggestionLine,
  sortStructureSuggestions,
} from './documentStructureAnalysis'

const capitalPlanSections = [
  '一、企业基本情况',
  '二、总体思路',
  '三、2027年股权运作计划',
  '四、2027年债权运作计划',
  '五、2027年资产运作计划',
  '六、2027年上市公司质量提升有关工作',
  '七、2027年基金运作计划',
]

describe('parseStructureSuggestionLine', () => {
  it('parses tag, target section, and body from the fixed prefix', () => {
    expect(
      parseStructureSuggestionLine('【补缺｜二、风险提示】补充风险与应对专节，写清主要不确定性'),
    ).toEqual({
      tag: '补缺',
      target: '二、风险提示',
      text: '补充风险与应对专节，写清主要不确定性',
      raw: '【补缺｜二、风险提示】补充风险与应对专节，写清主要不确定性',
    })
  })

  it('infers 补缺 and section target from plain prose', () => {
    const line =
      '在「二、总体思路」前或之内增设「年度资本运作总体目标」专节，写清2027年量化目标'
    expect(parseStructureSuggestionLine(line, capitalPlanSections)).toMatchObject({
      tag: '补缺',
      target: '二、总体思路',
      text: line,
      raw: line,
    })
  })

  it('infers 理顺 and earliest section when merging multiple chapters', () => {
    const line =
      '将「三」「四」「五」「七」四节合并为「2027年分项资本运作计划与储备安排」一节'
    expect(parseStructureSuggestionLine(line, capitalPlanSections)).toMatchObject({
      tag: '理顺',
      target: '三、2027年股权运作计划',
      text: line,
    })
  })

  it('infers 收紧 for polish-only prose', () => {
    expect(parseStructureSuggestionLine('压缩结语套话，语气再紧一点')).toMatchObject({
      tag: '收紧',
      target: '全文',
    })
  })
})

describe('sortStructureSuggestions', () => {
  it('orders by document section sequence, putting 全文 last', () => {
    const sections = ['一、背景', '二、风险', '三、对策', '结语']
    const sorted = sortStructureSuggestions(
      [
        parseStructureSuggestionLine('【收紧｜结语】压缩套话'),
        parseStructureSuggestionLine('【补缺｜二、风险】补风险节'),
        parseStructureSuggestionLine('【收紧｜全文】删套话'),
        parseStructureSuggestionLine('【理顺｜一、背景与三、对策】补过渡'),
      ],
      sections,
    )
    expect(sorted.map((item) => item.target)).toEqual([
      '一、背景与三、对策',
      '二、风险',
      '结语',
      '全文',
    ])
  })
})

describe('normalizeStructureSuggestions', () => {
  it('parses and sorts by section order rather than impact tags', () => {
    const normalized = normalizeStructureSuggestions(
      [
        '【收紧｜全文】将多节重复的空壳「暂无」表述归并为一节',
        '【补缺｜四、保障措施】补充保障专节',
        { tag: '理顺', target: '二、问题', text: '理顺因果并补过渡段', raw: '【理顺｜二、问题】理顺因果并补过渡段' },
      ],
      ['一、概况', '二、问题', '四、保障措施'],
    )
    expect(normalized.map((item) => item.target)).toEqual(['四、保障措施', '全文'])
  })

  it('repairs legacy 理顺/全文 objects using body inference', () => {
    const line =
      '在「六、2027年上市公司质量提升有关工作」之后增设「风险提示与应对」专节'
    const normalized = normalizeStructureSuggestions(
      [{ tag: '理顺', target: '全文', text: line, raw: line }],
      capitalPlanSections,
    )
    expect(normalized[0]).toMatchObject({
      tag: '补缺',
      target: '六、2027年上市公司质量提升有关工作',
    })
  })

  it('drops sentence-level polish suggestions that are not structural', () => {
    const normalized = normalizeStructureSuggestions(
      [
        '【理顺｜三、2027年并购整合项目】将长句拆成两句，先写现状再写触发机制，逻辑更清楚',
        '【收紧｜四、2027年拟退出资产或项目】「开展实施」语义重复，建议改为「实施」',
        '【补缺｜二、总体思路】增设年度量化目标专节',
      ],
      capitalPlanSections,
    )
    expect(normalized).toHaveLength(1)
    expect(normalized[0].tag).toBe('补缺')
  })

  it('collapses soft-only suggestions into a no-issue placeholder', () => {
    const normalized = normalizeStructureSuggestions(
      [
        '【理顺｜二、总体思路】补一句过渡，层次更顺',
        '【理顺｜三、2027年股权运作计划】表述可再理顺一下',
        '【理顺｜全文】整体结构可再优化',
      ],
      capitalPlanSections,
    )
    expect(normalized).toHaveLength(1)
    expect(normalized[0].text).toContain('暂无明显结构调整建议')
  })

  it('keeps only hard structural suggestions and dedupes the same target', () => {
    const normalized = normalizeStructureSuggestions(
      [
        '【理顺｜二、总体思路】补一句过渡更顺',
        '【补缺｜二、总体思路】增设年度量化目标专节',
        '【补缺｜二、总体思路】在第二节补充年度量化目标专节，写清指标',
        '【补缺｜六、2027年上市公司质量提升有关工作】增设风险提示专节',
      ],
      capitalPlanSections,
    )
    expect(normalized.map((item) => `${item.tag}:${item.target}`)).toEqual([
      '补缺:二、总体思路',
      '补缺:六、2027年上市公司质量提升有关工作',
    ])
  })
})
