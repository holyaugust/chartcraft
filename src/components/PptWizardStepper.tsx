import { Check } from 'lucide-react'

export interface PptWizardStepperProps {
  steps: string[]
  current: number
  className?: string
}

export default function PptWizardStepper({ steps, current, className = '' }: PptWizardStepperProps) {
  return (
    <nav className={`ppt-wizard-stepper${className ? ` ${className}` : ''}`} aria-label="向导步骤">
      {steps.map((label, index) => {
        const stepNum = index + 1
        const done = stepNum < current
        const active = stepNum === current
        return (
          <div key={label} className={`ppt-wizard-stepper-item${active ? ' active' : ''}${done ? ' done' : ''}`}>
            <span className="ppt-wizard-stepper-dot" aria-hidden="true">
              {done ? <Check size={12} strokeWidth={3} /> : stepNum}
            </span>
            <span className="ppt-wizard-stepper-label">{label}</span>
            {index < steps.length - 1 ? <span className="ppt-wizard-stepper-line" aria-hidden="true" /> : null}
          </div>
        )
      })}
    </nav>
  )
}
