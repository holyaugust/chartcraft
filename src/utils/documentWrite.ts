import { DOCUMENT_FORMAT_SPEC, WORKPLACE_FORMAT_SPEC, getDocumentTemplateById } from '../data/documentTemplates'
import { GBT9704_EXPORT_SPEC_NOTE } from '../data/gbt9704ExportSpec'
import {
  DOCUMENT_WRITE_TYPES,
  resolveWriteTypeSelection,
  type DocumentWriteTypeSelection,
} from '../data/documentWriteTypes'
import { getDeepSeekWriteModel, requestDeepSeekPlainText } from './deepseek'
import { normalizeDocumentStructure } from './documentFormatNormalize'

export type DocumentWriteMode = 'outline' | 'full'

export interface DocumentWriteRequest {
  prompt: string
  title?: string
  requirements?: string
  typeSelection: DocumentWriteTypeSelection
  referenceTexts?: string[]
  imitationTexts?: string[]
  mode: DocumentWriteMode
}

export interface DocumentWriteResult {
  content: string
  templateId?: string
  mode: DocumentWriteMode
}

export const DEFAULT_WRITE_PROMPT = '为特发服务写一篇国资重组整合的行研报告'

export interface ExpandedWritePrompt {
  prompt: string
  typeId: string
  subtypeId: string | null
  intentLabel: string
  summary: string
}

const EXPAND_PROMPT_SYSTEM = `你是中文写作提示词专家。用户只会给出一句简短意图，你要识别体裁与场景，扩写成一套完整、专业、可直接用于生成文章的提示词。
只输出 JSON：
{"intentLabel":"体裁名称","summary":"一句话说明识别结果","typeId":"general","subtypeId":"gen-research","prompt":"完整提示词"}
规则：
1. prompt 须包含：写作任务、标题建议（用【标题是【…】】或「标题是【…】」）、结构章节、文风/读者/篇幅、占位约定（未知信息用×××）
2. typeId/subtypeId 只能从下列选择：
- general: gen-free, gen-research, gen-article, gen-news, gen-speech, gen-proposal, gen-email, gen-copy
- workplace: wp-notice-work, wp-notice-holiday, wp-request-work, wp-report-work, wp-explain, wp-summary-week, wp-summary-month, wp-plan-month, wp-meeting-notice, wp-meeting-minutes, wp-invite, wp-rule-admin
- enterprise: ent-fangan, ent-diaoyan-baogao, ent-kexing-baogao, ent-gongzuo-huibao, ent-qingkuang-shuoming
- tongzhi: tongzhi-work；qingshi: qingshi-project；baogao: baogao-work；jiyao: jiyao-zongjingli
不确定时用 typeId=general、subtypeId=gen-free
3. 不要输出 markdown 或额外说明`

function resolveExpandedTypeSelection(
  typeId: string | undefined,
  subtypeId: string | null | undefined,
  fallback: ExpandedWritePrompt,
): Pick<ExpandedWritePrompt, 'typeId' | 'subtypeId'> {
  const type = DOCUMENT_WRITE_TYPES.find((item) => item.id === typeId)
  if (!type) {
    return { typeId: fallback.typeId, subtypeId: fallback.subtypeId }
  }
  if (subtypeId && type.subtypes?.some((sub) => sub.id === subtypeId)) {
    return { typeId: type.id, subtypeId }
  }
  return { typeId: type.id, subtypeId: type.subtypes?.[0]?.id ?? null }
}

