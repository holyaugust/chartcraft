import { DOCUMENT_FORMAT_SPEC, getDocumentTemplateById } from '../data/documentTemplates'
import { GBT9704_EXPORT_SPEC_NOTE } from '../data/gbt9704ExportSpec'
import { resolveWriteTypeSelection, type DocumentWriteTypeSelection } from '../data/documentWriteTypes'
import { requestDeepSeekPlainText } from './deepseek'
import { normalizeDocumentStructure } from './documentFormatNormalize'

export type DocumentWriteMode = 'outline' | 'full'

export interface DocumentWriteRequest {
  prompt: string
  title?: string
  requirements?: string
  typeSelection: DocumentWriteTypeSelection
  /** 文档工作区右侧当前选中的模板 ID */
  activeTemplateId?: string | null
  referenceTexts?: string[]
  imitationTexts?: string[]
  mode: DocumentWriteMode
}

export interface DocumentWriteResult {
  content: string
  templateId?: string
  mode: DocumentWriteMode
}

export const DEFAULT_WRITE_PROMPT =
  '请帮我写一份公文，标题是【关于XXX工作的行动/实施方案】，要求是【文风严谨，语言简洁凝练】。'

export function parseWritePromptFields(prompt: string): { title: string; requirements: string } {
  const titleMatch = prompt.match(/标题是[【\[]([^】\]]+)[】\]]/)
  const reqMatch = prompt.match(/要求是[【\[]([^】\]]+)[】\]]/)
  return {
    title: titleMatch?.[1]?.trim() ?? '',
    requirements: reqMatch?.[1]?.trim() ?? '',
  }
}

/** 用户是否在需求中明确提到要基于模板写作 */
export function promptMentionsSelectedTemplate(prompt: string): boolean {
  return /基于.{0,12}模板|按.{0,8}模板|参照.{0,8}模板|当前.{0,8}模板|所选模板|选定的模板|目前选择.{0,12}模板/u.test(
    prompt,
  )
}

function resolveEffectiveTemplateId(request: DocumentWriteRequest): string | undefined {
  const fromType = resolveWriteTypeSelection(request.typeSelection).templateId
  if (fromType) return fromType

  const activeId = request.activeTemplateId?.trim()
  if (!activeId) return undefined

  if (request.typeSelection.typeId === 'auto' || promptMentionsSelectedTemplate(request.prompt)) {
    return activeId
  }

  return undefined
}

function buildSystemPrompt(mode: DocumentWriteMode): string {
  const modeHint =
    mode === 'outline'
      ? '本次只输出公文大纲（章节标题与要点提示），不要写完整正文。'
      : '本次输出完整公文正文，可直接用于编辑定稿。'

  return `你是国企公文写作专家，熟悉 GB/T 9704 党政机关公文格式规范。
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

function buildUserPrompt(request: DocumentWriteRequest): string {
  const parsed = parseWritePromptFields(request.prompt)
  const title = request.title?.trim() || parsed.title || '（请根据提示拟定标题）'
  const requirements =
    request.requirements?.trim() || parsed.requirements || '文风严谨，语言简洁凝练，符合国企公文规范'

  const resolved = resolveWriteTypeSelection(request.typeSelection)
  const effectiveTemplateId = resolveEffectiveTemplateId(request)
  const template = effectiveTemplateId ? getDocumentTemplateById(effectiveTemplateId) : undefined

  const sections: string[] = [
    `写作需求：${request.prompt.trim()}`,
    '',
    `公文标题：${title}`,
    `写作要求：${requirements}`,
    `公文类型：${resolved.label}`,
  ]

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
  } else {
    sections.push('', '请输出完整公文，含红头占位、标题、主送、正文、落款/附件说明（如适用）。')
  }

  return sections.join('\n')
}

export async function generateDocumentWithAi(request: DocumentWriteRequest): Promise<DocumentWriteResult> {
  const raw = await requestDeepSeekPlainText({
    systemPrompt: buildSystemPrompt(request.mode),
    userPrompt: buildUserPrompt(request),
    temperature: request.mode === 'outline' ? 0.4 : 0.55,
    maxTokens: request.mode === 'outline' ? 4096 : 8192,
  })

  const content = request.mode === 'full' ? normalizeDocumentStructure(raw) : raw

  const effectiveTemplateId = resolveEffectiveTemplateId(request)

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
