import { useState } from 'react'
import { ChevronDown, ChevronRight, Image, LayoutTemplate, Library, Sparkles } from 'lucide-react'

import {
  PPT_BEAUTIFY_PATH_COMPARE,
  PPT_BEAUTIFY_SCENARIO_CARDS,
  type PptBeautifyScenarioCard,
} from '../data/pptBeautifyScenarios'
import type { PptBeautifyScreen } from '../types/pptBeautify'

interface PptBeautifyLandingProps {
  onSelect: (screen: PptBeautifyScreen) => void
}

function ScenarioIcon({ icon }: { icon: PptBeautifyScenarioCard['icon'] }) {
  const size = 22
  switch (icon) {
    case 'sparkles':
      return <Sparkles size={size} />
    case 'image':
      return <Image size={size} />
    case 'library':
      return <Library size={size} />
    case 'template':
      return <LayoutTemplate size={size} />
  }
}

export default function PptBeautifyLanding({ onSelect }: PptBeautifyLandingProps) {
  const [compareOpen, setCompareOpen] = useState(false)

  return (
    <div className="ppt-beautify-landing">
      <header className="ppt-beautify-landing-head">
        <h3>我想…</h3>
        <p>选一种出稿方式开始。大多数汇报场景推荐「AI 智能设计」。</p>
      </header>

      <div className="ppt-beautify-scenario-grid">
        {PPT_BEAUTIFY_SCENARIO_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            className="ppt-beautify-scenario-card"
            onClick={() => onSelect(card.id)}
          >
            <span className="ppt-beautify-scenario-icon">
              <ScenarioIcon icon={card.icon} />
            </span>
            <strong>{card.title}</strong>
            <p>{card.summary}</p>
            <span className="ppt-beautify-scenario-meta">{card.duration}</span>
            <span className="ppt-beautify-scenario-fit">{card.fitFor}</span>
            <span className="ppt-beautify-scenario-cta">
              开始
              <ChevronRight size={14} />
            </span>
          </button>
        ))}
      </div>

      <div className="ppt-beautify-compare-section">
        <button
          type="button"
          className="ppt-beautify-compare-toggle"
          onClick={() => setCompareOpen((open) => !open)}
        >
          {compareOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          不确定选哪个？看出稿方式对比
        </button>
        {compareOpen ? (
          <div className="ppt-beautify-compare-table-wrap">
            <table className="ppt-beautify-compare-table">
              <thead>
                <tr>
                  <th scope="col" />
                  <th scope="col">AI 设计</th>
                  <th scope="col">截图还原</th>
                  <th scope="col">千帆</th>
                  <th scope="col">模板导出</th>
                </tr>
              </thead>
              <tbody>
                {PPT_BEAUTIFY_PATH_COMPARE.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td>{row.ai}</td>
                    <td>{row.replica}</td>
                    <td>{row.qianfan}</td>
                    <td>{row.template}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}
