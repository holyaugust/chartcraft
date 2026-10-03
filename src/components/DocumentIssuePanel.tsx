import { useMemo, useState } from 'react'
import { Check, Sparkles, Type, Wand2, X } from 'lucide-react'
import type { DocumentIssue } from '../utils/documentProofread'
import {
  buildIssueContextSnippet,
  getIssueCategoryLabel,
  getIssueFingerprint,
} from '../utils/documentProofread'
interface DocumentIssuePanelProps {
  issues: DocumentIssue[]
  content: string
  genreLabel?: string | null
  completed?: boolean
  activeIssueId: string | null
  adoptedIssueIds: ReadonlySet<string>
  onLocate: (issue: DocumentIssue) => void
  onToggleAdopt: (issue: DocumentIssue) => void
  onToggleAdoptGroup: (issues: DocumentIssue[]) => void
  onApplyAll: () => void
  onDismiss: () => void
  onStartProofread?: () => void
  onGoFormat?: () => void
  busy?: boolean
}

interface IssueGroup {
  key: string
  issues: DocumentIssue[]
}

function groupIssues(issues: DocumentIssue[]): IssueGroup[] {
  const groups: IssueGroup[] = []
  const indexByKey = new Map<string, number>()

  for (const issue of issues) {
    const key = getIssueFingerprint(issue)
    const existingIndex = indexByKey.get(key)
    if (existingIndex === undefined) {
      indexByKey.set(key, groups.length)
      groups.push({ key, issues: [issue] })
      continue
    }
    groups[existingIndex].issues.push(issue)
  }

  return groups
}

