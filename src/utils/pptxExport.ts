import type pptxgen from 'pptxgenjs'
import type { PresentationTemplate } from '../types/presentation'
import type { PresentationOutline, PresentationSlide } from '../types/presentation'

async function loadPptxGen() {
  const { default: PptxGen } = await import('pptxgenjs')
  return PptxGen
}

/** 16:9 幻灯片布局常量（单位：英寸） */
const L = {
  W: 10,
  H: 5.625,
  M: 0.55,
  HEADER: 0.82,
  ACCENT: 0.045,
  FOOTER_Y: 5.15,
} as const

const GRAY = {
  body: '334155',
  muted: '64748B',
  line: 'E2E8F0',
  card: 'F8FAFC',
  cardBorder: 'E2E8F0',
} as const

function addGoldAccentLine(s: pptxgen.Slide, template: PresentationTemplate, y: number, w = L.W) {
  s.addShape('rect' as pptxgen.ShapeType, {
    x: 0,
    y,
    w,
    h: L.ACCENT,
    fill: { color: template.theme.accentColor },
  })
}

function addFooter(s: pptxgen.Slide, template: PresentationTemplate, label: string, slideNum?: number) {
  s.addShape('line' as pptxgen.ShapeType, {
    x: L.M,
    y: L.FOOTER_Y,
    w: L.W - L.M * 2,
    h: 0,
    line: { color: GRAY.line, width: 0.6 },
  })
  s.addText(label, {
    x: L.M,
    y: L.FOOTER_Y + 0.06,
    w: 6,
    h: 0.22,
    fontSize: 9,
    color: GRAY.muted,
    fontFace: template.theme.bodyFontFace,
  })
  if (slideNum !== undefined) {
    s.addText(String(slideNum).padStart(2, '0'), {
      x: L.W - L.M - 0.6,
      y: L.FOOTER_Y + 0.04,
      w: 0.6,
      h: 0.25,
      fontSize: 10,
      color: GRAY.muted,
      fontFace: template.theme.bodyFontFace,
      align: 'right',
    })
  }
}

function addContentHeader(
  s: pptxgen.Slide,
  template: PresentationTemplate,
  title: string,
) {
  s.addShape('rect' as pptxgen.ShapeType, {
    x: 0,
    y: 0,
    w: '100%',
    h: L.HEADER,
    fill: { color: template.theme.primaryColor },
  })
  addGoldAccentLine(s, template, L.HEADER)
  s.addText(title, {
    x: L.M,
    y: 0.18,
    w: L.W - L.M * 2,
    h: 0.52,
    fontSize: 20,
    bold: true,
    color: 'FFFFFF',
    fontFace: template.theme.titleFontFace,
    valign: 'middle',
  })
}

function addBulletBlock(
  s: pptxgen.Slide,
  template: PresentationTemplate,
  bullets: string[],
) {
  const cardY = L.HEADER + L.ACCENT + 0.28
  const cardH = L.FOOTER_Y - cardY - 0.2

  s.addShape('roundRect' as pptxgen.ShapeType, {
    x: L.M,
    y: cardY,
    w: L.W - L.M * 2,
    h: cardH,
    fill: { color: GRAY.card },
    line: { color: GRAY.cardBorder, width: 0.75 },
    rectRadius: 0.08,
  })

  s.addText(
    bullets.map((text, index) => ({
      text,
      options: {
        bullet: { code: '2022', color: template.theme.accentColor },
        breakLine: index < bullets.length - 1,
        paraSpaceBefore: index === 0 ? 0 : 6,
      },
    })),
    {
      x: L.M + 0.35,
      y: cardY + 0.28,
      w: L.W - L.M * 2 - 0.55,
      h: cardH - 0.45,
      fontSize: 15,
      color: GRAY.body,
      fontFace: template.theme.bodyFontFace,
      lineSpacingMultiple: 1.25,
    },
  )
}

