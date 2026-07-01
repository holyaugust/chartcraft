import { FileText, Trash2, Upload } from 'lucide-react'

import { PPT_SOURCE_ACCEPT } from '../utils/pptSourceDocument'
import type { PptSourceDocument } from '../utils/pptSourceDocument'

interface PptBeautifyGlobalMaterialBarProps {
  material: PptSourceDocument | null
  busy?: boolean
  compact?: boolean
  onUpload: (file: File) => void | Promise<void>
  onClear: () => void
}

export default function PptBeautifyGlobalMaterialBar({
  material,
  busy = false,
  compact = false,
  onUpload,
  onClear,
}: PptBeautifyGlobalMaterialBarProps) {
  return (
    <div className={`ppt-global-material-bar${compact ? ' compact' : ''}`}>
      <div className="ppt-global-material-bar-main">
        <FileText size={16} aria-hidden="true" />
        <div className="ppt-global-material-bar-text">
          <strong>当前材料</strong>
          <span>{material ? material.name : '尚未上传 — 可在入口页或各流程中上传 Word / PDF'}</span>
        </div>
      </div>
      <div className="ppt-global-material-bar-actions">
        <label className="btn btn-sm btn-ghost ppt-global-material-upload">
          <Upload size={14} />
          {material ? '更换' : '上传材料'}
          <input
            type="file"
            accept={PPT_SOURCE_ACCEPT}
            hidden
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onUpload(file)
              e.target.value = ''
            }}
          />
        </label>
        {material ? (
          <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={onClear} aria-label="清除材料">
            <Trash2 size={14} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
