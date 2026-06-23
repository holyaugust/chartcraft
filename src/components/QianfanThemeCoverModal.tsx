import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { qianfanThemeLabel, type QianfanPptTheme } from '../types/qianfanPpt'

interface QianfanThemeCoverModalProps {
  theme: QianfanPptTheme | null
  onClose: () => void
}

export default function QianfanThemeCoverModal({ theme, onClose }: QianfanThemeCoverModalProps) {
  useEffect(() => {
    if (!theme) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [theme, onClose])

  if (!theme) return null

  const metaTags = [
    ...theme.style_name_list,
    ...theme.style_list,
    ...theme.scene_list,
  ].filter((tag, index, list) => tag && list.indexOf(tag) === index)

  return createPortal(
    <div className="qianfan-cover-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="qianfan-cover-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qianfan-cover-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="qianfan-cover-modal-head">
          <h3 id="qianfan-cover-modal-title">{qianfanThemeLabel(theme)}</h3>
          <button type="button" className="qianfan-cover-modal-close" aria-label="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="qianfan-cover-modal-body">
          {theme.main_img_url ? (
            <img
              src={theme.main_img_url}
              alt={qianfanThemeLabel(theme)}
              className="qianfan-cover-modal-img"
            />
          ) : (
            <div className="qianfan-cover-modal-empty">暂无官方封面预览</div>
          )}
          {metaTags.length > 0 ? (
            <ul className="qianfan-cover-modal-tags">
              {metaTags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          ) : null}
          {theme.color_list.length > 0 ? (
            <div className="qianfan-cover-modal-colors" aria-label="配色">
              {theme.color_list.map((color) => (
                <span key={color} title={color} style={{ background: color }} />
              ))}
            </div>
          ) : null}
          <p className="qianfan-cover-modal-note">官方封面预览 · 正式效果以千帆生成结果为准</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
