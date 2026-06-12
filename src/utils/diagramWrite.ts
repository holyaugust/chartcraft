import type { FlowchartTemplate } from '../data/flowchartTemplates'
import type { MindmapTemplate } from '../data/mindmapTemplates'
import type { DiagramKind } from '../types/diagram'
import { requestDeepSeekPlainText } from './deepseek'

function buildSystemPrompt(
  kind: DiagramKind,
  flowchartTemplate?: FlowchartTemplate,
  mindmapTemplate?: MindmapTemplate,
): string {
  if (kind === 'flowchart') {
    const styleBlock = flowchartTemplate
      ? `\n\n必须遵循以下版式样式：\n${flowchartTemplate.aiGuide}\n优先使用 flowchart ${flowchartTemplate.direction}。`
      : ''

    return `你是流程图设计专家。根据用户需求输出 Mermaid flowchart 语法。

要求：
1. 只输出 Mermaid 代码，不要 markdown 代码块，不要解释
2. 节点 id 用英文字母，中文写在方括号/花括号/圆括号内
3. 包含开始、关键步骤、结束；需要时用菱形判断节点
4. 节点数量 5～15 个，结构清晰
5. 这是流程图（顺序/分支），不是思维导图${styleBlock}`
  }

  const mindmapBlock = mindmapTemplate
    ? `\n\n必须遵循以下思维导图结构：\n${mindmapTemplate.aiGuide}`
    : ''

  return `你是思维导图策划专家。根据用户需求输出 Mermaid mindmap 语法。

要求：
1. 只输出 Mermaid 代码，不要 markdown 代码块，不要解释
2. 第一行必须是 mindmap，根节点用 root((主题))
3. 一级分支 2～4 个（并列方案/维度），下级 2～4 层，用 2 空格缩进
4. 树形层级展开，禁止 flowchart/graph 语法，禁止箭头串联步骤
5. 叶子节点写具体要点，可含数字与关键词${mindmapBlock}`
}

function buildUserPrompt(
  kind: DiagramKind,
  prompt: string,
  sourceDocument?: string,
  flowchartTemplate?: FlowchartTemplate,
  mindmapTemplate?: MindmapTemplate,
): string {
  const parts = [`需求：${prompt.trim()}`]

  if (flowchartTemplate) {
    parts.push(
      '',
      `选定样式：${flowchartTemplate.name}（${flowchartTemplate.layoutLabel}）`,
      flowchartTemplate.aiGuide,
    )
  }

  if (mindmapTemplate) {
    parts.push(
      '',
      `选定样式：${mindmapTemplate.name}（${mindmapTemplate.layoutLabel}）`,
      mindmapTemplate.aiGuide,
    )
  }

  if (sourceDocument?.trim()) {
    const excerpt =
      sourceDocument.length > 6000
        ? `${sourceDocument.slice(0, 6000)}\n…（已截断）`
        : sourceDocument
    parts.push('', '参考材料（提炼结构，勿照搬无关段落）：', excerpt)
  }

  parts.push('', `请生成${kind === 'flowchart' ? '流程图' : '思维导图'}的 Mermaid 代码。`)
  return parts.join('\n')
}

function stripMermaidFence(raw: string): string {
  let text = raw.trim()
  const fence = text.match(/```(?:mermaid)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) return fence[1].trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:mermaid)?\s*\n?/i, '').replace(/\n?```[\s\S]*$/, '')
  }
  return text.trim()
}

function normalizeMermaidSource(
  kind: DiagramKind,
  raw: string,
  flowchartTemplate?: FlowchartTemplate,
): string {
  const source = stripMermaidFence(raw)
  if (!source) throw new Error('AI 未返回有效 Mermaid 代码')

  if (kind === 'flowchart') {
    if (/^flowchart\b/i.test(source) || /^graph\b/i.test(source)) return source
    if (/mindmap/i.test(source)) {
      throw new Error('AI 返回了思维导图格式，请重试或调整描述')
    }
    const dir = flowchartTemplate?.direction ?? 'TD'
    return `flowchart ${dir}\n${source}`
  }

  const mindmapBody = source.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '').trim()

  if (/^mindmap\b/i.test(mindmapBody)) {
    return mindmapBody
  }
  if (/^flowchart\b/i.test(mindmapBody) || /^graph\b/i.test(mindmapBody)) {
    throw new Error('AI 返回了流程图格式，思维导图请用树形层级而非箭头流程')
  }

  return `mindmap\n  root((主题))\n${mindmapBody
    .split('\n')
    .map((line) => `    ${line.trim()}`)
    .join('\n')}`
}

export async function generateDiagramMermaid(input: {
  kind: DiagramKind
  prompt: string
  sourceDocument?: string
  flowchartTemplate?: FlowchartTemplate
  mindmapTemplate?: MindmapTemplate
}): Promise<string> {
  if (!input.prompt.trim()) {
    throw new Error('请先填写生成需求')
  }

  const raw = await requestDeepSeekPlainText({
    systemPrompt: buildSystemPrompt(input.kind, input.flowchartTemplate, input.mindmapTemplate),
    userPrompt: buildUserPrompt(
      input.kind,
      input.prompt,
      input.sourceDocument,
      input.flowchartTemplate,
      input.mindmapTemplate,
    ),
    temperature: 0.35,
    maxTokens: 4096,
  })

  return normalizeMermaidSource(input.kind, raw, input.flowchartTemplate)
}