function addTitleSlide(
  pptx: pptxgen,
  slide: PresentationSlide,
  outline: PresentationOutline,
  template: PresentationTemplate,
) {
  const s = pptx.addSlide()
  s.background = { color: 'FFFFFF' }

  s.addShape('rect' as pptxgen.ShapeType, {
    x: 0,
    y: 0,
    w: '100%',
    h: 2.45,
    fill: { color: template.theme.primaryColor },
  })
  addGoldAccentLine(s, template, 2.45)

  s.addShape('rect' as pptxgen.ShapeType, {
    x: 0,
    y: 2.45 + L.ACCENT,
    w: 0.18,
    h: L.H - 2.45 - L.ACCENT,
    fill: { color: template.theme.accentColor },
  })

  s.addText(outline.title, {
    x: L.M,
    y: 0.75,
    w: L.W - L.M * 2,
    h: 1.1,
    fontSize: 34,
    bold: true,
    color: 'FFFFFF',
    fontFace: template.theme.titleFontFace,
    align: 'center',
    valign: 'middle',
  })

  if (outline.subtitle) {
    s.addText(outline.subtitle, {
      x: L.M + 0.3,
      y: 2.85,
      w: L.W - L.M * 2 - 0.3,
      h: 0.55,
      fontSize: 17,
      color: template.theme.primaryColor,
      fontFace: template.theme.bodyFontFace,
      align: 'center',
    })
    s.addShape('line' as pptxgen.ShapeType, {
      x: 4.1,
      y: 2.72,
      w: 1.8,
      h: 0,
      line: { color: template.theme.accentColor, width: 2 },
    })
  }

  s.addText(template.name, {
    x: L.M,
    y: L.FOOTER_Y + 0.06,
    w: 4,
    h: 0.22,
    fontSize: 9,
    color: GRAY.muted,
    fontFace: template.theme.bodyFontFace,
  })

  if (slide.notes) s.addNotes(slide.notes)
}

function addSectionSlide(
  pptx: pptxgen,
  slide: PresentationSlide,
  template: PresentationTemplate,
  slideNum: number,
) {
  const s = pptx.addSlide()
  s.background = { color: template.theme.primaryColor }

  s.addShape('rect' as pptxgen.ShapeType, {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.12,
    fill: { color: template.theme.accentColor },
  })

  s.addShape('ellipse' as pptxgen.ShapeType, {
    x: 7.8,
    y: -0.6,
    w: 3.2,
    h: 3.2,
    fill: { color: 'FFFFFF', transparency: 92 },
  })
  s.addShape('ellipse' as pptxgen.ShapeType, {
    x: -1.2,
    y: 3.8,
    w: 2.8,
    h: 2.8,
    fill: { color: 'FFFFFF', transparency: 94 },
  })

  s.addShape('line' as pptxgen.ShapeType, {
    x: 4.0,
    y: 2.05,
    w: 2.0,
    h: 0,
    line: { color: template.theme.accentColor, width: 2.5 },
  })

  s.addText(slide.title, {
    x: L.M,
    y: 2.25,
    w: L.W - L.M * 2,
    h: 0.95,
    fontSize: 30,
    bold: true,
    color: 'FFFFFF',
    fontFace: template.theme.titleFontFace,
    align: 'center',
    valign: 'middle',
  })

  addFooter(s, template, template.name, slideNum)
  if (slide.notes) s.addNotes(slide.notes)
}

function addContentSlide(
  pptx: pptxgen,
  slide: PresentationSlide,
  template: PresentationTemplate,
  slideNum: number,
) {
  const s = pptx.addSlide()
  s.background = { color: 'FFFFFF' }

  addContentHeader(s, template, slide.title)

  const bullets = slide.bullets ?? []
  if (bullets.length > 0) {
    addBulletBlock(s, template, bullets)
  }

  addFooter(s, template, template.name, slideNum)
  if (slide.notes) s.addNotes(slide.notes)
}

