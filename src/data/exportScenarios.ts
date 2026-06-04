export type ExportScenarioId = 'ppt' | 'wechat' | 'a4'

export interface ExportScenario {
  id: ExportScenarioId
  name: string
  subtitle: string
  description: string
  width: number
  height: number
  pixelRatio: number
  filenameSuffix: string
  /** A4 场景使用标准纸张 PDF，其余按像素尺寸生成 PDF */
  useA4Pdf: boolean
}

/** 复制到 Office 时的渲染与粘贴尺寸 */
export interface ClipboardPasteLayout {
  renderWidth: number
  renderHeight: number
  pixelRatio: number
  /** PowerPoint / Word 粘贴显示宽（磅 pt，72pt = 1 英寸） */
  pasteWidthPt: number
  pasteHeightPt: number
}

export function getClipboardPasteLayout(scenario: ExportScenario): ClipboardPasteLayout {
  switch (scenario.id) {
    case 'ppt':
      // 16:9 宽屏幻灯片：13.33" × 7.5" = 960 × 540 pt
      return {
        renderWidth: 1280,
        renderHeight: 720,
        pixelRatio: 1,
        pasteWidthPt: 960,
        pasteHeightPt: 540,
      }
    case 'wechat':
      return {
        renderWidth: 900,
        renderHeight: 506,
        pixelRatio: 1,
        pasteWidthPt: 675,
        pasteHeightPt: 380,
      }
    case 'a4':
      // A4 横向内容区约 10.5" × 7.4"
      return {
        renderWidth: 1123,
        renderHeight: 794,
        pixelRatio: 1,
        pasteWidthPt: 756,
        pasteHeightPt: 535,
      }
    default:
      return {
        renderWidth: scenario.width,
        renderHeight: scenario.height,
        pixelRatio: 1,
        pasteWidthPt: 960,
        pasteHeightPt: Math.round((960 * scenario.height) / scenario.width),
      }
  }
}

export const EXPORT_SCENARIOS: ExportScenario[] = [
  {
    id: 'ppt',
    name: 'PPT 演示',
    subtitle: '16:9',
    description: '1920px 宽 · 与预览一致高清放大',
    width: 1920,
    height: 1080,
    pixelRatio: 2,
    filenameSuffix: 'ppt',
    useA4Pdf: false,
  },
  {
    id: 'wechat',
    name: '公众号配图',
    subtitle: '900px 宽',
    description: '900px 宽 · 与预览一致高清放大',
    width: 900,
    height: 506,
    pixelRatio: 2,
    filenameSuffix: 'wechat',
    useA4Pdf: false,
  },
  {
    id: 'a4',
    name: 'A4 打印',
    subtitle: '横向 A4',
    description: '1754px 宽 · 与预览一致高清放大',
    width: 1754,
    height: 1240,
    pixelRatio: 2,
    filenameSuffix: 'a4',
    useA4Pdf: true,
  },
]

export function getExportScenario(id: ExportScenarioId): ExportScenario {
  return EXPORT_SCENARIOS.find((scenario) => scenario.id === id) ?? EXPORT_SCENARIOS[0]
}
