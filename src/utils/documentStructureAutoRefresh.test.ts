import { describe, expect, it } from 'vitest'
import { shouldAutoRerunStructureAfterPrepare } from './documentStructureAutoRefresh'

describe('shouldAutoRerunStructureAfterPrepare', () => {
  const base = {
    workflowStep: 'structure',
    prepareContentChanged: true,
    hasContent: true,
    structureBusy: false,
    hasStructureReport: true,
    structureStale: true,
  }

  it('auto-reruns when prepare changed and structure result is stale', () => {
    expect(shouldAutoRerunStructureAfterPrepare(base)).toBe(true)
  })

  it('auto-reruns when prepare changed and there is no prior report', () => {
    expect(
      shouldAutoRerunStructureAfterPrepare({
        ...base,
        hasStructureReport: false,
        structureStale: false,
      }),
    ).toBe(true)
  })

  it('does not auto-rerun when prepare did not change', () => {
    expect(shouldAutoRerunStructureAfterPrepare({ ...base, prepareContentChanged: false })).toBe(
      false,
    )
  })

  it('does not auto-rerun outside 结构梳理', () => {
    expect(shouldAutoRerunStructureAfterPrepare({ ...base, workflowStep: 'proofread' })).toBe(
      false,
    )
  })

  it('does not auto-rerun while a run is already busy', () => {
    expect(shouldAutoRerunStructureAfterPrepare({ ...base, structureBusy: true })).toBe(false)
  })
})
