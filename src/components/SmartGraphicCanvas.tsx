import { forwardRef, useMemo, type CSSProperties, type ReactNode } from 'react'

import type { SmartGraphicItem, SmartGraphicState, SmartGraphicTemplate } from '../types/smartGraphic'

import { getSmartGraphicColorTheme } from '../utils/smartGraphicColorSchemes'

import type { SmartGraphicElementId } from '../utils/smartGraphicEdit'

import SmartGraphicEditableText from './SmartGraphicEditableText'



export const SMART_GRAPHIC_CANVAS_WIDTH = 960

export const SMART_GRAPHIC_CANVAS_HEIGHT = 540



interface EditContext {

  editable: boolean

  selectedElement: SmartGraphicElementId | null

  onSelectElement?: (elementId: SmartGraphicElementId | null) => void

  onElementChange?: (elementId: SmartGraphicElementId, value: string) => void

}



interface SmartGraphicCanvasProps {

  state: SmartGraphicState

  template: SmartGraphicTemplate

  editable?: boolean

  selectedElement?: SmartGraphicElementId | null

  onSelectElement?: (elementId: SmartGraphicElementId | null) => void

  onElementChange?: (elementId: SmartGraphicElementId, value: string) => void

}



function normalizeItems(state: SmartGraphicState, template: SmartGraphicTemplate): SmartGraphicItem[] {

  const items: SmartGraphicItem[] = state.items.slice(0, template.itemCount).map((item) => ({

    title: item.title,

    body: item.body,

    columnKind: item.columnKind,

    flowSteps: item.flowSteps ? [...item.flowSteps] : undefined,

    metrics: item.metrics ? item.metrics.map((m) => ({ ...m })) : undefined,

  }))

  while (items.length < template.itemCount) {

    items.push({ title: `栏目 ${items.length + 1}`, body: '说明文字' })

  }

  return items

}



function highlightNumbers(text: string): ReactNode {

  const parts = text.split(/(\d+(?:\.\d+)?(?:个|项|人|万|h|%|周|天|月|年)?)/g)

  return parts.map((part, index) =>

    /^\d/.test(part) ? (

      <strong key={index} className="sg-biz-highlight">

        {part}

      </strong>

    ) : (

      part

    ),

  )

}



function Editable({

  edit,

  elementId,

  value,

  className,

  tag,

  multiline,

}: {

  edit: EditContext

  elementId: SmartGraphicElementId

  value: string

  className?: string

  tag?: 'span' | 'h2' | 'h4' | 'p' | 'strong'

  multiline?: boolean

}) {

  return (

    <SmartGraphicEditableText

      elementId={elementId}

      value={value}

      className={className}

      tag={tag}

      multiline={multiline}

      editable={edit.editable}

      selectedElement={edit.selectedElement}

      onSelect={edit.onSelectElement}

      onChange={edit.onElementChange}

    />

  )

}



