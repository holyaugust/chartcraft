import {
  AlertTriangle,
  Check,
  Eye,
  Loader2,
  RefreshCw,
  Type,
  Wand2,
  X,
} from 'lucide-react'
import { useMemo } from 'react'
import type { FormatAdjustReport } from '../utils/documentFormatAdjust'
import { buildOfficialLayoutHtml } from '../utils/documentOfficialLayout'

interface DocumentFormatPanelProps {
  report: FormatAdjustReport | null
  busy?: boolean
  confirmOpen?: boolean
  applied?: boolean
  onAnalyze: () => void
  onRequestApply: () => void
  onConfirmApply: () => void
  onCancelApply: () => void
  onDismiss: () => void
  onGoExport?: () => void
  onShowOfficialPreview?: () => void
}

export default function DocumentFormatPanel({
  report,
  busy = false,
  confirmOpen = false,
  applied = false,
  onAnalyze,
  onRequestApply,
  onConfirmApply,
  onCancelApply,
  onDismiss,
  onGoExport,
  onShowOfficialPreview,
}: DocumentFormatPanelProps) {
  const autoCount = report?.items.filter((item) => item.autoApply).length ?? 0
  const advisoryCount = report?.items.filter((item) => !item.autoApply).length ?? 0
  const previewHtml = useMemo(
    () => (report?.previewContent ? buildOfficialLayoutHtml(report.previewContent.slice(0, 2500)) : ''),
    [report?.previewContent],
  )

  return (
    <aside className="document-format-panel">
      <div className="document-format-panel-header">
        <div>
          <h3>
            <Type size={15} />
            智能排版
          </h3>
          <p>按 GB/T 9704 整理层次与版式；确认后写入正文，导出 Word 无需再排版</p>
        </div>
        <div className="document-format-panel-actions">
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={busy}
            onClick={onAnalyze}
            aria-label="重新检查"
            title="重新检查"
          >
            {busy ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
          </button>
          <button type="button" className="btn btn-sm btn-icon-only" onClick={onDismiss} aria-label="关闭">
            <X size={14} />
          </button>
        </div>
      </div>

      {busy && !report ? (
        <div className="document-format-empty">
          <Loader2 size={18} className="spin" />
          <p>正在智能排版检查…</p>
        </div>
      ) : null}

      {!busy && !report ? (
        <div className="document-format-empty">
          <Wand2 size={22} />
          <p>检查层次序号（一、／（一）／1.）、空行落款，并生成公文版式预览。完成后导出即可直接得到排版好的 Word。</p>
          <button type="button" className="btn btn-sm btn-primary" onClick={onAnalyze}>
            开始排版
          </button>
        </div>
      ) : null}

      {report ? (
        <div className="document-format-body">
          {busy ? (
            <p className="document-format-refreshing">
              <Loader2 size={12} className="spin" /> 正在重新检查排版…
            </p>
          ) : null}
          <div className="document-format-summary">
            {applied ? (
              <span className="is-done">
                <Check size={13} />
                排版已应用
              </span>
            ) : report.changed ? (
              <span className="is-pending">可自动调整 {autoCount} 项</span>
            ) : (
              <span className="is-ok">正文已可直接导出</span>
            )}
            {report.changed ? <span>约影响 {report.changeLineCount} 行</span> : null}
            {advisoryCount > 0 ? <span>另有 {advisoryCount} 条提示</span> : null}
          </div>

          <ul className="document-format-list">
            {report.items.map((item) => (
              <li key={item.id} className={item.autoApply ? 'is-auto' : 'is-advisory'}>
                <div className="document-format-item-icon" aria-hidden="true">
                  {item.autoApply ? <Wand2 size={13} /> : <AlertTriangle size={13} />}
                </div>
                <div>
                  <h4>
                    {item.title}
                    <em>{item.autoApply ? '可应用' : '仅提示'}</em>
                  </h4>
                  <p>{item.detail}</p>
                  {item.samples && item.samples.length > 0 ? (
                    <ul className="document-format-samples">
                      {item.samples.slice(0, 4).map((sample) => (
                        <li key={`${sample.original}->${sample.replacement}`}>
                          <span>{sample.original}</span>
                          <em>→</em>
                          <strong>{sample.replacement}</strong>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>

          {report.changed ? (
            <section className="document-format-preview">
              <header>
                <Eye size={13} />
                排版后预览
                {onShowOfficialPreview ? (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={onShowOfficialPreview}>
                    在左侧查看
                  </button>
                ) : null}
              </header>
              <div
                className="document-format-preview-layout"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </section>
          ) : null}

          <div className="document-format-footer">
            {report.changed && !applied ? (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={busy || confirmOpen}
                onClick={onRequestApply}
              >
                <Wand2 size={14} />
                应用智能排版
              </button>
            ) : null}
            {onShowOfficialPreview ? (
              <button type="button" className="btn btn-sm btn-ghost" onClick={onShowOfficialPreview}>
                <Eye size={14} />
                查看公文版式
              </button>
            ) : null}
            {(applied || !report.changed) && onGoExport ? (
              <button type="button" className="btn btn-sm btn-primary" onClick={onGoExport}>
                下一步：导出 Word
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {confirmOpen && report ? (
        <div className="document-format-confirm" role="dialog" aria-modal="true" aria-labelledby="format-confirm-title">
          <div className="document-format-confirm-card">
            <header>
              <h4 id="format-confirm-title">确认应用智能排版</h4>
              <p>
                将写入层次序号与排版整理结果（约 {report.changeLineCount} 行可能变化）。确认后导出 Word
                将直接使用本次结果，可用 Ctrl+Z 撤销。
              </p>
            </header>
            <footer>
              <button type="button" className="btn btn-sm btn-ghost" onClick={onCancelApply}>
                取消
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={onConfirmApply}>
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
