import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GenreDetectionResult } from './documentGenreDetect'

const refineMock = vi.fn()
const isConfiguredMock = vi.fn()

vi.mock('./documentGenreDetect', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./documentGenreDetect')>()
  return {
    ...actual,
    refineDocumentGenreWithAi: (...args: unknown[]) => refineMock(...args),
  }
})

vi.mock('./deepseek', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./deepseek')>()
  return {
    ...actual,
    isDeepSeekConfigured: () => isConfiguredMock(),
  }
})

describe('prepareAutoProofreadSetup', () => {
  beforeEach(() => {
    refineMock.mockReset()
    isConfiguredMock.mockReset()
    isConfiguredMock.mockReturnValue(false)
  })

  it('builds prompt context from local genre detection without opening a modal', async () => {
    const { prepareAutoProofreadSetup } = await import('./documentProofreadSetup')
    const content = '特发服务2027年度资本运作计划\n一、指导思想\n二、工作目标\n三、重点任务\n四、保障措施'

    const result = await prepareAutoProofreadSetup({
      content,
      mode: 'standard',
    })

    expect(result.detection.genreId).toBe('plan_summary')
    expect(result.promptContext.genreId).toBe('plan_summary')
    expect(result.promptContext.genreLabel).toBe('计划总结')
    expect(result.promptContext.customInstructions).toContain('计划总结')
    expect(result.promptContext.customInstructions).toContain('校对侧重')
    expect(refineMock).not.toHaveBeenCalled()
  })

  it('auto-refines with AI when local confidence is not high', async () => {
    isConfiguredMock.mockReturnValue(true)
    const refined: GenreDetectionResult = {
      genreId: 'work_report',
      label: '工作汇报',
      confidence: 'high',
      reasons: ['AI 精识别'],
      scores: [],
    }
    refineMock.mockResolvedValue(refined)

    const { prepareAutoProofreadSetup } = await import('./documentProofreadSetup')
    const result = await prepareAutoProofreadSetup({
      content: '现将有关情况汇报如下。',
      mode: 'standard',
    })

    expect(refineMock).toHaveBeenCalled()
    expect(result.promptContext.genreId).toBe('work_report')
    expect(result.promptContext.customInstructions).toContain('工作汇报')
  })
})
