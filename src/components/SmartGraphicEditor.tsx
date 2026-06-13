import { useEffect, useRef } from 'react'
import type { SmartGraphicItem, SmartGraphicState, SmartGraphicTemplate } from '../types/smartGraphic'
import { SMART_GRAPHIC_COLOR_THEMES } from '../utils/smartGraphicColorSchemes'

interface SmartGraphicEditorProps {
  state: SmartGraphicState
  template: SmartGraphicTemplate
  selectedItemIndex?: number | null
  onChange: (state: SmartGraphicState) => void
}

function parseMetricsLines(text: string): SmartGraphicItem['metrics'] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, value] = line.split('|').map((part) => part.trim())
      return { label: label || '指标', value: value || '—' }
    })
}

function metricsToLines(metrics: SmartGraphicItem['metrics']): string {
  return (metrics ?? []).map((m) => `${m.label}|${m.value}`).join('\n')
}

export default function SmartGraphicEditor({ state, template, selectedItemIndex, onChange }: SmartGraphicEditorProps) {
  const itemCount = template.itemCount
  const isBusiness = template.layout === 'business-dashboard-4col'
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selectedItemIndex == null || !listRef.current) return
    const card = listRef.current.querySelector(`[data-item-index="${selectedItemIndex}"]`)
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedItemIndex])

  const update = (patch: Partial<SmartGraphicState>) => {
    onChange({ ...state, ...patch })
  }

  const updateItem = (index: number, patch: Partial<SmartGraphicItem>) => {
    const items = state.items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    update({ items })
  }

  return (
    <div className="sg-editor">
      <div className="setting-field">
        <label htmlFor="sg-title">主标题</label>
        <input
          id="sg-title"
          type="text"
          value={state.title}
          onChange={(event) => update({ title: event.target.value })}
          placeholder="图形主标题"
        />
      </div>

      {!isBusiness ? (
        <div className="setting-field">
          <label htmlFor="sg-subtitle">副标题</label>
          <input
            id="sg-subtitle"
            type="text"
            value={state.subtitle}
            onChange={(event) => update({ subtitle: event.target.value })}
            placeholder="可选副标题"
          />
        </div>
      ) : null}

      {isBusiness ? (
        <div className="sg-editor-footer-fields">
          <div className="setting-field">
            <label htmlFor="sg-footer-a">底栏左（跨前两列）</label>
            <input
              id="sg-footer-a"
              type="text"
              value={state.footerGroupA ?? ''}
              onChange={(event) => update({ footerGroupA: event.target.value })}
            />
          </div>
          <div className="setting-field">
            <label htmlFor="sg-footer-b">底栏右（跨后两列）</label>
            <input
              id="sg-footer-b"
              type="text"
              value={state.footerGroupB ?? ''}
              onChange={(event) => update({ footerGroupB: event.target.value })}
            />
          </div>
        </div>
      ) : null}

      <div className="setting-field">
        <label htmlFor="sg-color">配色方案</label>
        <div className="sg-color-grid">
          {SMART_GRAPHIC_COLOR_THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`sg-color-btn${state.colorSchemeId === theme.id ? ' active' : ''}`}
              title={theme.label}
              onClick={() => update({ colorSchemeId: theme.id })}
            >
              <span className="sg-color-swatch" style={{ background: theme.primary }} />
              <span className="sg-color-swatch" style={{ background: theme.secondary }} />
              <span className="sg-color-label">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="sg-item-list" ref={listRef}>
        <h4>{isBusiness ? `栏目内容（${itemCount} 栏）` : `内容项（${itemCount} 项）`}</h4>
        {state.items.slice(0, itemCount).map((item, index) => (
          <div
            key={index}
            className={`sg-item-card${selectedItemIndex === index ? ' sg-item-card-selected' : ''}`}
            data-item-index={index}
          >
            <div className="sg-item-card-header">第 {index + 1} {isBusiness ? '栏' : '项'}</div>
            <div className="setting-field">
              <label htmlFor={`sg-item-title-${index}`}>{isBusiness ? '栏目标题' : '标题'}</label>
              <input
                id={`sg-item-title-${index}`}
                type="text"
                value={item.title}
                onChange={(event) => updateItem(index, { title: event.target.value })}
              />
            </div>

            {isBusiness && item.columnKind === 'flow' ? (
              <div className="setting-field">
                <label htmlFor={`sg-item-flow-${index}`}>流程步骤（每行一步）</label>
                <textarea
                  id={`sg-item-flow-${index}`}
                  rows={4}
                  value={(item.flowSteps ?? []).join('\n')}
                  onChange={(event) =>
                    updateItem(index, {
                      flowSteps: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean),
                    })
                  }
                />
              </div>
            ) : null}

            {isBusiness && item.columnKind !== 'flow' ? (
              <div className="setting-field">
                <label htmlFor={`sg-item-metrics-${index}`}>指标（每行：标签|数值）</label>
                <textarea
                  id={`sg-item-metrics-${index}`}
                  rows={3}
                  placeholder="关键节点|5个"
                  value={metricsToLines(item.metrics)}
                  onChange={(event) => updateItem(index, { metrics: parseMetricsLines(event.target.value) })}
                />
              </div>
            ) : null}

            <div className="setting-field">
              <label htmlFor={`sg-item-body-${index}`}>{isBusiness ? '栏底说明' : '说明'}</label>
              <textarea
                id={`sg-item-body-${index}`}
                rows={2}
                value={item.body}
                onChange={(event) => updateItem(index, { body: event.target.value })}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