function addClosingSlide(
  pptx: pptxgen,
  slide: PresentationSlide,
  outline: PresentationOutline,
  template: PresentationTemplate,
) {
  const s = pptx.addSlide()
  s.background = { color: 'FFFFFF' }

  s.addShape('rect' as pptxgen.ShapeType, {
    x: 0,
    y: 0,
    w: '100%',
    h: L.H,
    fill: { color: template.theme.primaryColor },
  })
  addGoldAccentLine(s, template, L.H - 0.55)

  s.addShape('rect' as pptxgen.ShapeType, {
    x: 0,
    y: L.H - 0.55 + L.ACCENT,
    w: '100%',
    h: 0.55 - L.ACCENT,
    fill: { color: 'FFFFFF' },
  })

  s.addText(slide.title || '谢谢', {
    x: L.M,
    y: 1.85,
    w: L.W - L.M * 2,
    h: 0.9,
    fontSize: 40,
    bold: true,
    color: 'FFFFFF',
    fontFace: template.theme.titleFontFace,
    align: 'center',
    valign: 'middle',
  })

  if (slide.bullets?.length) {
    s.addText(slide.bullets.join('  ·  '), {
      x: L.M,
      y: 3.0,
      w: L.W - L.M * 2,
      h: 0.45,
      fontSize: 14,
      color: 'E2E8F0',
      fontFace: template.theme.bodyFontFace,
      align: 'center',
    })
  }

  s.addText(outline.title, {
    x: L.M,
    y: L.FOOTER_Y + 0.06,
    w: L.W - L.M * 2,
    h: 0.22,
    fontSize: 9,
    color: GRAY.muted,
    fontFace: template.theme.bodyFontFace,
    align: 'center',
  })

  if (slide.notes) s.addNotes(slide.notes)
}

function addChartSlide(
  pptx: pptxgen,
  slide: PresentationSlide,
  template: PresentationTemplate,
  slideNum: number,
) {
  const s = pptx.addSlide()
  s.background = { color: 'FFFFFF' }

  addContentHeader(s, template, slide.title)
  addFooter(s, template, template.name, slideNum)

  if (slide.chartImageDataUrl) {
    s.addImage({
      data: slide.chartImageDataUrl,
      x: L.M + 0.15,
      y: L.HEADER + L.ACCENT + 0.35,
      w: L.W - L.M * 2 - 0.3,
      h: L.FOOTER_Y - L.HEADER - L.ACCENT - 0.55,
      sizing: { type: 'contain', w: L.W - L.M * 2 - 0.3, h: L.FOOTER_Y - L.HEADER - L.ACCENT - 0.55 },
    })
  }

  if (slide.notes) s.addNotes(slide.notes)
}

export async function exportPresentationToPptx(
  outline: PresentationOutline,
  template: PresentationTemplate,
): Promise<Blob> {
  const PptxGen = await loadPptxGen()
  const pptx = new PptxGen()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'ChartCraft'
  pptx.subject = outline.title
  pptx.title = outline.title

  let slideNum = 0

  for (const slide of outline.slides) {
    switch (slide.layout) {
      case 'title':
        addTitleSlide(pptx, slide, outline, template)
        break
      case 'section':
        slideNum += 1
        addSectionSlide(pptx, slide, template, slideNum)
        break
      case 'closing':
        addClosingSlide(pptx, slide, outline, template)
        break
      case 'chart':
        slideNum += 1
        addChartSlide(pptx, slide, template, slideNum)
        break
      default:
        slideNum += 1
        addContentSlide(pptx, slide, template, slideNum)
        break
    }
  }

  const result = await pptx.write({ outputType: 'blob' })
  if (result instanceof Blob) return result
  throw new Error('PPT 导出失败')
}

export function buildPresentationFileName(title: string): string {
  const safe = title.replace(/[\\/:*?"<>|]/g, '').trim() || '工作汇报'
  return `${safe}.pptx`
}

export async function exportPresentation(
  outline: PresentationOutline,
  template: PresentationTemplate,
  options?: { writeBackBuffer?: ArrayBuffer },
): Promise<{ blob: Blob; writeBackInfo?: { updatedCount: number; skippedCount: number } }> {
  if (options?.writeBackBuffer) {
    const { exportPptxWriteBack } = await import('./pptxImport')
    const result = await exportPptxWriteBack(options.writeBackBuffer, outline)
    return { blob: result.blob, writeBackInfo: { updatedCount: result.updatedCount, skippedCount: result.skippedCount } }
  }

  const blob = await exportPresentationToPptx(outline, template)
  return { blob }
}