function buildLocalExpandedPrompt(intent: string): ExpandedWritePrompt {
  const text = intent.trim()
  const lower = text

  if (/行研|行业研究|研究报告|调研报告/.test(lower)) {
    return {
      intentLabel: '行业研究报告',
      summary: '识别为研究报告，已补齐背景、格局、路径与建议等专业结构',
      typeId: 'general',
      subtypeId: 'gen-research',
      prompt: `请写一篇行业研究报告，标题是【${text.replace(/^请?(帮我)?(写|生成)/, '').trim() || '专题研究报告'}】，要求是【含行业背景与政策环境、重组整合趋势、典型路径与案例、竞争格局、对公司的启示与可落地建议；专业客观，未知数据用×××占位；约3000字，分节清晰】。`,
    }
  }

  if (/演讲|讲话|致辞|发言/.test(lower)) {
    return {
      intentLabel: '演讲稿',
      summary: '识别为演讲稿，已补齐开场、部署与收束结构',
      typeId: 'general',
      subtypeId: 'gen-speech',
      prompt: `请写一篇演讲稿，标题是【${text}】，要求是【开场点题、肯定成绩、部署任务、提出希望；口语化可朗读；约1500字；具体人名地名可用×××】。`,
    }
  }

  if (/通知/.test(lower)) {
    return {
      intentLabel: '工作通知',
      summary: '识别为通知类公文，已补齐事项、要求与时限要素',
      typeId: 'workplace',
      subtypeId: 'wp-notice-work',
      prompt: `请帮我写一份公文，标题是【${/关于/.test(text) ? text : `关于${text.replace(/通知/g, '')}的通知`}】，要求是【含工作背景、总体要求、具体安排、时间节点、责任分工、联系人；语气正式简洁；符合职场通知格式】。`,
    }
  }

  if (/汇报|述职/.test(lower)) {
    return {
      intentLabel: '工作汇报',
      summary: '识别为工作汇报，已补齐成效、问题与计划结构',
      typeId: 'workplace',
      subtypeId: 'wp-report-work',
      prompt: `请帮我写一份公文，标题是【${text}】，要求是【含工作完成情况、主要成效、存在问题、下一步计划；数据与事例可留×××占位；条理分明】。`,
    }
  }

  if (/纪要|会议/.test(lower) && /纪要|会议/.test(lower)) {
    return {
      intentLabel: '会议纪要',
      summary: '识别为会议纪要，已补齐要素与议定事项结构',
      typeId: 'workplace',
      subtypeId: 'wp-meeting-minutes',
      prompt: `请帮我写一份公文，标题是【${text}】，要求是【含会议时间地点、主持人、参会人员、议题讨论要点、议定事项与责任分工；条目清晰客观】。`,
    }
  }

  if (/方案|计划|实施/.test(lower)) {
    return {
      intentLabel: '行动/实施方案',
      summary: '识别为方案类文书，已补齐目标、任务与保障措施',
      typeId: 'enterprise',
      subtypeId: 'ent-fangan',
      prompt: `请帮我写一份公文，标题是【${text}】，要求是【分背景意义、总体目标、重点任务、保障措施；重点任务用一、（一）、1. 分层；语言务实可执行；未知信息用×××】。`,
    }
  }

  return {
    intentLabel: '通用文稿',
    summary: '未匹配到明确体裁，已按通用专业写作扩写提示词',
    typeId: 'general',
    subtypeId: 'gen-free',
    prompt: `请根据以下意图撰写完整文稿：${text}
标题是【请据意图拟定专业标题】，要求是【自动选择最合适体裁与结构；逻辑完整、表述专业；分节清晰；未知事实、数据、人名、日期用×××占位；勿无故套用红头公文格式】。`,
  }
}

/** 根据一句简短意图，扩写为完整专业提示词（优先 AI，失败则本地规则） */
export async function expandWritePromptFromIntent(intent: string): Promise<ExpandedWritePrompt> {
  const trimmed = intent.trim()
  if (!trimmed) {
    throw new Error('请先写一句写作意图')
  }

  const local = buildLocalExpandedPrompt(trimmed)

  try {
    const raw = await requestDeepSeekPlainText({
      systemPrompt: EXPAND_PROMPT_SYSTEM,
      userPrompt: `用户简短意图：\n"""\n${trimmed}\n"""\n\n请输出完整专业提示词 JSON。`,
      temperature: 0.35,
      maxTokens: 2048,
    })

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return local

    const parsed = JSON.parse(jsonMatch[0]) as {
      intentLabel?: string
      summary?: string
      typeId?: string
      subtypeId?: string | null
      prompt?: string
    }

    const prompt = parsed.prompt?.trim()
    if (!prompt) return local

    const selection = resolveExpandedTypeSelection(parsed.typeId, parsed.subtypeId, local)

    return {
      prompt,
      typeId: selection.typeId,
      subtypeId: selection.subtypeId,
      intentLabel: parsed.intentLabel?.trim() || local.intentLabel,
      summary: parsed.summary?.trim() || local.summary,
    }
  } catch {
    return local
  }
}

type WritePromptStyle = 'gbt' | 'workplace' | 'general'

function resolveWritePromptStyle(request: DocumentWriteRequest): WritePromptStyle {
  const typeId = request.typeSelection.typeId
  if (typeId === 'auto' || typeId === 'general') return 'general'
  if (typeId === 'workplace') return 'workplace'

  const templateId = resolveEffectiveTemplateId(request)
  const template = templateId ? getDocumentTemplateById(templateId) : undefined
  if (template?.gbtFormatted) return 'gbt'
  if (typeId === 'enterprise') return 'workplace'
  return 'gbt'
}

export function parseWritePromptFields(prompt: string): { title: string; requirements: string } {
  const titleMatch = prompt.match(/标题是[【\[]([^】\]]+)[】\]]/)
  const reqMatch = prompt.match(/要求是[【\[]([^】\]]+)[】\]]/)
  return {
    title: titleMatch?.[1]?.trim() ?? '',
    requirements: reqMatch?.[1]?.trim() ?? '',
  }
}

