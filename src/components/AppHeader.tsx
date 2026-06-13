import { BarChart2, BarChart3, Brain, FileText, GitBranch, LayoutGrid } from 'lucide-react'

export type WorkspaceId = 'chart' | 'document' | 'flowchart' | 'mindmap' | 'smartgraphic'

interface AppHeaderProps {
  workspace: WorkspaceId
  onWorkspaceChange: (id: WorkspaceId) => void
  savedLabel?: string
}

export default function AppHeader({ workspace, onWorkspaceChange, savedLabel }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="header-brand">
          <div className="brand-icon">
            <BarChart2 size={24} />
          </div>
          <div>
            <h1>ChartCraft</h1>
            <p>数据 · 文档 · 流程图 · 思维导图 · 智能图形</p>
          </div>
        </div>

        <nav className="header-workspace-nav" aria-label="工作区切换">
          <button
            type="button"
            className={`workspace-nav-btn${workspace === 'chart' ? ' active' : ''}`}
            title="图表编辑"
            aria-label="图表编辑"
            aria-current={workspace === 'chart' ? 'page' : undefined}
            onClick={() => onWorkspaceChange('chart')}
          >
            <BarChart3 size={22} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={`workspace-nav-btn${workspace === 'document' ? ' active' : ''}`}
            title="文档编辑"
            aria-label="文档编辑"
            aria-current={workspace === 'document' ? 'page' : undefined}
            onClick={() => onWorkspaceChange('document')}
          >
            <FileText size={22} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={`workspace-nav-btn${workspace === 'flowchart' ? ' active' : ''}`}
            title="流程图"
            aria-label="流程图"
            aria-current={workspace === 'flowchart' ? 'page' : undefined}
            onClick={() => onWorkspaceChange('flowchart')}
          >
            <GitBranch size={22} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={`workspace-nav-btn${workspace === 'mindmap' ? ' active' : ''}`}
            title="思维导图"
            aria-label="思维导图"
            aria-current={workspace === 'mindmap' ? 'page' : undefined}
            onClick={() => onWorkspaceChange('mindmap')}
          >
            <Brain size={22} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={`workspace-nav-btn${workspace === 'smartgraphic' ? ' active' : ''}`}
            title="智能图形"
            aria-label="智能图形"
            aria-current={workspace === 'smartgraphic' ? 'page' : undefined}
            onClick={() => onWorkspaceChange('smartgraphic')}
          >
            <LayoutGrid size={22} strokeWidth={2} />
          </button>
        </nav>
      </div>

      {savedLabel ? (
        <span className="autosave-hint" title="内容会自动保存到浏览器">
          已自动保存 {savedLabel}
        </span>
      ) : null}
    </header>
  )
}
