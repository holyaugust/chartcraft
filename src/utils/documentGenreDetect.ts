import {
  DOCUMENT_PROOFREAD_GENRES,
  type DocumentProofreadGenreId,
} from '../data/documentProofreadGenres'

export interface GenreDetectionResult {
  genreId: DocumentProofreadGenreId
  label: string
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
  scores: Array<{ genreId: DocumentProofreadGenreId; label: string; score: number }>
}

interface GenreRule {
  id: DocumentProofreadGenreId
  patterns: RegExp[]
  weight: number
  reason: string
}

const GENRE_RULES: GenreRule[] = [
  {
    id: 'official_doc',
    patterns: [
      /关于.{2,40}的通知/u,
      /关于.{2,40}的请示/u,
      /关于.{2,40}的函/u,
      /关于.{2,40}的意见/u,
      /关于.{2,40}的报告/u,
      /^[\u4e00-\u9fff（）()]{2,24}：\s*$/m,
      /特此通知|特此函告|妥否，请批示|请审阅/u,
      /GB\/T\s*9704|公文格式/u,
    ],
    weight: 3,
    reason: '具备通知/请示/函/意见等公文特征或主送机关格式',
  },
  {
    id: 'meeting_minutes',
    patterns: [
      /会议纪要/u,
      /会议时间|会议地点|主持人/u,
      /出席(?:人员|领导)|列席(?:人员|人员)/u,
      /会议(?:认为|指出|强调|要求|议定)/u,
      /参会人员/u,
    ],
    weight: 3,
    reason: '含会议时间、人员、议定事项等纪要要素',
  },
  {
    id: 'speech',
    patterns: [
      /讲话稿|发言稿|致辞|主持词/u,
      /同志们|各位领导|各位来宾|各位朋友/u,
      /首先[，,].{0,8}(表示|代表)/u,
      /最后[，,].{0,12}(祝愿|谢谢|感谢)/u,
    ],
    weight: 2,
    reason: '具备讲话/致辞类称呼与结构',
  },
  {
    id: 'work_report',
    patterns: [
      /工作汇报|述职(?:报告|述廉)|情况汇报/u,
      /现将.{2,20}情况汇报如下/u,
      /主要工作|工作成效|存在问题|下一步/u,
      /年度工作|阶段性工作/u,
    ],
    weight: 2,
    reason: '符合工作汇报/述职的常见结构',
  },
  {
    id: 'plan_summary',
    patterns: [
      /工作计划|实施方案|行动方案|总结/u,
      /指导思想|工作目标|重点任务|保障措施/u,
      /20\d{2}年.{0,8}(计划|方案|总结)/u,
    ],
    weight: 2,
    reason: '含计划/方案/总结类章节结构',
  },
  {
    id: 'contract',
    patterns: [
      // 避免仅因文中出现「协议/合同」二字（行研、汇报里很常见）就判成合同
      /(?:本合同|本协议|合作协议|服务合同|采购合同|劳动合同)/u,
      /甲方[与和及]乙方|甲乙双方|甲方负责|乙方负责/u,
      /违约责任|争议解决|不可抗力|合同解除|终止条款/u,
      /签订(?:日期|时间)|自双方签字|盖章之日起生效/u,
    ],
    weight: 3,
    reason: '含合同/协议条款与甲乙主体',
  },
  {
    id: 'news_publicity',
    patterns: [
      /本报讯|记者|通讯员/u,
      /新闻稿|宣传稿|信息简报/u,
      /据悉|据了解|据介绍/u,
    ],
    weight: 2,
    reason: '具备新闻/宣传稿常见用语',
  },
  {
    id: 'research',
    patterns: [
      /调研报告|分析报告|研究报告|行业研究|行研|专题研究|研判/u,
      /调研(?:背景|方法|发现|结论)|研究背景|研究方法/u,
      /样本|问卷|访谈|实地走访/u,
      /问题分析|对策建议|启示与建议|竞争格局|政策环境|行业背景/u,
      /重组整合|整合路径|典型案例|对公司的启示|战略定力/u,
      /一、.{0,20}背景|二、.{0,20}(分析|趋势|格局)|摘要|目录/u,
    ],
    weight: 2,
    reason: '含调研分析/行研类结构与术语',
  },
  {
    id: 'table_data',
    patterns: [/\|.+\|/m, /\t.+\t/m],
    weight: 1,
    reason: '正文以表格列（| 分隔）为主',
  },
]

