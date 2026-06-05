import { BarChart2, BarChart3, FileText } from 'lucide-react'

export type WorkspaceId = 'chart' | 'document'

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
            <p>数据可视化图表生成器</p>
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
        </nav>
      </div>

      {savedLabel ? (
        <span className="autosave-hint" title="表格与图表配置会自动保存到浏览器">
          已自动保存 {savedLabel}
        </span>
      ) : null}
    </header>
  )
}
