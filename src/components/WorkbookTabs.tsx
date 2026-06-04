import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'

interface WorkbookTabsProps {
  sheets: { id: string; name: string }[]
  activeId: string
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => boolean
}

type ContextMenuState = {
  sheetId: string
  x: number
  y: number
}

export default function WorkbookTabs({
  sheets,
  activeId,
  onSelect,
  onAdd,
  onDelete,
  onRename,
}: WorkbookTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const canDelete = sheets.length > 1

  const startRename = useCallback((sheetId: string, currentName: string) => {
    setContextMenu(null)
    setEditingId(sheetId)
    setDraftName(currentName)
    setRenameError(null)
  }, [])

  const cancelRename = useCallback(() => {
    setEditingId(null)
    setDraftName('')
    setRenameError(null)
  }, [])

  const commitRename = useCallback(() => {
    if (!editingId) return

    const trimmed = draftName.trim()
    if (!trimmed) {
      setRenameError('名称不能为空')
      window.requestAnimationFrame(() => inputRef.current?.focus())
      return
    }

    const current = sheets.find((sheet) => sheet.id === editingId)
    if (current?.name === trimmed) {
      cancelRename()
      return
    }

    const ok = onRename(editingId, trimmed)
    if (!ok) {
      setRenameError('工作表名称已存在')
      window.requestAnimationFrame(() => inputRef.current?.focus())
      return
    }

    cancelRename()
  }, [cancelRename, draftName, editingId, onRename, sheets])

  useEffect(() => {
    if (!editingId) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [editingId])

  useEffect(() => {
    if (!contextMenu) return

    const closeMenu = () => setContextMenu(null)
    window.addEventListener('click', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('resize', closeMenu)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('resize', closeMenu)
    }
  }, [contextMenu])

  if (sheets.length === 0) return null

  return (
    <>
      <div className="workbook-tabs" role="tablist" aria-label="工作表">
        {sheets.map((sheet) => {
          const isActive = sheet.id === activeId
          const isEditing = editingId === sheet.id

          return (
            <div
              key={sheet.id}
              className={`workbook-tab-item ${isActive ? 'active' : ''} ${isEditing ? 'editing' : ''}`}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  className={`workbook-tab-input${renameError ? ' invalid' : ''}`}
                  title={renameError ?? undefined}
                  value={draftName}
                  maxLength={31}
                  aria-label="重命名工作表"
                  onChange={(e) => {
                    setDraftName(e.target.value)
                    setRenameError(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitRename()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      cancelRename()
                    }
                  }}
                  onBlur={() => commitRename()}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className="workbook-tab"
                  onClick={() => onSelect(sheet.id)}
                  onDoubleClick={(e) => {
                    e.preventDefault()
                    startRename(sheet.id, sheet.name)
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setContextMenu({ sheetId: sheet.id, x: e.clientX, y: e.clientY })
                  }}
                  title={`${sheet.name}（双击重命名）`}
                >
                  <span className="workbook-tab-label">{sheet.name}</span>
                </button>
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        className="workbook-tab-add"
        onClick={onAdd}
        title="添加工作表"
        aria-label="添加工作表"
      >
        <Plus size={14} strokeWidth={2.5} />
      </button>

      {contextMenu ? (
        <div
          className="workbook-tab-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => {
              const sheet = sheets.find((item) => item.id === contextMenu.sheetId)
              if (sheet) startRename(sheet.id, sheet.name)
            }}
          >
            重命名
          </button>
          <button
            type="button"
            disabled={!canDelete}
            title={canDelete ? '删除工作表' : '至少保留一个工作表'}
            onClick={() => {
              if (!canDelete) return
              onDelete(contextMenu.sheetId)
              setContextMenu(null)
            }}
          >
            删除
          </button>
        </div>
      ) : null}
    </>
  )
}