function BusinessColumnBody({ item, itemIndex, edit }: { item: SmartGraphicItem; itemIndex: number; edit: EditContext }) {

  const kind = item.columnKind ?? 'flow'



  if (kind === 'flow') {

    const steps = item.flowSteps?.length ? item.flowSteps : ['步骤一', '步骤二', '步骤三']

    return (

      <div className="sg-biz-flow">

        {steps.map((step, index) => (

          <div key={index} className="sg-biz-flow-step-wrap">

            <div className="sg-biz-flow-step">

              <Editable

                edit={edit}

                elementId={`item-${itemIndex}-flow-${index}`}

                value={step}

                tag="span"

              />

            </div>

            {index < steps.length - 1 ? <div className="sg-biz-flow-arrow" aria-hidden="true" /> : null}

          </div>

        ))}

      </div>

    )

  }



  if (kind === 'metrics-pair') {

    const metrics = item.metrics?.length ? item.metrics : [{ label: '指标', value: '—' }]

    return (

      <div className="sg-biz-metrics-pair">

        {metrics.map((metric, index) => (

          <div key={index} className="sg-biz-metric-block">

            <div className="sg-biz-metric-value">

              <Editable

                edit={edit}

                elementId={`item-${itemIndex}-metric-${index}-value`}

                value={metric.value}

                tag="span"

              />

            </div>

            <div className="sg-biz-metric-label">

              <Editable

                edit={edit}

                elementId={`item-${itemIndex}-metric-${index}-label`}

                value={metric.label}

                tag="span"

              />

            </div>

          </div>

        ))}

      </div>

    )

  }



  if (kind === 'metrics-split') {

    const metrics = item.metrics?.length

      ? item.metrics

      : [

          { label: '核心人数', value: '8人' },

          { label: '协作人数', value: '15人' },

          { label: '累计工时', value: '8600h' },

        ]

    const top = metrics.slice(0, 2)

    const bottom = metrics[2]

    return (

      <div className="sg-biz-metrics-split">

        <div className="sg-biz-split-row">

          {top.map((metric, index) => (

            <div key={index} className="sg-biz-split-cell">

              <span className="sg-biz-split-label">

                <Editable

                  edit={edit}

                  elementId={`item-${itemIndex}-metric-${index}-label`}

                  value={metric.label}

                  tag="span"

                />

              </span>

              <span className="sg-biz-split-value">

                <Editable

                  edit={edit}

                  elementId={`item-${itemIndex}-metric-${index}-value`}

                  value={metric.value}

                  tag="span"

                />

              </span>

            </div>

          ))}

        </div>

        {bottom ? (

          <div className="sg-biz-split-full">

            <span className="sg-biz-split-label">

              <Editable

                edit={edit}

                elementId={`item-${itemIndex}-metric-2-label`}

                value={bottom.label}

                tag="span"

              />

            </span>

            <span className="sg-biz-split-value sg-biz-split-value-lg">

              <Editable

                edit={edit}

                elementId={`item-${itemIndex}-metric-2-value`}

                value={bottom.value}

                tag="span"

              />

            </span>

          </div>

        ) : null}

      </div>

    )

  }



  const metrics = item.metrics?.length

    ? item.metrics

    : [

        { label: '总预算', value: '420万' },

        { label: '总投入', value: '1200万' },

      ]

  return (

    <div className="sg-biz-metrics-row">

      {metrics.map((metric, index) => (

        <div key={index} className="sg-biz-budget-row">

          <span className="sg-biz-budget-label">

            <Editable

              edit={edit}

              elementId={`item-${itemIndex}-metric-${index}-label`}

              value={metric.label}

              tag="span"

            />

          </span>

          <span className="sg-biz-budget-value">

            <Editable

              edit={edit}

              elementId={`item-${itemIndex}-metric-${index}-value`}

              value={metric.value}

              tag="span"

            />

          </span>

        </div>

      ))}

    </div>

  )

}



function LayoutBusinessDashboard({

  items,

  footerGroupA,

  footerGroupB,

  edit,

}: {

  items: SmartGraphicItem[]

  footerGroupA: string

  footerGroupB: string

  edit: EditContext

}) {

  return (

    <div className="sg-layout sg-layout-business">

      <div className="sg-biz-columns">

        {items.map((item, index) => (

          <div key={index} className="sg-biz-column">

            <div className="sg-biz-col-head">

              <Editable edit={edit} elementId={`item-${index}-title`} value={item.title} tag="span" />

            </div>

            <div className="sg-biz-col-body">

              <BusinessColumnBody item={item} itemIndex={index} edit={edit} />

            </div>

            <div className="sg-biz-col-summary">

              {edit.editable ? (

                <Editable

                  edit={edit}

                  elementId={`item-${index}-body`}

                  value={item.body}

                  tag="span"

                  multiline

                />

              ) : (

                highlightNumbers(item.body)

              )}

            </div>

          </div>

        ))}

      </div>

      <div className="sg-biz-footers">

        <div className="sg-biz-footer-bar">

          <Editable edit={edit} elementId="footer-a" value={footerGroupA || '分组一'} tag="span" />

        </div>

        <div className="sg-biz-footer-bar">

          <Editable edit={edit} elementId="footer-b" value={footerGroupB || '分组二'} tag="span" />

        </div>

      </div>

    </div>

  )

}



