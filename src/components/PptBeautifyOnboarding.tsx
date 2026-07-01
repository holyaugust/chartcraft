import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

import { PPT_BEAUTIFY_ONBOARDING_KEY } from '../types/pptBeautify'

const SLIDES = [
  {
    title: 'PPT 美化有 4 种出稿方式',
    body: '大多数用户选择「AI 智能设计」：上传 Word/PDF，选风格，等待几分钟即可下载可编辑 pptx。',
  },
  {
    title: '三步完成 AI 智能设计',
    body: '① 上传材料 → ② 选视觉风格（配色与预览一致）→ ③ 确认要求并生成。',
  },
  {
    title: '材料只需上传一次',
    body: '在顶部「当前材料」栏上传后，切换千帆或模板导出时会自动带入同一份文档。',
  },
] as const

interface PptBeautifyOnboardingProps {
  onClose: () => void
}

export default function PptBeautifyOnboarding({ onClose }: PptBeautifyOnboardingProps) {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]
  const last = index >= SLIDES.length - 1

  const finish = (remember: boolean) => {
    if (remember) {
      try {
        localStorage.setItem(PPT_BEAUTIFY_ONBOARDING_KEY, '1')
      } catch {
        /* ignore */
      }
    }
    onClose()
  }

  return (
    <div className="ppt-onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="ppt-onboarding-title">
      <div className="ppt-onboarding-card">
        <button type="button" className="ppt-onboarding-close" aria-label="关闭" onClick={() => finish(true)}>
          <X size={18} />
        </button>
        <p className="ppt-onboarding-progress">
          {index + 1} / {SLIDES.length}
        </p>
        <h3 id="ppt-onboarding-title">{slide.title}</h3>
        <p className="ppt-onboarding-body">{slide.body}</p>
        <div className="ppt-onboarding-actions">
          {index > 0 ? (
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setIndex((i) => i - 1)}>
              <ChevronLeft size={14} />
              上一步
            </button>
          ) : (
            <span />
          )}
          {last ? (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => finish(true)}>
              开始使用
            </button>
          ) : (
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setIndex((i) => i + 1)}>
              下一步
              <ChevronRight size={14} />
            </button>
          )}
        </div>
        {!last ? (
          <button type="button" className="ppt-onboarding-skip" onClick={() => finish(true)}>
            跳过引导
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function shouldShowPptBeautifyOnboarding(): boolean {
  try {
    return !localStorage.getItem(PPT_BEAUTIFY_ONBOARDING_KEY)
  } catch {
    return false
  }
}