export default function DocumentIssuePanel({
  issues,
  content,
  genreLabel = null,
  completed = false,
  activeIssueId,
  adoptedIssueIds,
  onLocate,
  onToggleAdopt,
  onToggleAdoptGroup,
  onApplyAll,
  onDismiss,
  onStartProofread,
  onGoFormat,
  busy = false,
}: DocumentIssuePanelProps) {
  const [groupLocateIndex, setGroupLocateIndex] = useState<Record<string, number>>({})
  const issueGroups = useMemo(() => groupIssues(issues), [issues])

  const fixableCount = issues.filter(
    (issue) => issue.autoFixable && issue.start !== issue.end && !adoptedIssueIds.has(issue.id),
  ).length
  const adoptedCount = issues.filter((issue) => adoptedIssueIds.has(issue.id)).length
  const hasRun = completed || issues.length > 0

  const handleLocateGroup = (group: IssueGroup) => {
    const nextIndex = groupLocateIndex[group.key] ?? 0
    const issue = group.issues[nextIndex % group.issues.length]
    onLocate(issue)
    if (group.issues.length > 1) {
      setGroupLocateIndex((prev) => ({
        ...prev,
        [group.key]: nextIndex + 1,
      }))
    }
  }

  return (
    <aside className="document-issue-panel">
      <div className="document-issue-panel-header">
        <div>
          <h3>校对结果</h3>
          <p>
            {!hasRun
              ? '在侧栏启动智能校对后，建议会显示在这里'
              : issues.length === 0
                ? `未发现问题${genreLabel ? ` · ${genreLabel}` : ''}`
                : `共 ${issues.length} 项${genreLabel ? ` · ${genreLabel}` : ''}${issueGroups.length !== issues.length ? `（${issueGroups.length} 类）` : ''}${adoptedCount ? `，已采纳 ${adoptedCount} 项` : ''}${fixableCount ? `，${fixableCount} 项待采纳` : ''}`}
          </p>
        </div>
        <div className="document-issue-panel-actions">
          {onStartProofread ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={busy}
              onClick={onStartProofread}
              title={hasRun ? '重新校对' : '开始校对'}
            >
              <Sparkles size={14} />
              {hasRun ? '重新校对' : '开始校对'}
            </button>
          ) : null}
          <button type="button" className="btn btn-sm btn-icon-only" onClick={onDismiss} aria-label="关闭">
            <X size={14} />
          </button>
        </div>
      </div>

      {!hasRun ? (
        <div className="document-issue-empty-start">
          <Sparkles size={22} />
          <p>先确认文体与校对要求，再由 AI 检查用语、逻辑与格式问题。</p>
          {onStartProofread ? (
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={onStartProofread}>
              <Sparkles size={14} />
              开始智能校对
            </button>
          ) : null}
        </div>
      ) : issues.length > 0 ? (
        <>
          <ul className="document-issue-list">
            {issueGroups.map((group) => {
              const issue = group.issues[0]
              const adopted = group.issues.every((item) => adoptedIssueIds.has(item.id))
              const partiallyAdopted =
                !adopted && group.issues.some((item) => adoptedIssueIds.has(item.id))
              const canToggle = group.issues.some(
                (item) => item.autoFixable && item.start !== item.end,
              )
              const isActive = group.issues.some((item) => item.id === activeIssueId)
              const contextSnippet = buildIssueContextSnippet(content, issue)

              return (
                <li
                  key={group.key}
                  className={`document-issue-item cat-${issue.category}${isActive ? ' active' : ''}${adopted ? ' adopted' : partiallyAdopted ? ' partial' : ' pending'}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleLocateGroup(group)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleLocateGroup(group)
                    }
                  }}
                >
                  <div className="document-issue-item-top">
                    <span className="document-issue-tag">{getIssueCategoryLabel(issue.category)}</span>
                    {group.issues.length > 1 ? (
                      <span className="document-issue-count">共 {group.issues.length} 处</span>
                    ) : null}
                  </div>
                  <p className="document-issue-message">{issue.message}</p>
                  {issue.original ? (
                    <p className="document-issue-diff">
                      <span className="issue-original">{issue.original}</span>
                      <span className="issue-arrow">→</span>
                      <span className="issue-suggestion">{issue.suggestion || '（删除）'}</span>
                    </p>
                  ) : issue.suggestion ? (
                    <p className="document-issue-diff">
                      <span className="issue-suggestion">{issue.suggestion}</span>
                    </p>
                  ) : null}
                  {contextSnippet ? (
                    <p className="document-issue-context" title={contextSnippet}>
                      {contextSnippet}
                    </p>
                  ) : null}
                  {group.issues.length > 1 ? (
                    <p className="document-issue-hint">点击卡片可依次定位到每一处</p>
                  ) : null}
                  {canToggle ? (
                    <button
                      type="button"
                      className={`btn btn-sm btn-ghost document-issue-apply${adopted ? ' document-issue-applied' : ''}`}
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (group.issues.length > 1) {
                          onToggleAdoptGroup(group.issues)
                          return
                        }
                        onToggleAdopt(issue)
                      }}
                    >
                      {adopted ? <Check size={12} /> : null}
                      {adopted
                        ? group.issues.length > 1
                          ? '已全部采纳'
                          : '已采纳'
                        : partiallyAdopted
                          ? '采纳剩余'
                          : group.issues.length > 1
                            ? '全部采纳'
                            : '采纳'}
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
          {fixableCount > 0 ? (
            <button type="button" className="btn btn-sm btn-primary document-issue-apply-all" disabled={busy} onClick={onApplyAll}>
              <Wand2 size={14} />
              一键全部采纳
            </button>
          ) : null}
          {onGoFormat ? (
            <button type="button" className="btn btn-sm btn-ghost document-issue-next-step" disabled={busy} onClick={onGoFormat}>
              <Type size={14} />
              下一步：智能排版
            </button>
          ) : null}
        </>
      ) : (
        <div className="document-issue-empty-start">
          <p className="document-issue-empty">文档表述良好，AI 未发现需要修改的问题。</p>
          {onGoFormat ? (
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={onGoFormat}>
              <Type size={14} />
              下一步：智能排版
            </button>
          ) : null}
        </div>
      )}
    </aside>
  )
}
