import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearStoredStructureAnalysis,
  loadStoredStructureAnalysis,
  saveStoredStructureAnalysis,
  type DocumentStructureAnalysisResult,
} from './documentStructureAnalysis'

const sampleReport: DocumentStructureAnalysisResult = {
  summary: '主题清晰',
  outline: ['一、概况'],
  logicFlow: ['先交代背景'],
  gaps: ['缺风险专节'],
  suggestions: ['补充风险专节'],
  rawMarkdown: '',
}

describe('structure analysis storage with applied snippets', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    clearStoredStructureAnalysis()
    localStorage.clear()
  })

  it('persists and reloads appliedSnippets with the structure cache', () => {
    saveStoredStructureAnalysis({
      contentFingerprint: 'fp-1',
      report: sampleReport,
      appliedSuggestions: ['补充风险专节'],
      appliedSnippets: {
        补充风险专节: '四、风险提示\n需关注整合协同与合规边界。',
      },
      analyzedAt: 1_700_000_000_000,
      genreLabel: '资本运作计划',
    })

    const loaded = loadStoredStructureAnalysis()
    expect(loaded?.appliedSuggestions).toEqual(['补充风险专节'])
    expect(loaded?.appliedSnippets).toEqual({
      补充风险专节: '四、风险提示\n需关注整合协同与合规边界。',
    })
  })

  it('defaults appliedSnippets to empty when older caches omit them', () => {
    localStorage.setItem(
      'chartcraft-document-structure',
      JSON.stringify({
        contentFingerprint: 'fp-legacy',
        report: sampleReport,
        appliedSuggestions: ['补充风险专节'],
        analyzedAt: 1_700_000_000_000,
      }),
    )

    const loaded = loadStoredStructureAnalysis()
    expect(loaded?.appliedSnippets).toEqual({})
  })
})
