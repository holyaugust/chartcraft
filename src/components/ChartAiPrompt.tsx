import { useCallback, useState } from 'react'
import { AlertCircle, Loader2, Sparkles } from 'lucide-react'
import type { ChartConfig, TableState } from '../types'
import { CHART_AI_EXAMPLES, runChartAiCommand } from '../utils/chartAiCommand'

interface ChartAiPromptProps {
  tableState: TableState
  chartConfig: ChartConfig
  onApply: (result: { tableState: TableState; chartConfig: ChartConfig }) => void
  disabled?: boolean
}

export default function ChartAiPrompt({
  tableState,
  chartConfig,
  onApply,
  disabled = false,
}: ChartAiPromptProps) {
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusIsError, setStatusIsError] = useState(false)

  const handleSubmit = useCallback(async () => {
    const text = prompt.trim()
    if (!text || busy || disabled) return

    setBusy(true)
    setStatusMessage('')
    setStatusIsError(false)

    try {
      const result = await runChartAiCommand({
        prompt: text,
        tableState,
        chartConfig,
      })
      onApply({ tableState: result.tableState, chartConfig: result.chartConfig })
      setPrompt('')
      setStatusIsError(false)
      setStatusMessage(result.message)
    } catch (err) {
      setStatusIsError(true)
      setStatusMessage(err instanceof Error ? err.message : 'AI 调整失败')
    } finally {
      setBusy(false)
    }
  }, [prompt, busy, disabled, tableState, chartConfig, onApply])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        void handleSubmit()
      }
    },
    [handleSubmit],
  )

  return (
    <section className="chart-ai-panel" aria-label="AI 图表调整">
      {statusMessage ? (
        <div className={`document-status-bar chart-ai-status${statusIsError ? ' error' : ' success'}`}>
          {statusIsError ? <AlertCircle size={14} /> : <Sparkles size={14} />}
          {statusMessage}
        </div>
      ) : null}

      <div className="chart-ai-bar">
        <div className="chart-ai-bar-label">
          <Sparkles size={16} />
          <span>AI 调整</span>
        </div>

        <textarea
          className="chart-ai-input"
          rows={2}
          placeholder="描述要对表格和图表做的修改，例如：改成折线图、删除 3 月、按销售额排序、换海洋蓝配色…（Ctrl+Enter 执行）"
          value={prompt}
          disabled={busy || disabled}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={handleKeyDown}
        />

        <button
          type="button"
          className="btn btn-primary chart-ai-submit"
          disabled={busy || disabled || !prompt.trim()}
          onClick={() => void handleSubmit()}
        >
          {busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
          {busy ? '处理中…' : '执行'}
        </button>
      </div>

      <div className="chart-ai-examples">
        <span className="chart-ai-examples-label">示例：</span>
        {CHART_AI_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="chart-ai-example-chip"
            disabled={busy || disabled}
            onClick={() => setPrompt(example)}
          >
            {example}
          </button>
        ))}
      </div>
    </section>
  )
}