function resolveEffectiveTemplateId(request: DocumentWriteRequest): string | undefined {
  return resolveWriteTypeSelection(request.typeSelection).templateId
}

function buildWorkplaceSystemPrompt(mode: DocumentWriteMode): string {
  const modeHint =
    mode === 'outline'
      ? '本次只输出文书大纲（章节标题与要点提示），不要写完整正文。'
      : '本次输出完整职场文书正文，可直接用于编辑定稿。'

  return `你是职场公文写作专家，熟悉企事业单位日常办公文书写作规范。
${modeHint}

写作要求：
1. 语言规范、表述准确、逻辑清晰，符合职场办公场景
2. 结构层次：一级「一、」、二级「（一）」、三级「1.」、四级「（1）」；层次标题单独成行
3. 标题用【标题：……】标注；主送机关单独一行后加全角冒号，顶格
4. 未定信息用「×××」占位；段落首行缩进由排版引擎处理
5. 通知类结语用「特此通知」；请示用「以上请示，妥否，请批示」；汇报用「以上汇报，请审阅」
6. 落款：单位名称与日期分行，署名在上、日期在下
7. 只输出正文，不要 markdown、不要代码块、不要额外解释

排版规范：${WORKPLACE_FORMAT_SPEC}`
}

function buildGbtSystemPrompt(mode: DocumentWriteMode): string {
  const modeHint =
    mode === 'outline'
      ? '本次只输出公文大纲（章节标题与要点提示），不要写完整正文。'
      : '本次输出完整公文正文，可直接用于编辑定稿。'

  return `你是党政机关公文写作专家，熟悉 GB/T 9704 党政机关公文格式规范。
${modeHint}

写作要求：
1. 使用规范公文用语，文风严谨、表述准确、逻辑清晰
2. 结构层次：一级「一、」、二级「（一）」、三级「1.」、四级「（1）」；层次标题单独成行，标题后的说明文字另起一段，勿与标题写在同一行
3. 上行/平行/企业事务文书用非红头格式（【文种：…·非红头】）；下行/决议/命令等用红头格式（含【红头】【文号】【秘级】）；公告/通告/公报用公布格式
4. 标题用【标题：……】标注；主送机关单独一行后加全角冒号，顶格
5. 未定信息用「×××」占位；段落首行缩进由排版引擎处理，正文不要手动加空格
6. 结语规范：请示用「以上请示，请批示」；报告用「特此报告」；批复用「此复」；通知/通报用「特此通知/通报」
7. 附件说明：「附件：」单独一行，各附件标题另起一行，格式为「1. 标题」「2. 标题」，序号与「附件」二字对齐，勿写在冒号后
8. 落款规范（GB/T 9704）：结语/附件之后空一行；发文机关署名单独一行（用单位全称，如「××有限公司」）；成文日期单独一行（阿拉伯数字，如「2025年×月×日」）；署名在上、日期在下；右对齐由排版引擎处理，勿手动加空格；有附件时附件说明在落款之前
9. 只输出公文正文，不要 markdown、不要代码块、不要额外解释

排版规范：${DOCUMENT_FORMAT_SPEC}
${GBT9704_EXPORT_SPEC_NOTE}`
}

function buildGeneralSystemPrompt(mode: DocumentWriteMode): string {
  const modeHint =
    mode === 'outline'
      ? '本次只输出大纲（标题与各节要点），不要写完整正文。'
      : '本次输出完整成稿，可直接用于编辑润色。'

  return `你是全能中文写作助手，能撰写各类文章与文书，不局限于公文。
${modeHint}

写作要求：
1. 先根据用户需求判断最合适的体裁与结构（可为研究报告、新闻稿、演讲稿、方案、评论、说明文、商务邮件、公文等）
2. 文风、语气、篇幅与目标读者匹配；用户未指定时默认专业、清晰、可读
3. 结构清楚：可用小标题、分点或自然段；若用户明确要求公文体例，再按公文规范（层次序号、主送、落款等）
4. 未知事实、数据、人名、日期用「×××」占位，勿编造精确数据冒充真实
5. 只输出正文，不要 markdown 代码块、不要前言后记式解释

注意：不要默认套用红头公文格式；仅当用户明确要求通知/请示/函等公文时再使用公文体例。`
}

function buildSystemPrompt(mode: DocumentWriteMode, style: WritePromptStyle): string {
  if (style === 'general') return buildGeneralSystemPrompt(mode)
  if (style === 'workplace') return buildWorkplaceSystemPrompt(mode)
  return buildGbtSystemPrompt(mode)
}

