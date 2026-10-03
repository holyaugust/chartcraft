import { getDeepSeekFastModel, requestDeepSeekPlainText } from './deepseek'
import type { TextHighlightRange } from './documentLocate'

export interface DocumentLocalRefineSelection {
  start: number
  end: number
  text: string
}

export interface DocumentLocalRefineInput {
  content: string
  instruction: string
  selection?: DocumentLocalRefineSelection | null
}

export interface DocumentLocalRefineResult {
  content: string
  changedRange: TextHighlightRange
  mode: 'selection' | 'document' | 'answer'
  /** 问答模式返回的说明，不改正文 */
  answer?: string
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/)
  return fenced ? fenced[1].trim() : trimmed
}

function buildContextSnippet(content: string, start: number, end: number, radius = 800): string {
  const before = content.slice(Math.max(0, start - radius), start)
  const after = content.slice(end, Math.min(content.length, end + radius))
  return `${before}【待改片段】${after}`
}

function looksLikeExpand(instruction: string): boolean {
  return /扩写|详细|补充|加长|充实|展开|重写|改写|写完整|补全|续写|写完|完整/.test(instruction)
}

/** 用户在问内容/逻辑问题，或要求提炼/分析结构，而不是下改写指令 */
export function isConsultativePrompt(instruction: string): boolean {
  const text = instruction.trim()
  if (!text) return false

  // 结构提炼 / 大纲归纳：只作答，不改正文
  if (
    /(提炼|梳理|归纳|总结|概括|理清|拆解).{0,12}(结构|大纲|提纲|框架|逻辑|层次|章节)/u.test(text) ||
    /(结构|大纲|提纲|框架|逻辑链|章节).{0,12}(提炼|梳理|归纳|总结|概括|是什么|怎样|如何|有哪些)/u.test(
      text,
    ) ||
    /(整篇|全文|这篇(文档|文章|报告)|整篇文档).{0,24}(结构|大纲|提纲|框架)/u.test(text)
  ) {
    return true
  }

  // 明确改写指令优先按优化处理
  if (
    /^(请)?(把|将)?(.{0,12})?(改成|改得|改写|扩写|压缩|删|补充|润色|优化|重写|写完整|写得更)/u.test(
      text,
    ) ||
    /更正式|更简洁|扩写详细|语气稳妥|落地措施|再详细点/.test(text)
  ) {
    return false
  }

  if (/[？?]$/u.test(text)) return true
  if (
    /(什么|为什么|怎么|如何|是否|有何|有没有|哪|吗|么关联|什么关系|是不是|能否|可否|怎样|为何|什么意思|逻辑|关联|分析一下|总结一下|梳理一下)/u.test(
      text,
    )
  ) {
    return true
  }
  return false
}

/** 局部优化专用请求：关思考 + 截断自动续写 */
async function requestRefineCompletion(options: {
  systemPrompt: string
  userPrompt: string
  maxTokens?: number
}): Promise<string> {
  return requestDeepSeekPlainText({
    systemPrompt: options.systemPrompt,
    userPrompt: options.userPrompt,
    temperature: 0.35,
    // 思考关闭后，这些额度几乎都给正文
    maxTokens: options.maxTokens ?? 4096,
    model: getDeepSeekFastModel(),
    thinking: 'disabled',
    continueOnLength: true,
    maxContinuations: 3,
  })
}

