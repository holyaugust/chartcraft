import { useEffect, useRef, useState } from 'react'
import { GitBranch, GripVertical, Link2, Plus, Sparkles, Trash2, X } from 'lucide-react'

export const FLOWCHART_EDGE_LABEL_PRESETS = ['', '是', '否', '通过', '拒绝'] as const

export interface DiagramFlowchartToolbarProps {
  label: string
  isDecision: boolean
  left: number
  top: number
  selectionKey: string
  edgeLabel: string
  aiPrompt: string
  aiBusy: boolean
  onEdgeLabelChange: (label: string) => void
  onAddStep: () => void
  onAddDecision: () => void
  onAddBranch: () => void
  onStartConnect: () => void
  onAiPromptChange: (value: string) => void
  onAiModify: () => void
  onDelete: () => void
}

function useToolbarDrag(left: number, top: number, resetKey: string) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)

  useEffect(() => {
    setOffset({ x: 0, y: 0 })
    dragRef.current = null
    setDragging(false)
  }, [resetKey])

  const onDragHandlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: offset.x,
      baseY: offset.y,
    }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onDragHandlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    event.stopPropagation()
    setOffset({
      x: dragRef.current.baseX + event.clientX - dragRef.current.startX,
      y: dragRef.current.baseY + event.clientY - dragRef.current.startY,
    })
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    event.stopPropagation()
    dragRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return {
    position: { left: left + offset.x, top: top + offset.y },
    dragging,
    dragHandleProps: {
      onPointerDown: onDragHandlePointerDown,
      onPointerMove: onDragHandlePointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
  }
}

export default function DiagramFlowchartToolbar({
  label,
  isDecision,
  left,
  top,
  selectionKey,
  edgeLabel,
  aiPrompt,
  aiBusy,
  onEdgeLabelChange,
  onAddStep,
  onAddDecision,
  onAddBranch,
  onStartConnect,
  onAiPromptChange,
  onAiModify,
  onDelete,
}: DiagramFlowchartToolbarProps) {
  const [customLabel, setCustomLabel] = useState('')
  const { position, dragging, dragHandleProps } = useToolbarDrag(left, top, selectionKey)

  return (
    <div
      className={`diagram-node-toolbar diagram-flowchart-toolbar${dragging ? ' diagram-flowchart-toolbar-dragging' : ''}`}
      style={{ left: position.left, top: position.top }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onPointerCancel={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="diagram-toolbar-drag-handle" title="拖动面板" {...dragHandleProps}>
        <GripVertical size={14} aria-hidden />
        <span className="diagram-node-toolbar-label diagram-node-toolbar-label-inline" title={label}>
          {label || '节点'}
        </span>
        <span className="diagram-toolbar-drag-hint">拖动</span>
      </div>

      <div className="diagram-flowchart-toolbar-block">
        <span className="diagram-flowchart-toolbar-caption">箭头标签</span>
        <div className="diagram-edge-label-row">
          {FLOWCHART_EDGE_LABEL_PRESETS.map((preset) => (
            <button
              key={preset || 'none'}
              type="button"
              className={`diagram-edge-label-btn${edgeLabel === preset ? ' active' : ''}`}
              onClick={() => onEdgeLabelChange(preset)}
            >
              {preset || '无'}
            </button>
          ))}
          <input
            className="diagram-edge-label-input"
            value={customLabel}
            onChange={(event) => setCustomLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                onEdgeLabelChange(customLabel.trim())
              }
            }}
            placeholder="自定义"
            spellCheck={false}
          />
        </div>
      </div>

      <div className="diagram-node-toolbar-actions">
        <button type="button" className="diagram-node-toolbar-btn" title="在下游添加步骤" onClick={onAddStep}>
          <Plus size={13} />
          步骤
        </button>
        <button type="button" className="diagram-node-toolbar-btn" title="在下游添加判断" onClick={onAddDecision}>
          <Plus size={13} />
          判断
        </button>
        {isDecision ? (
          <button type="button" className="diagram-node-toolbar-btn" title="添加带标签的分支" onClick={onAddBranch}>
            <GitBranch size={13} />
            分支
          </button>
        ) : null}
        <button type="button" className="diagram-node-toolbar-btn" title="点击后选择目标节点直接连线" onClick={onStartConnect}>
          <Link2 size={13} />
          连接到
        </button>
        <button
          type="button"
          className="diagram-node-toolbar-btn diagram-node-toolbar-btn-danger"
          title="删除节点"
          onClick={onDelete}
        >
          <Trash2 size={13} />
          删除
        </button>
      </div>

      <div className="diagram-flowchart-ai-block">
        <span className="diagram-flowchart-toolbar-caption">AI 改分支</span>
        <textarea
          className="diagram-flowchart-ai-input"
          value={aiPrompt}
          onChange={(event) => onAiPromptChange(event.target.value)}
          placeholder="例如：增加「不通过」分支回到提交节点"
          rows={2}
          spellCheck={false}
        />
        <button
          type="button"
          className="diagram-node-toolbar-btn diagram-flowchart-ai-btn"
          disabled={aiBusy || !aiPrompt.trim()}
          onClick={onAiModify}
        >
          {aiBusy ? <Sparkles size={13} className="spin" /> : <Sparkles size={13} />}
          {aiBusy ? 'AI 处理中…' : 'AI 改分支'}
        </button>
      </div>
    </div>
  )
}

export function DiagramLinkPickBanner({
  message,
  onCancel,
}: {
  message: string
  onCancel: () => void
}) {
  return (
    <div className="diagram-link-pick-banner">
      <span>{message}</span>
      <button type="button" className="diagram-link-pick-cancel" onClick={onCancel}>
        <X size={14} />
        取消
      </button>
    </div>
  )
}
