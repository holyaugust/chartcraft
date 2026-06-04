import type { ReactNode } from 'react'
import {
  BarChart3,
  LineChart,
  PieChart,
  AreaChart,
  ScatterChart,
  Radar,
  CircleDot,
  ChartColumn,
} from 'lucide-react'
import type { ChartType } from '../types'
import { CHART_TYPE_LABELS } from '../types'

interface ChartTypeSelectorProps {
  value: ChartType
  onChange: (type: ChartType) => void
}

const CHART_TYPES: { type: ChartType; icon: ReactNode }[] = [
  { type: 'bar', icon: <BarChart3 size={20} /> },
  { type: 'line', icon: <LineChart size={20} /> },
  { type: 'area', icon: <AreaChart size={20} /> },
  { type: 'combo', icon: <ChartColumn size={20} /> },
  { type: 'pie', icon: <PieChart size={20} /> },
  { type: 'donut', icon: <CircleDot size={20} /> },
  { type: 'scatter', icon: <ScatterChart size={20} /> },
  { type: 'radar', icon: <Radar size={20} /> },
]

export default function ChartTypeSelector({ value, onChange }: ChartTypeSelectorProps) {
  return (
    <div className="chart-type-grid">
      {CHART_TYPES.map(({ type, icon }) => (
        <button
          key={type}
          type="button"
          className={`chart-type-btn ${value === type ? 'active' : ''}`}
          onClick={() => onChange(type)}
        >
          {icon}
          <span>{CHART_TYPE_LABELS[type]}</span>
        </button>
      ))}
    </div>
  )
}
