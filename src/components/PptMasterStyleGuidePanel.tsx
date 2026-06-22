import { FileText, Sparkles } from 'lucide-react'

import PptMasterPromptTemplateList from './PptMasterPromptTemplateList'
import { PPT_MASTER_PROMPT_TEMPLATES } from '../data/pptMasterPromptTemplates'
import { resolveStylePreviewColors } from '../data/pptMasterStylePreview'
import type { PptMasterStyle } from '../types/pptMaster'
import { PPT_MASTER_STYLE_HINTS, PPT_MASTER_STYLE_LABELS } from '../types/pptMaster'

interface PptMasterStyleGuidePanelProps {
  style: PptMasterStyle
  sourceFile: File | null
  sourceName: string
  onPromptChange: (value: string) => void
}

export default function PptMasterStyleGuidePanel({
  style,
  sourceFile,
  sourceName,
  onPromptChange,
}: PptMasterStyleGuidePanelProps) {
  const colors = resolveStylePreviewColors(style)

  return (
    <div className="ppt-master-style-guide">
      <header className="ppt-master-style-guide-head ppt-master-style-guide-head-compact">
        <h3 className="ppt-master-style-guide-title">{PPT_MASTER_STYLE_LABELS[style]}</h3>
        <p className="ppt-master-style-guide-scene">{PPT_MASTER_STYLE_HINTS[style]}</p>
      </header>

      <div className="ppt-master-style-guide-body">
        <div className="ppt-master-style-guide-preview">
          <div className="ppt-master-style-mock" aria-hidden="true">
            <div
              className="ppt-master-style-mock-slide"
              style={{
                background: colors.slideBackground,
                ['--mock-accent' as string]: colors.accent,
                ['--mock-title' as string]: colors.titleColor,
                ['--mock-body' as string]: colors.bodyColor,
                ['--mock-card' as string]: colors.cardBackground,
                ['--mock-header' as string]: colors.headerBackground,
              }}
            >
              {colors.decoration ? (
                <div className="ppt-master-style-mock-deco" style={{ background: colors.decoration }} />
              ) : null}
              <div className="ppt-master-style-mock-accent-bar" />
              <p className="ppt-master-style-mock-title">汇报标题示例</p>
              <p className="ppt-master-style-mock-sub">副标题 · 风格预览</p>
              <div className="ppt-master-style-mock-content">
                <div className="ppt-master-style-mock-header" style={{ background: colors.headerBackground }} />
                <div className="ppt-master-style-mock-card" style={{ borderColor: colors.accent }}>
                  <span className="ppt-master-style-mock-bullet" />
                  <span className="ppt-master-style-mock-line" />
                  <span className="ppt-master-style-mock-line ppt-master-style-mock-line-short" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="ppt-master-style-guide-examples">
          <PptMasterPromptTemplateList templates={PPT_MASTER_PROMPT_TEMPLATES} onSelect={onPromptChange} />
        </div>
      </div>

      <footer className="ppt-master-style-guide-footer">
        {sourceFile ? (
          <p className="ppt-master-style-guide-ready-line">
            <FileText size={15} />
            <span>
              <strong>{sourceName || sourceFile.name}</strong>
              · {PPT_MASTER_STYLE_LABELS[style]}
              · 点击左侧「开始 AI 一键设计」
            </span>
          </p>
        ) : (
          <p className="ppt-master-style-guide-foot">
            <Sparkles size={15} />
            上传材料、选风格，填写生成要求后开始
          </p>
        )}
      </footer>
    </div>
  )
}
