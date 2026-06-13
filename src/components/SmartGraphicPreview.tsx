import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'

import type { SmartGraphicState, SmartGraphicTemplate } from '../types/smartGraphic'

import type { SmartGraphicElementId } from '../utils/smartGraphicEdit'

import SmartGraphicCanvas, { getSmartGraphicCanvasHeight, SMART_GRAPHIC_CANVAS_WIDTH } from './SmartGraphicCanvas'



interface SmartGraphicPreviewProps {

  state: SmartGraphicState

  template: SmartGraphicTemplate

  editable?: boolean

  selectedElement?: SmartGraphicElementId | null

  onSelectElement?: (elementId: SmartGraphicElementId | null) => void

  onElementChange?: (elementId: SmartGraphicElementId, value: string) => void

}



const SmartGraphicPreview = forwardRef<HTMLDivElement, SmartGraphicPreviewProps>(function SmartGraphicPreview(

  { state, template, editable = true, selectedElement, onSelectElement, onElementChange },

  ref,

) {

  const shellRef = useRef<HTMLDivElement>(null)

  const canvasRef = useRef<HTMLDivElement>(null)

  const fallbackHeight = getSmartGraphicCanvasHeight(template)

  const [displayHeight, setDisplayHeight] = useState(fallbackHeight)

  const [previewScale, setPreviewScale] = useState(1)



  const mergeCanvasRef = useCallback(

    (node: HTMLDivElement | null) => {

      canvasRef.current = node

      if (typeof ref === 'function') ref(node)

      else if (ref) ref.current = node

    },

    [ref],

  )



  useEffect(() => {

    const shell = shellRef.current

    if (!shell) return



    const updateScale = () => {

      const width = shell.clientWidth - 32

      setPreviewScale(Math.min(1, width / SMART_GRAPHIC_CANVAS_WIDTH))

    }



    updateScale()

    const observer = new ResizeObserver(updateScale)

    observer.observe(shell)

    return () => observer.disconnect()

  }, [])



  useEffect(() => {

    const canvas = canvasRef.current

    if (!canvas) return



    const updateHeight = () => {

      setDisplayHeight(canvas.offsetHeight || fallbackHeight)

    }



    updateHeight()

    const observer = new ResizeObserver(updateHeight)

    observer.observe(canvas)

    return () => observer.disconnect()

  }, [fallbackHeight, state, template.layout])



  return (

    <div ref={shellRef} className={`sg-preview-shell${editable ? ' sg-preview-editable' : ''}`}>

      <div className="sg-preview-scaler" style={{ height: displayHeight * previewScale }}>

        <div

          className="sg-preview-scale-wrap"

          style={{

            transform: `scale(${previewScale})`,

            width: SMART_GRAPHIC_CANVAS_WIDTH,

            height: displayHeight,

          }}

        >

          <SmartGraphicCanvas

            ref={mergeCanvasRef}

            state={state}

            template={template}

            editable={editable}

            selectedElement={selectedElement}

            onSelectElement={onSelectElement}

            onElementChange={onElementChange}

          />

        </div>

      </div>

    </div>

  )

})



export default SmartGraphicPreview

