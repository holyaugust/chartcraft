import { useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Lightbulb,
  ListTree,
  Loader2,
  RefreshCw,
  Sparkles,
  Undo2,
  X,
} from 'lucide-react'
import {
  countActionableStructureSuggestions,
  detectOutlineLevel,
  formatStructureAnalyzedAt,
  isNoIssueStructureSuggestion,
  type DocumentStructureAnalysisResult,
  type StructureSuggestionPatch,
} from '../utils/documentStructureAnalysis'
import type { OutlineDirectoryEntry } from '../utils/documentOutlineSections'

type StructureViewTab = 'outline' | 'suggestions'

interface DocumentStructurePanelProps {
  report: DocumentStructureAnalysisResult | null
  outlineDirectory?: OutlineDirectoryEntry[]
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
  onRefineSection?: (item: string) => void
  onOptimizeSuggestion: (suggestion: string) => void
  onConfirmPatch: () => void
  onCancelPatch: () => void
  canUndoLastWrite?: boolean
  onUndoLastWrite?: () => void
  collapsed?: boolean
  onToggleCollapsed?: () => void
}

function OutlineTree({
  items,
  directory,
  activeItem,
  onLocate,
  onRefineSection,
  refineDisabled = false,
}: {
  items: string[]
  directory?: OutlineDirectoryEntry[]
  activeItem?: string | null
  onLocate: (item: string) => void
  onRefineSection?: (item: string) => void
  refineDisabled?: boolean
}) {
  const rows =
    directory && directory.length > 0
      ? directory
      : items.map((title) => ({
          title,
          found: false,
          charCount: 0,
          short: false,
          section: null as OutlineDirectoryEntry['section'],
        }))

  if (rows.length === 0) {
    return <p className="document-structure-muted">正文未识别到标题，请使用「一、」「（一）」等标题格式</p>
  }

  return (
    <ol className="document-structure-outline">
      {rows.map((entry, index) => {
        const item = entry.title
        const level = entry.level ?? detectOutlineLevel(item)
        const active = activeItem === item
        return (
          <li key={`${index}-${item.slice(0, 32)}`} data-level={level} className={`is-level-${level}`}>
            <div className={`document-structure-outline-row${active ? ' is-active' : ''}`}>
              <button
                type="button"
                className={`document-structure-locate-btn${active ? ' is-active' : ''}`}
                title="点击定位到该节正文"
                onClick={() => onLocate(item)}
              >
                <span className="document-structure-outline-dot" aria-hidden="true" />
                <span className="document-structure-outline-text">{item.trim()}</span>
              </button>
              <div className="document-structure-outline-meta">
                {entry.found ? (
                  <span className={entry.short ? 'is-short' : undefined}>
                    约{entry.charCount}字
                    {entry.short ? ' · 偏短' : ''}
                  </span>
                ) : (
                  <span className="is-missing">未找到</span>
                )}
                {onRefineSection ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost document-structure-outline-refine"
                    disabled={refineDisabled || !entry.found || !entry.section}
                    title="选中本节正文并按指令改写"
                    onClick={() => onRefineSection(item)}
                  >
                    改本节
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default function DocumentStructurePanel({
  report,
  outlineDirectory,
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
  onRefineSection,
  onOptimizeSuggestion,
  onConfirmPatch,
  onCancelPatch,
  canUndoLastWrite = false,
  onUndoLastWrite,
  collapsed = false,
  onToggleCollapsed,
}: DocumentStructurePanelProps) {
  const suggestions = report?.suggestions ?? []
  const locked = busy || optimizeBusy || !!pendingPatch
  const [tab, setTab] = useState<StructureViewTab>('outline')
  const [summaryOpen, setSummaryOpen] = useState(true)

  const tocCount = outlineDirectory?.length ?? 0
  const tabs: Array<{ id: StructureViewTab; label: string; count: number }> = [
    { id: 'outline', label: '大纲', count: tocCount },
    {
      id: 'suggestions',
      label: '建议',
      count: countActionableStructureSuggestions(suggestions),
    },
  ]

  if (collapsed) {
    return (
      <aside className="document-structure-panel is-rail">
        <div className="document-structure-rail-header">
          <h3>
            <ListTree size={15} />
            结构
          </h3>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={onToggleCollapsed}
            aria-label="展开结构梳理"
            title="展开总体判断和操作"
          >
            <ChevronsLeft size={14} />
          </button>
        </div>
        <div className="document-structure-rail-body">
          {busy && !report ? (
            <p className="document-structure-muted">
              <Loader2 size={14} className="spin" /> 梳理中…
            </p>
          ) : null}
          {error ? <p className="document-structure-error">{error}</p> : null}
          {!busy && !report && !error ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={onRefresh}>
              开始梳理
            </button>
          ) : null}
          {report || (outlineDirectory && outlineDirectory.length > 0) ? (
            <OutlineTree
              items={outlineDirectory?.map((entry) => entry.title) ?? report?.outline ?? []}
              directory={outlineDirectory}
              activeItem={activeLocateItem}
              onLocate={onLocateItem}
              onRefineSection={onRefineSection}
              refineDisabled={locked}
            />
          ) : null}
        </div>
      </aside>
    )
  }

  return (
    <aside className="document-structure-panel">
      <div className="document-structure-panel-header">
        <div>
          <h3>
            <ListTree size={15} />
            结构梳理
          </h3>
          <p>大纲按正文标题生成目录，点击跳转；建议可逐条优化，已应用的再点可定位写入处</p>
        </div>
        <div className="document-structure-panel-actions">
          {onToggleCollapsed ? (
            <button
              type="button"
              className="btn btn-sm btn-icon-only"
              onClick={onToggleCollapsed}
              disabled={!!pendingPatch}
              aria-label="收起结构梳理"
              title="收起，只留大纲"
            >
              <ChevronsRight size={14} />
            </button>
          ) : null}
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
          <p>正在梳理全文结构…</p>
        </div>
      ) : null}

      {error ? <p className="document-structure-error">{error}</p> : null}

      {!busy && !report && !error ? (
        <div className="document-structure-empty">
          <ListTree size={22} />
          <p>点击「开始梳理」，生成章节大纲与调整建议；论证是否顺畅见「总体判断」。结果会保存在本机，下次打开可直接查看。</p>
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

          {canUndoLastWrite && onUndoLastWrite ? (
            <div className="document-structure-undo-banner">
              <p>上次结构写入可撤销，恢复应用前的正文与「已应用」状态。</p>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={locked}
                onClick={onUndoLastWrite}
              >
                <Undo2 size={12} />
                撤销上次结构写入
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
                  正文目录
                  <span className="document-structure-tab-hint">按正文标题生成 · 点击跳转 · 改本节</span>
                </div>
                <OutlineTree
                  items={outlineDirectory?.map((entry) => entry.title) ?? []}
                  directory={outlineDirectory}
                  activeItem={activeLocateItem}
                  onLocate={onLocateItem}
                  onRefineSection={onRefineSection}
                  refineDisabled={locked}
                />
              </>
            ) : null}

            {tab === 'suggestions' ? (
              <>
                <div className="document-structure-tab-title">
                  <Sparkles size={14} />
                  梳理建议
                  <span className="document-structure-tab-hint">按正文顺序 · 点击跳转</span>
                </div>
                {suggestions.length === 0 ? (
                  <p className="document-structure-muted">暂无梳理建议</p>
                ) : (
                  <ul className="document-structure-suggestion-list">
                    {suggestions.map((item, index) => {
                      const applied = appliedSuggestions?.has(item.raw)
                      const loading = optimizeBusy && optimizeTarget === item.raw
                      const active = activeLocateItem === item.raw || activeLocateItem === item.text
                      const noIssue = isNoIssueStructureSuggestion(item)
                      return (
                        <li
                          key={item.raw}
                          className={`${applied ? 'is-applied' : ''}${active ? ' is-active' : ''}${noIssue ? ' is-benign' : ''}`.trim()}
                        >
                          <button
                            type="button"
                            className="document-structure-suggestion-body"
                            title={noIssue ? undefined : '点击定位到正文相关位置'}
                            disabled={noIssue}
                            onClick={() => onLocateItem(item.target !== '全文' ? item.target : item.text)}
                          >
                            <div className="document-structure-suggestion-head">
                              <span className="document-structure-suggestion-meta">
                                {noIssue ? (
                                  <span className="document-structure-suggestion-tag is-order">
                                    正常
                                  </span>
                                ) : (
                                  <span
                                    className={`document-structure-suggestion-tag is-${
                                      item.tag === '补缺'
                                        ? 'fill'
                                        : item.tag === '理顺'
                                          ? 'order'
                                          : 'tighten'
                                    }`}
                                  >
                                    {item.tag}
                                  </span>
                                )}
                                {!noIssue ? (
                                  <span className="document-structure-suggestion-target">
                                    动：{item.target}
                                  </span>
                                ) : null}
                                {!noIssue ? (
                                  <span className="document-structure-suggestion-index">
                                    建议 {index + 1}
                                  </span>
                                ) : null}
                              </span>
                              {applied ? <em>已应用</em> : null}
                            </div>
                            <p>{item.text}</p>
                          </button>
                          {!noIssue ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost document-structure-optimize-btn"
                              disabled={locked || applied}
                              onClick={() => onOptimizeSuggestion(item.raw)}
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
                          ) : null}
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
        <div className="document-structure-revision-hint" role="status">
          <p>左侧正文已进入修订预览，请在原文处核对后应用或取消。</p>
          <div className="document-structure-revision-hint-actions">
            <button type="button" className="btn btn-sm btn-ghost" onClick={onCancelPatch}>
              取消
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={onConfirmPatch}>
              <Check size={14} />
              应用修订
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
