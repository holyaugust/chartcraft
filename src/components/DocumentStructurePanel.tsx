import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  GitBranch,
  Lightbulb,
  ListTree,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import {
  detectOutlineLevel,
  formatStructureAnalyzedAt,
  type DocumentStructureAnalysisResult,
  type StructureSuggestionPatch,
} from '../utils/documentStructureAnalysis'

type StructureViewTab = 'outline' | 'logic' | 'gaps' | 'suggestions'

interface DocumentStructurePanelProps {
  report: DocumentStructureAnalysisResult | null
  busy?: boolean
  error?: string | null
  optimizeBusy?: boolean
  optimizeTarget?: string | null
  pendingPatch?: StructureSuggestionPatch | null
  appliedSuggestions?: ReadonlySet<string>
  analyzedAt?: number | null
  stale?: boolean
  activeLocateItem?: string | null
  onRefresh: () => void
  onDismiss: () => void
  onLocateItem: (item: string) => void
  onOptimizeSuggestion: (suggestion: string) => void
  onConfirmPatch: () => void
  onCancelPatch: () => void
}

function OutlineTree({
  items,
  activeItem,
  onLocate,
}: {
  items: string[]
  activeItem?: string | null
  onLocate: (item: string) => void
}) {
  if (items.length === 0) {
    return <p className="document-structure-muted">暂无识别到的章节大纲</p>
  }
  return (
    <ol className="document-structure-outline">
      {items.map((item, index) => {
        const level = detectOutlineLevel(item)
        const active = activeItem === item
        return (
          <li key={`${index}-${item.slice(0, 32)}`} data-level={level} className={`is-level-${level}`}>
            <button
              type="button"
              className={`document-structure-locate-btn${active ? ' is-active' : ''}`}
              title="点击定位到正文对应位置"
              onClick={() => onLocate(item)}
            >
              <span className="document-structure-outline-dot" aria-hidden="true" />
              <span className="document-structure-outline-text">{item.trim()}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function LogicTimeline({
  items,
  activeItem,
  onLocate,
}: {
  items: string[]
  activeItem?: string | null
  onLocate: (item: string) => void
}) {
  if (items.length === 0) {
    return <p className="document-structure-muted">暂无逻辑链条</p>
  }
  return (
    <ol className="document-structure-flow">
      {items.map((item, index) => {
        const active = activeItem === item
        return (
          <li key={`${index}-${item.slice(0, 32)}`}>
            <span className="document-structure-flow-step">{index + 1}</span>
            <button
              type="button"
              className={`document-structure-locate-btn document-structure-flow-card${active ? ' is-active' : ''}`}
              title="点击定位到正文对应位置"
              onClick={() => onLocate(item)}
            >
              {item}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function GapList({
  items,
  activeItem,
  onLocate,
}: {
  items: string[]
  activeItem?: string | null
  onLocate: (item: string) => void
}) {
  if (items.length === 0) {
    return <p className="document-structure-muted">暂无结构缺口说明</p>
  }
  const benign = items.length === 1 && /未见明显|暂无|没有/.test(items[0])
  return (
    <ul className={`document-structure-gaps${benign ? ' is-benign' : ''}`}>
      {items.map((item) => {
        const active = activeItem === item
        return (
          <li key={item.slice(0, 48)} className={active ? 'is-active' : undefined}>
            <button
              type="button"
              className="document-structure-locate-btn document-structure-gap-btn"
              title={benign ? undefined : '点击定位到正文相关位置'}
              disabled={benign}
              onClick={() => onLocate(item)}
            >
              {!benign ? <AlertTriangle size={13} /> : <Check size={13} />}
              <span>{item}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export default function DocumentStructurePanel({
  report,
  busy = false,
  error = null,
  optimizeBusy = false,
  optimizeTarget = null,
  pendingPatch = null,
  appliedSuggestions,
  analyzedAt = null,
  stale = false,
  activeLocateItem = null,
  onRefresh,
  onDismiss,
  onLocateItem,
  onOptimizeSuggestion,
  onConfirmPatch,
  onCancelPatch,
}: DocumentStructurePanelProps) {
  const suggestions = report?.suggestions ?? []
  const locked = busy || optimizeBusy || !!pendingPatch
  const [tab, setTab] = useState<StructureViewTab>('outline')
  const [summaryOpen, setSummaryOpen] = useState(true)

  const tabs: Array<{ id: StructureViewTab; label: string; count: number }> = [
    { id: 'outline', label: '大纲', count: report?.outline.length ?? 0 },
    { id: 'logic', label: '逻辑', count: report?.logicFlow.length ?? 0 },
    { id: 'gaps', label: '缺口', count: report?.gaps.length ?? 0 },
    { id: 'suggestions', label: '建议', count: suggestions.length },
  ]

  return (
    <aside className="document-structure-panel">
      <div className="document-structure-panel-header">
        <div>
          <h3>
            <ListTree size={15} />
            结构梳理
          </h3>
          <p>点击条目可跳转正文；建议可逐条优化。已应用的建议再点一次，可定位到左侧写入处</p>
        </div>
        <div className="document-structure-panel-actions">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={locked}
            onClick={onRefresh}
            aria-label="重新梳理"
            title="重新梳理"
          >
            {busy ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
          </button>
          <button type="button" className="btn btn-sm btn-icon-only" onClick={onDismiss} aria-label="关闭">
            <X size={14} />
          </button>
        </div>
      </div>

      {busy && !report ? (
        <div className="document-structure-empty">
          <Loader2 size={18} className="spin" />
          <p>正在梳理全文结构与逻辑…</p>
        </div>
      ) : null}

      {error ? <p className="document-structure-error">{error}</p> : null}

      {!busy && !report && !error ? (
        <div className="document-structure-empty">
          <ListTree size={22} />
          <p>点击「开始梳理」，生成可读的章节大纲、逻辑链条与调整建议。结果会保存在本机，下次打开可直接查看。</p>
          <button type="button" className="btn btn-sm btn-primary" onClick={onRefresh}>
            开始梳理
          </button>
        </div>
      ) : null}

      {report ? (
        <div className="document-structure-body">
          <div className="document-structure-meta">
            <span className={stale ? 'is-stale' : 'is-saved'}>
              {stale ? '正文已改动，结果可能过时' : '已保存到本机'}
            </span>
            {analyzedAt ? <span>上次梳理 {formatStructureAnalyzedAt(analyzedAt)}</span> : null}
            {busy ? (
              <span className="document-structure-refreshing">
                <Loader2 size={12} className="spin" /> 更新中…
              </span>
            ) : null}
          </div>

          {stale ? (
            <div className="document-structure-stale-banner">
              <p>当前正文与上次梳理时不一致，建议重新梳理以同步大纲。</p>
              <button type="button" className="btn btn-sm btn-primary" disabled={locked} onClick={onRefresh}>
                {busy ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />}
                重新梳理
              </button>
            </div>
          ) : null}

          <section className="document-structure-summary">
            <button
              type="button"
              className="document-structure-summary-toggle"
              aria-expanded={summaryOpen}
              onClick={() => setSummaryOpen((open) => !open)}
            >
              <span>
                <Lightbulb size={14} />
                总体判断
              </span>
              <ChevronDown size={14} className={summaryOpen ? 'is-open' : undefined} />
            </button>
            {summaryOpen ? <p>{report.summary}</p> : null}
          </section>

          <div className="document-structure-tabs" role="tablist" aria-label="结构视图">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={tab === item.id ? 'is-active' : undefined}
                onClick={() => setTab(item.id)}
              >
                {item.label}
                <em>{item.count}</em>
              </button>
            ))}
          </div>

          <div className="document-structure-tab-panel" role="tabpanel">
            {tab === 'outline' ? (
              <>
                <div className="document-structure-tab-title">
                  <ListTree size={14} />
                  结构大纲
                  <span className="document-structure-tab-hint">点击跳转</span>
                </div>
                <OutlineTree
                  items={report.outline}
                  activeItem={activeLocateItem}
                  onLocate={onLocateItem}
                />
              </>
            ) : null}

            {tab === 'logic' ? (
              <>
                <div className="document-structure-tab-title">
                  <GitBranch size={14} />
                  逻辑链条
                  <span className="document-structure-tab-hint">点击跳转</span>
                </div>
                <LogicTimeline
                  items={report.logicFlow}
                  activeItem={activeLocateItem}
                  onLocate={onLocateItem}
                />
              </>
            ) : null}

            {tab === 'gaps' ? (
              <>
                <div className="document-structure-tab-title">
                  <AlertTriangle size={14} />
                  结构缺口
                  <span className="document-structure-tab-hint">点击跳转</span>
                </div>
                <GapList items={report.gaps} activeItem={activeLocateItem} onLocate={onLocateItem} />
              </>
            ) : null}

            {tab === 'suggestions' ? (
              <>
                <div className="document-structure-tab-title">
                  <Sparkles size={14} />
                  梳理建议
                  <span className="document-structure-tab-hint">点击条目跳转</span>
                </div>
                {suggestions.length === 0 ? (
                  <p className="document-structure-muted">暂无梳理建议</p>
                ) : (
                  <ul className="document-structure-suggestion-list">
                    {suggestions.map((item, index) => {
                      const applied = appliedSuggestions?.has(item)
                      const loading = optimizeBusy && optimizeTarget === item
                      const active = activeLocateItem === item
                      return (
                        <li
                          key={item}
                          className={`${applied ? 'is-applied' : ''}${active ? ' is-active' : ''}`.trim()}
                        >
                          <button
                            type="button"
                            className="document-structure-suggestion-body"
                            title="点击定位到正文相关位置"
                            onClick={() => onLocateItem(item)}
                          >
                            <div className="document-structure-suggestion-head">
                              <span>建议 {index + 1}</span>
                              {applied ? <em>已应用</em> : null}
                            </div>
                            <p>{item}</p>
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost document-structure-optimize-btn"
                            disabled={locked || applied}
                            onClick={() => onOptimizeSuggestion(item)}
                          >
                            {loading ? (
                              <Loader2 size={12} className="spin" />
                            ) : applied ? (
                              <Check size={12} />
                            ) : (
                              <Sparkles size={12} />
                            )}
                            {applied ? '已应用' : loading ? '生成方案…' : '智能优化'}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {pendingPatch ? (
        <div
          className="document-structure-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="structure-confirm-title"
        >
          <div className="document-structure-confirm-card">
            <header>
              <h4 id="structure-confirm-title">确认应用优化</h4>
              <p>请核对改写预览，确认后才会修改正文。</p>
            </header>
            <div className="document-structure-confirm-tip">
              <span>对应建议</span>
              <p>{pendingPatch.suggestion}</p>
            </div>
            {pendingPatch.note ? (
              <p className="document-structure-confirm-note">{pendingPatch.note}</p>
            ) : null}
            <div className="document-structure-confirm-diff">
              <div>
                <span>原文片段</span>
                <pre>{pendingPatch.original}</pre>
              </div>
              <div>
                <span>优化后</span>
                <pre>{pendingPatch.replacement}</pre>
              </div>
            </div>
            <footer>
              <button type="button" className="btn btn-sm btn-ghost" onClick={onCancelPatch}>
                取消
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={onConfirmPatch}>
                <Check size={14} />
                确认修改
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
