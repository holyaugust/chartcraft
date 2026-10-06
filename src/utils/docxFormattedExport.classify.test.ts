import { describe, expect, it } from 'vitest'
import { classifyOfficialLines, classifyOfficialParagraph } from './docxFormattedExport'

describe('official paragraph classification', () => {
  it('does not treat a mid-document 委员会 line or date-led sentence as 落款', () => {
    const lines = [
      '中共深圳市特发服务股份有限公司委员会',
      '会议纪要',
      '深特发服党会〔2026〕25号',
      '特发服务2026年第25次党委会',
      '会议纪要',
      '2026年8月7日，公司党委书记陈宝杰同志在特发文创广场5楼2号会议室主持召开党委会，纪要如下：',
      '十一、审议四川特发综合能源服务有限公司49%股权转让合同',
      '审计风控部汇报相关情况。',
    ]
    const kinds = classifyOfficialLines(lines)
    expect(kinds[0]).not.toBe('signatureOrg')
    expect(kinds[0]).not.toBe('signatureDate')
    expect(kinds[5]).toBe('body')
    expect(kinds[6]).toBe('heading1')
  })

  it('only marks 落款 on trailing org and exact date lines', () => {
    const lines = [
      '关于推进重点工作的通知',
      '各部门：',
      '现将有关事项通知如下。',
      '深圳市特发服务股份有限公司',
      '2026年8月7日',
    ]
    const kinds = classifyOfficialLines(lines)
    expect(kinds[3]).toBe('signatureOrg')
    expect(kinds[4]).toBe('signatureDate')
    expect(classifyOfficialParagraph('深圳市特发服务股份有限公司')).not.toBe('signatureOrg')
  })
})
