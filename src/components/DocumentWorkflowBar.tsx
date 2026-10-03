import { Check, FileDown, ListTree, Sparkles, Type, Upload } from 'lucide-react'

export type DocumentWorkflowStep = 'prepare' | 'structure' | 'proofread' | 'format' | 'export'

const STEPS: { id: DocumentWorkflowStep; label: string; icon: typeof Sparkles }[] = [
  { id: 'prepare', label: '准备文档', icon: Upload },
  { id: 'structure', label: '结构梳理', icon: ListTree },
  { id: 'proofread', label: '智能校对', icon: Sparkles },
  { id: 'format', label: '智能排版', icon: Type },
  { id: 'export', label: '导出 Word', icon: FileDown },
]

const STEP_TIPS: Record<DocumentWorkflowStep, string> = {
  prepare: '从「写文书」「上传 Word」或右侧模板开始；已有正文时可点右上角「重新上传」。',
  structure: '在右侧侧栏点击「开始梳理」，生成大纲与建议；可对建议逐条优化，改前需确认。',
  proofread: '在右侧侧栏启动校对，先确认识别文体与提示词，再提交执行。',
  format: '右侧侧栏按 GB/T 9704 检查层次与版式；确认后写入正文，导出将直接使用本次结果。',
  export: '点右上角「导出文件」，可导出已排版 Word；若上传过原稿，仍可保留原版式。',
}

function stepIndex(step: DocumentWorkflowStep): number {
  return STEPS.findIndex((item) => item.id === step)
}

interface DocumentWorkflowBarProps {
  activeStep: DocumentWorkflowStep
  completedThrough: DocumentWorkflowStep
  hasContent: boolean
  onStepClick?: (step: DocumentWorkflowStep) => void
}

export function canNavigateToWorkflowStep(
  step: DocumentWorkflowStep,
  input: {
    activeStep: DocumentWorkflowStep
    hasContent: boolean
  },
): boolean {
  const stepIdx = stepIndex(step)
  const activeIdx = stepIndex(input.activeStep)
  if (stepIdx === activeIdx) return false
  if (stepIdx < activeIdx) return true
  if (step === 'structure' || step === 'proofread' || step === 'format' || step === 'export') {
    return input.hasContent
  }
  return true
}

export function resolveDocumentWorkflowStep(input: {
  hasContent: boolean
  inProofread: boolean
  inFormat: boolean
  proofreadFinished: boolean
  formatFinished: boolean
}): DocumentWorkflowStep {
  if (!input.hasContent) return 'prepare'
  if (input.inFormat) return 'format'
  if (input.inProofread) return 'proofread'
  if (input.formatFinished) return 'export'
  if (input.proofreadFinished) return 'format'
  return 'structure'
}

export function completedThroughStep(input: {
  hasContent: boolean
  proofreadFinished: boolean
  formatFinished: boolean
}): DocumentWorkflowStep {
  if (!input.hasContent) return 'prepare'
  if (!input.proofreadFinished) return 'structure'
  if (!input.formatFinished) return 'proofread'
  return 'export'
}

export default function DocumentWorkflowBar({
  activeStep,
  completedThrough,
  hasContent,
  onStepClick,
}: DocumentWorkflowBarProps) {
  const activeIdx = stepIndex(activeStep)
  const completedIdx = stepIndex(completedThrough)

  return (
    <div className="document-workflow-bar">
      <ol className="document-workflow-steps" aria-label="文档编辑流程">
        {STEPS.map((step, index) => {
          const Icon = step.icon
          const isActive = step.id === activeStep
          const isDone = index < completedIdx || (index === completedIdx && activeIdx > index)
          const isClickable =
            !!onStepClick &&
            canNavigateToWorkflowStep(step.id, { activeStep, hasContent })
          const className = `document-workflow-step${isActive ? ' active' : ''}${isDone ? ' done' : ''}${isClickable ? ' clickable' : ''}`

          if (isClickable) {
            return (
              <li key={step.id}>
                <button
                  type="button"
                  className={className}
                  aria-current={isActive ? 'step' : undefined}
                  onClick={() => onStepClick(step.id)}
                >
                  <span className="document-workflow-step-marker" aria-hidden="true">
                    {isDone ? <Check size={14} /> : <Icon size={14} />}
                  </span>
                  <span className="document-workflow-step-label">{step.label}</span>
                </button>
              </li>
            )
          }

          return (
            <li
              key={step.id}
              className={className}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="document-workflow-step-marker" aria-hidden="true">
                {isDone ? <Check size={14} /> : <Icon size={14} />}
              </span>
              <span className="document-workflow-step-label">{step.label}</span>
            </li>
          )
        })}
      </ol>
      <p className="document-workflow-tip">{STEP_TIPS[activeStep]}</p>
    </div>
  )
}