function scoreGenre(text: string, rule: GenreRule): { score: number; reasons: string[]; hits: number } {
  let score = 0
  let hits = 0
  const reasons: string[] = []

  for (const pattern of rule.patterns) {
    if (pattern.test(text)) {
      hits += 1
      score += rule.weight
      if (!reasons.includes(rule.reason)) {
        reasons.push(rule.reason)
      }
    }
  }

  // 合同类需至少命中 2 条强特征，防止行研/汇报里偶发「协议」误判
  if (rule.id === 'contract' && hits < 2) {
    return { score: 0, reasons: [], hits: 0 }
  }

  return { score, reasons, hits }
}

/** 基于正文关键词与结构的文体识别（即时、无 API 消耗） */
export function detectDocumentGenre(text: string, isTableDocument = false): GenreDetectionResult {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) {
    return {
      genreId: 'general',
      label: '通用文稿',
      confidence: 'low',
      reasons: ['正文为空'],
      scores: [],
    }
  }

  const scores: Array<{ genreId: DocumentProofreadGenreId; label: string; score: number }> = []
  const reasonByGenre = new Map<DocumentProofreadGenreId, string[]>()

  for (const rule of GENRE_RULES) {
    const { score, reasons } = scoreGenre(normalized, rule)
    if (score > 0) {
      scores.push({
        genreId: rule.id,
        label: DOCUMENT_PROOFREAD_GENRES.find((item) => item.id === rule.id)?.label ?? rule.id,
        score,
      })
      reasonByGenre.set(rule.id, reasons)
    }
  }

  if (isTableDocument) {
    const tableEntry = scores.find((item) => item.genreId === 'table_data')
    if (tableEntry) {
      tableEntry.score += 4
    } else {
      scores.push({ genreId: 'table_data', label: '表格数据', score: 5 })
      reasonByGenre.set('table_data', ['检测到大量表格行（| 分隔）'])
    }
  }

  scores.sort((a, b) => b.score - a.score)

  const top = scores[0]
  if (!top || top.score <= 0) {
    return {
      genreId: 'general',
      label: '通用文稿',
      confidence: 'low',
      reasons: ['未匹配到明确文体特征，按通用文稿处理'],
      scores,
    }
  }

  const second = scores[1]
  let confidence: GenreDetectionResult['confidence'] = 'high'
  if (!second || top.score - second.score <= 1) {
    confidence = second && second.score >= top.score * 0.7 ? 'low' : 'medium'
  } else if (top.score < 4) {
    confidence = 'medium'
  }

  return {
    genreId: top.genreId,
    label: top.label,
    confidence,
    reasons: reasonByGenre.get(top.genreId) ?? [],
    scores,
  }
}

const GENRE_DETECT_SYSTEM = `你是中文办公文书分类专家。根据文本片段判断文体，只输出 JSON：
{"genreId":"official_doc","confidence":"high","reasons":["简短依据1","简短依据2"]}
genreId 只能是：official_doc, work_report, meeting_minutes, speech, plan_summary, contract, news_publicity, research, table_data, general
confidence 只能是：high, medium, low`

/** AI 精识别文体（可选，消耗一次短 API 调用） */
export async function refineDocumentGenreWithAi(
  text: string,
  localHint: GenreDetectionResult,
): Promise<GenreDetectionResult> {
  const sample = text.replace(/\r\n/g, '\n').trim().slice(0, 3500)
  const { getDeepSeekProofreadModel, requestDeepSeekPlainText } = await import('./deepseek')

  const userPrompt = `本地初判：${localHint.label}（${localHint.confidence}）
初判依据：${localHint.reasons.join('；') || '无'}

请阅读以下文本片段，给出更准确的文体分类：
"""
${sample}
"""`

  try {
    const raw = await requestDeepSeekPlainText({
      systemPrompt: GENRE_DETECT_SYSTEM,
      userPrompt,
      temperature: 0.1,
      maxTokens: 512,
      model: getDeepSeekProofreadModel(),
    })

    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return localHint

    const parsed = JSON.parse(jsonMatch[0]) as {
      genreId?: string
      confidence?: string
      reasons?: string[]
    }

    const validIds = new Set(DOCUMENT_PROOFREAD_GENRES.map((item) => item.id))
    const genreId = validIds.has(parsed.genreId as DocumentProofreadGenreId)
      ? (parsed.genreId as DocumentProofreadGenreId)
      : localHint.genreId

    const confidence =
      parsed.confidence === 'high' || parsed.confidence === 'medium' || parsed.confidence === 'low'
        ? parsed.confidence
        : localHint.confidence

    return {
      genreId,
      label: DOCUMENT_PROOFREAD_GENRES.find((item) => item.id === genreId)?.label ?? localHint.label,
      confidence,
      reasons: Array.isArray(parsed.reasons) && parsed.reasons.length > 0 ? parsed.reasons : localHint.reasons,
      scores: localHint.scores,
    }
  } catch {
    return localHint
  }
}