function Card({

  item,

  index,

  color,

  showIndex = false,

  compact = false,

  center = false,

  edit,

}: {

  item: SmartGraphicItem

  index: number

  color: string

  showIndex?: boolean

  compact?: boolean

  center?: boolean

  edit: EditContext

}) {

  return (

    <article

      className={`sg-card${compact ? ' sg-card-compact' : ''}${center ? ' sg-card-center' : ''}${edit.selectedElement === `item-${index}-title` || edit.selectedElement === `item-${index}-body` ? ' sg-card-selected' : ''}`}

      style={{ '--sg-card-color': color } as CSSProperties}

    >

      <div className="sg-card-accent" />

      {showIndex ? <div className="sg-card-index">{String(index + 1).padStart(2, '0')}</div> : <div className="sg-card-dot" />}

      <Editable edit={edit} elementId={`item-${index}-title`} value={item.title} className="sg-card-title" tag="h4" />

      <Editable

        edit={edit}

        elementId={`item-${index}-body`}

        value={item.body}

        className="sg-card-body"

        tag="p"

        multiline

      />

    </article>

  )

}



function LayoutBody({

  layout,

  items,

  palette,

  centerLabel,

  footerGroupA,

  footerGroupB,

  edit,

}: {

  layout: SmartGraphicTemplate['layout']

  items: SmartGraphicItem[]

  palette: string[]

  centerLabel: string

  footerGroupA: string

  footerGroupB: string

  edit: EditContext

}) {

  if (layout === 'business-dashboard-4col') {

    return (

      <LayoutBusinessDashboard

        items={items}

        footerGroupA={footerGroupA}

        footerGroupB={footerGroupB}

        edit={edit}

      />

    )

  }



  switch (layout) {

    case 'parallel-horizontal':

      return (

        <div className="sg-layout sg-layout-parallel-h">

          {items.map((item, index) => (

            <Card key={index} item={item} index={index} color={palette[index % palette.length]} edit={edit} />

          ))}

        </div>

      )

    case 'parallel-vertical':

      return (

        <div className="sg-layout sg-layout-parallel-v">

          {items.map((item, index) => (

            <Card key={index} item={item} index={index} color={palette[index % palette.length]} showIndex edit={edit} />

          ))}

        </div>

      )

    case 'process-horizontal':

      return (

        <div className="sg-layout sg-layout-process-h">

          {items.map((item, index) => (

            <div key={index} className="sg-process-step">

              <Card item={item} index={index} color={palette[index % palette.length]} showIndex edit={edit} />

              {index < items.length - 1 ? (

                <div className="sg-process-arrow" style={{ '--sg-arrow-color': palette[(index + 1) % palette.length] } as CSSProperties} />

              ) : null}

            </div>

          ))}

        </div>

      )

    case 'process-vertical':

      return (

        <div className="sg-layout sg-layout-process-v">

          {items.map((item, index) => (

            <div key={index} className="sg-process-v-row">

              <div className="sg-process-v-badge" style={{ background: palette[index % palette.length] }}>

                {String(index + 1).padStart(2, '0')}

              </div>

              {index < items.length - 1 ? <div className="sg-process-v-line" style={{ background: palette[index % palette.length] }} /> : null}

              <Card item={item} index={index} color={palette[index % palette.length]} edit={edit} />

            </div>

          ))}

        </div>

      )

    case 'cycle-ring':

      return (

        <div className="sg-layout sg-layout-cycle">

          <div className="sg-cycle-hub">{centerLabel.slice(0, 4)}</div>

          {items.map((item, index) => (

            <div

              key={index}

              className="sg-cycle-node"

              style={{ '--sg-node-i': index, '--sg-node-n': items.length, '--sg-node-color': palette[index % palette.length] } as CSSProperties}

            >

              <Card item={item} index={index} color={palette[index % palette.length]} compact center edit={edit} />

            </div>

          ))}

        </div>

      )

    case 'pyramid-tier':

      return (

        <div className="sg-layout sg-layout-pyramid">

          {items.map((item, index) => (

            <div

              key={index}

              className="sg-pyramid-tier"

              style={

                {

                  '--sg-tier-color': palette[index % palette.length],

                  '--sg-tier-i': index,

                  '--sg-tier-n': items.length,

                } as CSSProperties

              }

            >

              <Editable edit={edit} elementId={`item-${index}-title`} value={item.title} tag="strong" />

              <Editable edit={edit} elementId={`item-${index}-body`} value={item.body} tag="span" multiline />

            </div>

          ))}

        </div>

      )

    case 'hierarchy-radial':

      return (

        <div className="sg-layout sg-layout-hierarchy">

          <div className="sg-hierarchy-hub">{centerLabel}</div>

          {items.map((item, index) => (

            <div

              key={index}

              className="sg-hierarchy-node"

              style={{ '--sg-node-i': index, '--sg-node-n': items.length, '--sg-node-color': palette[index % palette.length] } as CSSProperties}

            >

              <Card item={item} index={index} color={palette[index % palette.length]} compact center edit={edit} />

            </div>

          ))}

        </div>

      )

    case 'timeline-horizontal':

      return (

        <div className="sg-layout sg-layout-timeline">

          <div className="sg-timeline-rail" />

          {items.map((item, index) => (

            <div

              key={index}

              className={`sg-timeline-node${index % 2 === 0 ? ' sg-timeline-top' : ' sg-timeline-bottom'}`}

              style={{ '--sg-node-i': index, '--sg-node-n': items.length, '--sg-node-color': palette[index % palette.length] } as CSSProperties}

            >

              <div className="sg-timeline-dot" />

              <Card item={item} index={index} color={palette[index % palette.length]} compact edit={edit} />

            </div>

          ))}

        </div>

      )

    default:

      return null

  }

}



