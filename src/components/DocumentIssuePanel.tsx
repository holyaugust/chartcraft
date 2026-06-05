import { Check, Wand2, X } from 'lucide-react'
import type { DocumentIssue } from '../utils/documentProofread'
import { getIssueCategoryLabel } from '../utils/documentProofread'

interface DocumentIssuePanelProps {
  issues: DocumentIssue[]
  activeIssueId: string | null
  adoptedIssueIds: ReadonlySet<string>
  onLocate: (issue: DocumentIssue) => void
  onToggleAdopt: (issue: DocumentIssue) => void
  onApplyAll: () => void
  onDismiss: () => void
  busy?: boolean
}

export default function DocumentIssuePanel({
  issues,
  activeIssueId,
  adoptedIssueIds,
  onLocate,
  onToggleAdopt,
  onApplyAll,
  onDismiss,
  busy = false,
}: DocumentIssuePanelProps) {
  const fixableCount = issues.filter(
    (issue) => issue.autoFixable && issue.start !== issue.end && !adoptedIssueIds.has(issue.id),
  ).length
  const adoptedCount = issues.filter((issue) => adoptedIssueIds.has(issue.id)).length

  return (
    <aside className="document-issue-panel">
      <div className="document-issue-panel-header">
        <div>
          <h3>校对结果</h3>
          <p>
            {issues.length === 0
              ? '未发现可提示的问题'
              : `共 ${issues.length} 项${adoptedCount ? `，已采纳 ${adoptedCount} 项` : ''}${fixableCount ? `，${fixableCount} 项待采纳` : ''}`}
          </p>
        </div>
        <button type="button" className="btn btn-sm btn-icon-only" onClick={onDismiss} aria-label="关闭">
          <X size={14} />
        </button>
      </div>

      {issues.length > 0 ? (
        <>
          <ul className="document-issue-list">
            {issues.map((issue) => {
              const adopted = adoptedIssueIds.has(issue.id)
              const canToggle = issue.autoFixable && issue.start !== issue.end

              return (
              <li
                key={issue.id}
                className={`document-issue-item cat-${issue.category}${activeIssueId === issue.id ? ' active' : ''}${adopted ? ' adopted' : ' pending'}`}
                role="button"
                tabIndex={0}
                onClick={() => onLocate(issue)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onLocate(issue)
                  }
                }}
              >
                <span className="document-issue-tag">{getIssueCategoryLabel(issue.category)}</span>
                <p className="document-issue-message">{issue.message}</p>
                {issue.original ? (
                  <p className="document-issue-diff">
                    <span className="issue-original">{issue.original}</span>
                    <span className="issue-arrow">→</span>
                    <span className="issue-suggestion">{issue.suggestion || '（删除）'}</span>
                  </p>
                ) : null}
                {canToggle ? (
                  <button
                    type="button"
                    className={`btn btn-sm btn-ghost document-issue-apply${adopted ? ' document-issue-applied' : ''}`}
                    disabled={busy}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleAdopt(issue)
                    }}
                  >
                    {adopted ? <Check size={12} /> : null}
                    {adopted ? '已采纳' : '采纳'}
                  </button>
                ) : null}
              </li>
            )})}
          </ul>
          {fixableCount > 0 ? (
            <button type="button" className="btn btn-sm btn-primary document-issue-apply-all" disabled={busy} onClick={onApplyAll}>
              <Wand2 size={14} />
              一键全部采纳
            </button>
          ) : null}
        </>
      ) : (
        <p className="document-issue-empty">文档表述良好，未命中常见错别字与格式规则。</p>
      )}
    </aside>
  )
}
