import { LayoutTemplate, Search } from 'lucide-react'

import type { CSSProperties } from 'react'

import {

  DOCUMENT_TEMPLATES,

  getDocumentTemplateById,

  getDocumentTemplateMetaLabel,

  type DocumentTemplate,

} from '../data/documentTemplates'



/** 职场高频文书，便于侧栏一键载入 */

const QUICK_TEMPLATE_IDS = [

  'wp-notice-work',

  'wp-request-work',

  'wp-report-work',

  'wp-summary-month',

  'wp-meeting-minutes',

  'doc-tongzhi',

] as const



interface DocumentTemplateSidebarProps {

  activeTemplateId?: string | null

  onOpenLibrary: () => void

  onApply: (template: DocumentTemplate) => void

}



export default function DocumentTemplateSidebar({

  activeTemplateId,

  onOpenLibrary,

  onApply,

}: DocumentTemplateSidebarProps) {

  const activeTemplate = activeTemplateId ? getDocumentTemplateById(activeTemplateId) : null

  const quickTemplates = QUICK_TEMPLATE_IDS.map((id) => getDocumentTemplateById(id)).filter(

    (item): item is DocumentTemplate => Boolean(item),

  )



  return (

    <section className="document-template-sidebar-compact" aria-label="职场公文模板快捷入口">

      <div className="document-template-sidebar-head">

        <LayoutTemplate size={18} />

        <div>

          <h3>职场公文</h3>

          <p>通知 · 汇报 · 总结 · 会议 · 共 {DOCUMENT_TEMPLATES.length} 套</p>

        </div>

      </div>



      {activeTemplate ? (

        <div className="document-template-current" style={{ '--template-accent': activeTemplate.accent } as CSSProperties}>

          <span className="document-template-current-label">当前选用</span>

          <strong>{activeTemplate.name}</strong>

          <span>{getDocumentTemplateMetaLabel(activeTemplate)}</span>

        </div>

      ) : (

        <p className="document-template-sidebar-hint">载入完整范文后按实际修改；国标公文导出时自动套用 GB/T 9704 排版。</p>

      )}



      <button type="button" className="btn btn-primary document-template-open-library" onClick={onOpenLibrary}>

        <Search size={16} />

        浏览全部模板

      </button>



      <div className="document-template-quick">

        <span className="document-template-quick-label">常用模板</span>

        <div className="document-template-quick-grid">

          {quickTemplates.map((template) => (

            <button

              key={template.id}

              type="button"

              className={`document-template-quick-btn${activeTemplateId === template.id ? ' active' : ''}`}

              onClick={() => onApply(template)}

            >

              {template.name}

            </button>

          ))}

        </div>

      </div>

    </section>

  )

}