function buildUserPrompt(request: DocumentWriteRequest, style: WritePromptStyle): string {
  const parsed = parseWritePromptFields(request.prompt)
  const title = request.title?.trim() || parsed.title || '（请根据提示拟定标题）'
  const defaultRequirements =
    style === 'general'
      ? '结构清晰、逻辑完整、语言专业可读；按主题选择合适文体，勿无故套用公文格式'
      : '文风严谨，语言简洁凝练，符合职场公文规范'
  const requirements = request.requirements?.trim() || parsed.requirements || defaultRequirements

  const resolved = resolveWriteTypeSelection(request.typeSelection)
  const effectiveTemplateId = resolveEffectiveTemplateId(request)
  const template = effectiveTemplateId ? getDocumentTemplateById(effectiveTemplateId) : undefined

  const sections: string[] = [
    `写作需求：${request.prompt.trim()}`,
    '',
    style === 'general' ? `文章标题：${title}` : `公文标题：${title}`,
    `写作要求：${requirements}`,
    style === 'general' ? `写作类型：${resolved.label}` : `公文类型：${resolved.label}`,
  ]

  if (style === 'general' && request.typeSelection.typeId === 'auto') {
    sections.push(
      '说明：请自动识别最合适的体裁与结构；除非需求明显是公文，否则不要使用红头、主送机关等公文格式。',
    )
  }

  if (template) {
    sections.push(`参照模板：${template.name}（${template.id}）`)
  }

  if (resolved.subtype?.sceneHint) {
    sections.push(`场景说明：${resolved.subtype.sceneHint}`)
  }

  if (template) {
    sections.push(
      '',
      '请参照以下模板骨架的结构与语气（可据实际题目调整章节，勿照搬占位内容）：',
      '---',
      template.content,
      '---',
    )
  }

  if (request.referenceTexts?.length) {
    sections.push('', '参考材料（可引用事实与表述，勿照搬无关内容）：')
    request.referenceTexts.forEach((text, index) => {
      const excerpt = text.length > 6000 ? `${text.slice(0, 6000)}\n…（已截断）` : text
      sections.push(`【参考${index + 1}】\n${excerpt}`)
    })
  }

  if (request.imitationTexts?.length) {
    sections.push('', '参考文档（请参照其结构、层次与文风进行仿写，内容须重写）：')
    request.imitationTexts.forEach((text, index) => {
      const excerpt = text.length > 6000 ? `${text.slice(0, 6000)}\n…（已截断）` : text
      sections.push(`【参考文档${index + 1}】\n${excerpt}`)
    })
  }

  if (request.mode === 'outline') {
    sections.push('', '请输出：标题 + 各章节标题 + 每节 2～4 条要点（不写完整段落）。')
  } else if (style === 'general') {
    sections.push('', '请输出完整成稿；结构与文风匹配需求中的体裁。')
  } else if (template?.gbtFormatted) {
    sections.push('', '请输出完整公文，含红头占位、标题、主送、正文、落款/附件说明（如适用）。')
  } else {
    sections.push('', '请输出完整文书，含标题、主送、正文、落款（如适用）。')
  }

  return sections.join('\n')
}

export async function generateDocumentWithAi(request: DocumentWriteRequest): Promise<DocumentWriteResult> {
  const effectiveTemplateId = resolveEffectiveTemplateId(request)
  const style = resolveWritePromptStyle(request)

  const raw = await requestDeepSeekPlainText({
    systemPrompt: buildSystemPrompt(request.mode, style),
    userPrompt: buildUserPrompt(request, style),
    temperature: request.mode === 'outline' ? 0.4 : style === 'general' ? 0.65 : 0.55,
    maxTokens: request.mode === 'outline' ? 4096 : 8192,
    model: getDeepSeekWriteModel(),
    // 长文生成关闭思考，避免思考占用 max_tokens 导致正文半截结束；仍不够则自动续写
    thinking: 'disabled',
    continueOnLength: true,
    maxContinuations: 4,
  })

  const content = request.mode === 'full' ? normalizeDocumentStructure(raw) : raw

  return {
    content,
    templateId: effectiveTemplateId,
    mode: request.mode,
  }
}

/** 从上传文件读取参考文档文本 */
export async function readWriteReferenceFile(file: File): Promise<string> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.docx')) {
    const { importDocxFile } = await import('./wordImport')
    const result = await importDocxFile(file)
    return result.text
  }
  if (lower.endsWith('.txt') || lower.endsWith('.md')) {
    return file.text()
  }
  throw new Error(`不支持「${file.name}」格式，请上传 .docx 或 .txt`)
}