async function refineSelectedFragment(input: DocumentLocalRefineInput & {
  selection: DocumentLocalRefineSelection
}): Promise<DocumentLocalRefineResult> {
  const { content, instruction, selection } = input
  const expand = looksLikeExpand(instruction)
  const systemPrompt = `你是中文公文与职场文书润色专家。用户选中了正文中的一段文字，请按指令改写该片段。
规则：
1. 只输出改写后的片段正文，不要标题、不要解释、不要 markdown 代码块（不要 **加粗**）
2. 保持与上下文语气、人称、文种一致；层次序号风格与原文一致
3. 未知事实、数据、人名、日期用×××占位，不要编造
4. 不要擅自改动未选中部分；输出中不要夹带「前后文」
5. 若要求「写完整 / 补全 / 续写」：在保留原意基础上把半截句子与段落写完，并以句号等收束
6. 输出必须完整收束，严禁停在半字、半句处
7. 除非用户要求扩写或写完整，否则篇幅与原文接近即可`

  const raw = await requestRefineCompletion({
    systemPrompt,
    userPrompt: `修改要求：
"""
${instruction.trim()}
"""

选中片段（可能本身不完整，请按要求处理）：
"""
${selection.text}
"""

前后文（仅供连贯参考，勿输出）：
"""
${buildContextSnippet(content, selection.start, selection.end)}
"""

请完整输出改写后的选中片段（务必写完并收束）：`,
    maxTokens: expand ? 6144 : 4096,
  })

  const replacement = stripCodeFence(raw)
  if (!replacement) {
    throw new Error('AI 未返回有效改写内容，请重试')
  }

  const next =
    content.slice(0, selection.start) + replacement + content.slice(selection.end)

  return {
    content: next,
    changedRange: { start: selection.start, end: selection.start + replacement.length },
    mode: 'selection',
  }
}

function applyOriginalReplacement(
  content: string,
  original: string,
  replacement: string,
): DocumentLocalRefineResult | null {
  const index = content.indexOf(original)
  if (index < 0) return null
  const next = content.slice(0, index) + replacement + content.slice(index + original.length)
  return {
    content: next,
    changedRange: { start: index, end: index + replacement.length },
    mode: 'document',
  }
}

function parsePatchJson(raw: string): { original: string; replacement: string } | null {
  const jsonMatch = stripCodeFence(raw).match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0]) as { original?: string; replacement?: string }
    const original = parsed.original?.trim() ?? ''
    const replacement = parsed.replacement?.trim() ?? ''
    if (!original || !replacement) return null
    return { original, replacement }
  } catch {
    const original = raw.match(/"original"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1]
    const replacement = raw.match(/"replacement"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1]
    if (!original || !replacement) return null
    try {
      return {
        original: JSON.parse(`"${original}"`) as string,
        replacement: JSON.parse(`"${replacement}"`) as string,
      }
    } catch {
      return null
    }
  }
}

/** 无选区时：只让模型返回「原文片段→改写」补丁，避免整篇重写 */
async function refineByPatch(input: DocumentLocalRefineInput): Promise<DocumentLocalRefineResult> {
  const { content, instruction } = input
  const expand = looksLikeExpand(instruction)
  const systemPrompt = `你是中文公文与职场文书润色专家。用户要对全文做局部调整。
只输出一个 JSON 对象（不要 markdown）：
{"original":"原文中将被替换的连续片段","replacement":"按要求改写后的完整片段"}
规则：
1. original 必须是原文中真实存在的连续子串；优先选与修改要求直接相关的一到数段，不要整篇原文
2. replacement 必须写完整并收束；若要求写完整/补全，把半截内容补完
3. 未知信息用×××；不要编造事实
4. 除 JSON 外不要输出任何说明`

  const clipped =
    content.length > 12000
      ? `${content.slice(0, 9000)}\n\n……（中间省略）……\n\n${content.slice(-2500)}`
      : content

  const raw = await requestRefineCompletion({
    systemPrompt,
    userPrompt: `修改要求：
"""
${instruction.trim()}
"""

原文：
"""
${clipped}
"""

请输出完整 JSON（replacement 必须写完）：`,
    maxTokens: expand ? 8192 : 6144,
  })

  const patch = parsePatchJson(raw)
  if (!patch) {
    throw new Error('未能定位要修改的片段，请先在正文中选中再优化')
  }

  const applied = applyOriginalReplacement(content, patch.original, patch.replacement)
  if (!applied) {
    throw new Error('找不到对应原文片段，请先在正文中选中要改的内容')
  }

  return applied
}

