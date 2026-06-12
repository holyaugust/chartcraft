import { GitBranch, GitMerge, Plus, Trash2 } from 'lucide-react'
import type { DiagramKind } from '../types/diagram'

export interface DiagramNodeToolbarProps {
  kind: DiagramKind
  label: string
  isRoot?: boolean
  isDecision?: boolean
  left: number
  top: number
  onAddStep: () => void
  onAddDecision: () => void
  onAddBranch: () => void
  onAddChild: () => void
  onAddSibling: () => void
  onDelete: () => void
}

export default function DiagramNodeToolbar({
  kind,
  label,
  isRoot,
  isDecision,
  left,
  top,
  onAddStep,
  onAddDecision,
  onAddBranch,
  onAddChild,
  onAddSibling,
  onDelete,
}: DiagramNodeToolbarProps) {
  return (
    <div
      className="diagram-node-toolbar"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onPointerCancel={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <span className="diagram-node-toolbar-label" title={label}>
        {label || '节点'}
      </span>
      <div className="diagram-node-toolbar-actions">
        {kind === 'flowchart' ? (
          <>
            <button type="button" className="diagram-node-toolbar-btn" title="添加步骤节点" onClick={onAddStep}>
              <Plus size={13} />
              步骤
            </button>
            <button
              type="button"
              className="diagram-node-toolbar-btn"
              title="添加判断节点"
              onClick={onAddDecision}
            >
              <GitMerge size={13} />
              判断
            </button>
            {isDecision ? (
              <button type="button" className="diagram-node-toolbar-btn" title="添加分支" onClick={onAddBranch}>
                <GitBranch size={13} />
                分支
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button type="button" className="diagram-node-toolbar-btn" title="添加子节点" onClick={onAddChild}>
              <Plus size={13} />
              子节点
            </button>
            {!isRoot ? (
              <button type="button" className="diagram-node-toolbar-btn" title="添加同级节点" onClick={onAddSibling}>
                <GitBranch size={13} />
                同级
              </button>
            ) : null}
          </>
        )}
        <button
          type="button"
          className="diagram-node-toolbar-btn diagram-node-toolbar-btn-danger"
          title={isRoot ? '根节点不可删除' : '删除节点'}
          disabled={isRoot}
          onClick={onDelete}
        >
          <Trash2 size={13} />
          删除
        </button>
      </div>
    </div>
  )
}
