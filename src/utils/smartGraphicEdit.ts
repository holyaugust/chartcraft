import type { SmartGraphicItem, SmartGraphicState } from '../types/smartGraphic'

export type SmartGraphicElementId =
  | 'title'
  | 'subtitle'
  | 'footer-a'
  | 'footer-b'
  | `item-${number}-title`
  | `item-${number}-body`
  | `item-${number}-flow-${number}`
  | `item-${number}-metric-${number}-label`
  | `item-${number}-metric-${number}-value`

export function parseSmartGraphicElementId(id: SmartGraphicElementId): {
  kind: 'title' | 'subtitle' | 'footer-a' | 'footer-b' | 'item-title' | 'item-body' | 'flow-step' | 'metric-label' | 'metric-value'
  itemIndex?: number
  stepIndex?: number
  metricIndex?: number
} | null {
  if (id === 'title') return { kind: 'title' }
  if (id === 'subtitle') return { kind: 'subtitle' }
  if (id === 'footer-a') return { kind: 'footer-a' }
  if (id === 'footer-b') return { kind: 'footer-b' }

  const itemTitle = id.match(/^item-(\d+)-title$/)
  if (itemTitle) return { kind: 'item-title', itemIndex: Number(itemTitle[1]) }

  const itemBody = id.match(/^item-(\d+)-body$/)
  if (itemBody) return { kind: 'item-body', itemIndex: Number(itemBody[1]) }

  const flow = id.match(/^item-(\d+)-flow-(\d+)$/)
  if (flow) return { kind: 'flow-step', itemIndex: Number(flow[1]), stepIndex: Number(flow[2]) }

  const metricLabel = id.match(/^item-(\d+)-metric-(\d+)-label$/)
  if (metricLabel) {
    return { kind: 'metric-label', itemIndex: Number(metricLabel[1]), metricIndex: Number(metricLabel[2]) }
  }

  const metricValue = id.match(/^item-(\d+)-metric-(\d+)-value$/)
  if (metricValue) {
    return { kind: 'metric-value', itemIndex: Number(metricValue[1]), metricIndex: Number(metricValue[2]) }
  }

  return null
}

export function getItemIndexFromElementId(id: SmartGraphicElementId | null): number | null {
  if (!id) return null
  const parsed = parseSmartGraphicElementId(id)
  return parsed?.itemIndex ?? null
}

function updateItemAt(state: SmartGraphicState, index: number, patch: Partial<SmartGraphicItem>): SmartGraphicState {
  const items = state.items.map((item, i) => (i === index ? { ...item, ...patch } : item))
  return { ...state, items }
}

export function applySmartGraphicElementEdit(
  state: SmartGraphicState,
  elementId: SmartGraphicElementId,
  value: string,
): SmartGraphicState {
  const parsed = parseSmartGraphicElementId(elementId)
  if (!parsed) return state

  switch (parsed.kind) {
    case 'title':
      return { ...state, title: value }
    case 'subtitle':
      return { ...state, subtitle: value }
    case 'footer-a':
      return { ...state, footerGroupA: value }
    case 'footer-b':
      return { ...state, footerGroupB: value }
    case 'item-title':
      return updateItemAt(state, parsed.itemIndex!, { title: value })
    case 'item-body':
      return updateItemAt(state, parsed.itemIndex!, { body: value })
    case 'flow-step': {
      const item = state.items[parsed.itemIndex!]
      const steps = [...(item.flowSteps ?? [])]
      while (steps.length <= parsed.stepIndex!) steps.push('')
      steps[parsed.stepIndex!] = value
      return updateItemAt(state, parsed.itemIndex!, { flowSteps: steps })
    }
    case 'metric-label':
    case 'metric-value': {
      const item = state.items[parsed.itemIndex!]
      const metrics = (item.metrics ?? []).map((metric) => ({ ...metric }))
      while (metrics.length <= parsed.metricIndex!) {
        metrics.push({ label: '指标', value: '—' })
      }
      metrics[parsed.metricIndex!] = {
        ...metrics[parsed.metricIndex!],
        [parsed.kind === 'metric-label' ? 'label' : 'value']: value,
      }
      return updateItemAt(state, parsed.itemIndex!, { metrics })
    }
    default:
      return state
  }
}