const SmartGraphicCanvas = forwardRef<HTMLDivElement, SmartGraphicCanvasProps>(function SmartGraphicCanvas(

  { state, template, editable = false, selectedElement = null, onSelectElement, onElementChange },

  ref,

) {

  const theme = getSmartGraphicColorTheme(state.colorSchemeId)

  const items = useMemo(() => normalizeItems(state, template), [state, template])

  const centerLabel = state.title.trim().slice(0, 8) || '主题'

  const isBusiness = template.layout === 'business-dashboard-4col'

  const canvasHeight = template.canvasHeight ?? SMART_GRAPHIC_CANVAS_HEIGHT



  const edit: EditContext = {

    editable,

    selectedElement,

    onSelectElement,

    onElementChange,

  }



  const style = {

    '--sg-primary': isBusiness ? '#3b6eb5' : theme.primary,

    '--sg-secondary': isBusiness ? '#4a7ec4' : theme.secondary,

    '--sg-accent': theme.accent,

    '--sg-text': theme.text,

    '--sg-muted': theme.muted,

    '--sg-bg': isBusiness ? '#eef3fa' : theme.background,

    '--sg-primary-08': `${isBusiness ? '#3b6eb5' : theme.primary}14`,

    '--sg-primary-12': `${isBusiness ? '#3b6eb5' : theme.primary}1f`,

    '--sg-primary-35': `${isBusiness ? '#3b6eb5' : theme.primary}59`,

    '--sg-accent-12': `${theme.accent}1f`,

    ...(isBusiness ? {} : { height: `${canvasHeight}px` }),

  } as CSSProperties



  return (

    <div

      ref={ref}

      className={`sg-canvas${isBusiness ? ' sg-canvas-business' : ''}${editable ? ' sg-canvas-editable' : ''}`}

      style={style}

      data-layout={template.layout}

      aria-label={`智能图形：${state.title}`}

      onClick={() => {

        if (editable) onSelectElement?.(null)

      }}

    >

      {!isBusiness ? <div className="sg-canvas-bg" aria-hidden="true" /> : null}

      {isBusiness ? (

        <div className="sg-biz-banner">

          <Editable edit={edit} elementId="title" value={state.title} className="sg-biz-banner-title" tag="h2" />

        </div>

      ) : (

        <header className="sg-canvas-header">

          <Editable edit={edit} elementId="title" value={state.title} className="sg-canvas-title" tag="h2" />

          {state.subtitle || editable ? (

            <Editable

              edit={edit}

              elementId="subtitle"

              value={state.subtitle}

              className="sg-canvas-subtitle"

              tag="p"

              multiline

            />

          ) : null}

        </header>

      )}

      <LayoutBody

        layout={template.layout}

        items={items}

        palette={theme.palette}

        centerLabel={centerLabel}

        footerGroupA={state.footerGroupA ?? ''}

        footerGroupB={state.footerGroupB ?? ''}

        edit={edit}

      />

    </div>

  )

})



export default SmartGraphicCanvas



export function getSmartGraphicCanvasHeight(template: SmartGraphicTemplate): number {

  if (template.layout === 'business-dashboard-4col') {

    return template.canvasHeight ?? 520

  }

  return template.canvasHeight ?? SMART_GRAPHIC_CANVAS_HEIGHT

}