async function answerDocumentQuestion(
  input: DocumentLocalRefineInput,
): Promise<DocumentLocalRefineResult> {
  const { content, instruction, selection } = input
  const hasSelection = Boolean(selection && selection.end > selection.start && selection.text.trim())

  const wantsStructure =
    /(结构|大纲|提纲|框架|章节|逻辑链)/u.test(instruction) &&
    /(提炼|梳理|归纳|总结|概括|理清|拆解|是什么|怎样|如何|有哪些|整篇|全文|这篇)/u.test(
      instruction,
    )

  const systemPrompt = wantsStructure
    ? `你是中文公文与职场文书结构顾问。用户要求提炼/梳理全文结构，不是要求改写正文。
规则：
1. 直接给出清晰大纲：按「一级标题 / 二级要点」列出当前篇章结构
2. 用 3～6 条说明论证/叙述逻辑链条（先后关系、因果关系）
3. 指出 2～4 处结构缺口或可调整处
4. 不要输出改写后的整段正文，不要 markdown 代码块，不要前言套话`
    : `你是中文公文与职场文书写作顾问。用户在针对正文提问（内容理解、逻辑关联、结构安排等），不是要求立刻改写全文。
规则：
1. 直接回答问题，说明白「是什么关系 / 为什么这样写 / 缺什么」
2. 结合用户给出的选中片段与上下文作答；原文未写清处如实指出，不要编造事实
3. 末尾用 2～4 条简洁「改写建议」，告诉用户若要优化正文可以怎么改
4. 不要输出整段改写后的正文，不要 markdown 代码块，不要前言套话`

  const focusBlock = hasSelection
    ? `用户关注的选中片段：
"""
${selection!.text}
"""

前后文：
"""
${buildContextSnippet(content, selection!.start, selection!.end)}
"""`
    : `全文（可能截断）：
"""
${
  content.length > 10000
    ? `${content.slice(0, 7500)}\n\n……（中间省略）……\n\n${content.slice(-2000)}`
    : content
}
"""`

  const raw = await requestRefineCompletion({
    systemPrompt,
    userPrompt: `用户问题：
"""
${instruction.trim()}
"""

${focusBlock}

请作答：`,
    maxTokens: wantsStructure ? 3072 : 2048,
  })

  const answer = stripCodeFence(raw)
  if (!answer) {
    throw new Error('未能生成回答，请换个问法或先选中相关段落再试')
  }

  return {
    content,
    changedRange: hasSelection
      ? { start: selection!.start, end: selection!.end }
      : { start: 0, end: 0 },
    mode: 'answer',
    answer,
  }
}

/** 按提示词对选中片段或全文局部优化；若输入是提问则只作答、不改正文 */
export async function refineDocumentLocally(
  input: DocumentLocalRefineInput,
): Promise<DocumentLocalRefineResult> {
  const instruction = input.instruction.trim()
  if (!instruction) {
    throw new Error('请先填写调整要求')
  }
  if (!input.content.trim()) {
    throw new Error('正文为空，无法优化')
  }

  if (isConsultativePrompt(instruction)) {
    return answerDocumentQuestion(input)
  }

  const selection = input.selection
  if (selection && selection.end > selection.start && selection.text.trim()) {
    return refineSelectedFragment({ ...input, selection })
  }

  return refineByPatch(input)
}

export const DOCUMENT_LOCAL_REFINE_EXAMPLES = [
  { id: 'formal', label: '更正式', prompt: '这段改得更正式、专业，用语规范，避免口语化' },
  { id: 'concise', label: '更简洁', prompt: '在不丢失关键信息的前提下压缩篇幅，表达更简洁有力' },
  { id: 'expand', label: '扩写详细', prompt: '在原有结构上扩写得更充分，补充论证与可执行要点；未知信息用×××' },
  { id: 'complete', label: '写完整', prompt: '把这段话写完整，补全半截句子并自然收束' },
  { id: 'soften', label: '语气稳妥', prompt: '语气更稳妥委婉，适合对上汇报或对外沟通，避免绝对化表述' },
] as const
