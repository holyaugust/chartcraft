/**
 * 生成 5 套全文 pptx 模板（14 页，版式与 HTML 预览一致）
 * 开发时运行：npm run generate:ppt-full
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PptxGenJS from 'pptxgenjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../public/ppt-beautify/full')

const FONT = 'Microsoft YaHei'
const CONTENT_SLIDE_COUNT = 10
const BULLET_SLOTS = 5
const BULLET_ROW_START = 1.38
const BULLET_ROW_H = 0.58
const BULLET_ROW_GAP = 0.1

/** 与 src/utils/pptxTextExtract.ts CONTENT_BULLET_ROW_Y 一致 */
const BULLET_ROW_Y = Array.from({ length: BULLET_SLOTS }, (_, index) =>
  BULLET_ROW_START + index * (BULLET_ROW_H + BULLET_ROW_GAP),
)

const CONTENT_CARD_X = 0.45
const CONTENT_CARD_W = 9.1
const CONTENT_CARD_H = 3.82
const CONTENT_CARD_Y = 1.18
const CARD_RADIUS = 0.07
const ROW_RADIUS = 0.14
const BADGE_SIZE = 0.36
const BADGE_RADIUS = 0.38
const PILL_RADIUS = 0.5
const FOOTER_X = 0.12
const FOOTER_W = 9.88
const FOOTER_ACCENT_W = FOOTER_W * 0.28

/** 与 src/data/pptCoverThemes.ts 中 content 配色对齐 */
const THEMES = [
  {
    id: 'green-academic',
    background: '1F6B4F',
    primaryColor: '1F6B4F',
    titleColor: 'FFFFFF',
    subtitleColor: 'D1FAE5',
    footerColor: 'FFFFFF',
    accent: 'FBBF24',
    pageBg: 'ECFDF5',
    headerFill: '1F6B4F',
    headerFillLight: '2D8A62',
    contentCard: 'FFFFFF',
    contentTitle: 'FFFFFF',
    contentBody: '334155',
    cardBorder: 'C6E7D7',
  },
  {
    id: 'blue-business',
    background: '1E3A5F',
    primaryColor: '1E3A5F',
    titleColor: 'FFFFFF',
    subtitleColor: 'DBEAFE',
    footerColor: 'FFFFFF',
    accent: '60A5FA',
    pageBg: 'EFF6FF',
    headerFill: '1E3A5F',
    headerFillLight: '2563EB',
    contentCard: 'FFFFFF',
    contentTitle: 'FFFFFF',
    contentBody: '334155',
    cardBorder: 'BFDBFE',
  },
  {
    id: 'dark-modern',
    background: '0F172A',
    primaryColor: '334155',
    titleColor: 'F8FAFC',
    subtitleColor: '94A3B8',
    footerColor: 'CBD5E1',
    accent: '38BDF8',
    pageBg: '0F172A',
    headerFill: '1E293B',
    headerFillLight: '334155',
    contentCard: '1E293B',
    contentTitle: 'F8FAFC',
    contentBody: 'CBD5E1',
    cardBorder: '334155',
  },
  {
    id: 'red-corporate',
    background: '991B1B',
    primaryColor: '991B1B',
    titleColor: 'FFFFFF',
    subtitleColor: 'FEE2E2',
    footerColor: 'FFFFFF',
    accent: 'FDE68A',
    pageBg: 'FEF2F2',
    headerFill: '991B1B',
    headerFillLight: 'B91C1C',
    contentCard: 'FFFFFF',
    contentTitle: 'FFFFFF',
    contentBody: '334155',
    cardBorder: 'FECACA',
  },
  {
    id: 'minimal-gray',
    background: '64748B',
    primaryColor: '475569',
    titleColor: 'FFFFFF',
    subtitleColor: 'F1F5F9',
    footerColor: 'FFFFFF',
    accent: '94A3B8',
    pageBg: 'F8FAFC',
    headerFill: '475569',
    headerFillLight: '64748B',
    contentCard: 'FFFFFF',
    contentTitle: 'FFFFFF',
    contentBody: '475569',
    cardBorder: 'CBD5E1',
  },
]

function addAccentBar(slide, theme) {
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 0.12,
    h: 5.625,
    fill: { color: theme.accent },
  })
}

function addCoverSlide(pptx, theme) {
  const slide = pptx.addSlide()
  slide.background = { color: theme.background }

  if (theme.id !== 'minimal-gray') {
    slide.addShape('rect', {
      x: 0,
      y: 5.1,
      w: 10,
      h: 0.55,
      fill: { color: theme.accent, transparency: 35 },
    })
  }

  addAccentBar(slide, theme)

  slide.addText('CC_COVER_TITLE', {
    x: 0.55,
    y: 1.65,
    w: 8.8,
    h: 1.2,
    fontSize: 32,
    bold: true,
    color: theme.titleColor,
    fontFace: FONT,
  })

  slide.addText('CC_COVER_SUBTITLE', {
    x: 0.55,
    y: 2.95,
    w: 8.8,
    h: 0.75,
    fontSize: 16,
    color: theme.subtitleColor,
    fontFace: FONT,
  })

  slide.addText('CC_COVER_AUTHOR', {
    x: 0.55,
    y: 5.15,
    w: 4,
    h: 0.35,
    fontSize: 12,
    color: theme.footerColor,
    fontFace: FONT,
  })

  slide.addText('CC_COVER_DATE', {
    x: 5.5,
    y: 5.15,
    w: 3.95,
    h: 0.35,
    fontSize: 12,
    color: theme.footerColor,
    align: 'right',
    fontFace: FONT,
  })
}

function addSectionSlide(pptx, theme) {
  const slide = pptx.addSlide()
  slide.background = { color: theme.background }
  addAccentBar(slide, theme)

  slide.addShape('rect', {
    x: 0,
    y: 5.15,
    w: 10,
    h: 0.47,
    fill: { color: theme.accent, transparency: 40 },
  })

  slide.addShape('ellipse', {
    x: 8.55,
    y: 0.35,
    w: 0.85,
    h: 0.85,
    line: { color: theme.accent, width: 1.5 },
    fill: { color: theme.background, transparency: 100 },
  })

  slide.addText('CC_SECTION_TITLE', {
    x: 0.55,
    y: 2.15,
    w: 8.8,
    h: 1.2,
    fontSize: 36,
    bold: true,
    color: theme.titleColor,
    align: 'center',
    fontFace: FONT,
  })
}

function addMeshDecorations(slide, theme) {
  slide.addShape('ellipse', {
    x: 7.35,
    y: -0.2,
    w: 3.0,
    h: 2.6,
    fill: { color: theme.accent, transparency: 72 },
    line: { width: 0 },
  })
  slide.addShape('ellipse', {
    x: -0.85,
    y: 3.95,
    w: 3.2,
    h: 2.9,
    fill: { color: theme.primaryColor, transparency: 85 },
    line: { width: 0 },
  })
}

function addBulletCardRow(slide, theme, slotIndex, rowY) {
  const num = String(slotIndex + 1).padStart(2, '0')
  const ROW_X = 0.58
  const ROW_W = 8.84
  const badgeX = ROW_X + 0.14
  const badgeY = rowY + (BULLET_ROW_H - BADGE_SIZE) / 2

  slide.addShape('roundRect', {
    x: ROW_X,
    y: rowY,
    w: ROW_W,
    h: BULLET_ROW_H,
    rectRadius: ROW_RADIUS,
    fill: { color: theme.primaryColor, transparency: 94 },
    line: { color: theme.cardBorder, width: 0.5 },
  })

  slide.addShape('rect', {
    x: ROW_X,
    y: rowY,
    w: 0.035,
    h: BULLET_ROW_H,
    fill: { color: theme.accent, transparency: 15 },
  })

  slide.addShape('roundRect', {
    x: badgeX,
    y: badgeY,
    w: BADGE_SIZE,
    h: BADGE_SIZE,
    rectRadius: BADGE_RADIUS,
    fill: { color: theme.primaryColor },
    line: { width: 0 },
    shadow: {
      type: 'outer',
      blur: 4,
      offset: 1,
      angle: 90,
      color: '0F172A',
      opacity: 0.15,
    },
  })

  slide.addShape('roundRect', {
    x: badgeX + BADGE_SIZE * 0.42,
    y: badgeY + BADGE_SIZE * 0.42,
    w: BADGE_SIZE * 0.58,
    h: BADGE_SIZE * 0.58,
    rectRadius: BADGE_RADIUS,
    fill: { color: theme.accent, transparency: 20 },
    line: { width: 0 },
  })

  slide.addText(num, {
    x: badgeX,
    y: badgeY,
    w: BADGE_SIZE,
    h: BADGE_SIZE,
    fontSize: 9,
    bold: true,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
    fontFace: FONT,
  })

  slide.addText(`CC_BULLET_${slotIndex + 1}`, {
    x: ROW_X + 0.62,
    y: rowY + 0.1,
    w: 7.95,
    h: 0.38,
    fontSize: 11,
    color: theme.contentBody,
    fontFace: FONT,
    valign: 'top',
    lineSpacingMultiple: 1.15,
  })
}

function addContentSlide(pptx, theme) {
  const slide = pptx.addSlide()
  slide.background = { color: theme.pageBg }

  addAccentBar(slide, theme)
  addMeshDecorations(slide, theme)

  slide.addShape('ellipse', {
    x: 8.65,
    y: 0.22,
    w: 0.75,
    h: 0.75,
    line: { color: theme.accent, width: 1.25 },
    fill: { color: theme.pageBg, transparency: 100 },
  })
  slide.addShape('ellipse', {
    x: 8.95,
    y: 0.42,
    w: 0.42,
    h: 0.42,
    fill: { color: theme.accent, transparency: 65 },
  })

  slide.addShape('rect', {
    x: 0.12,
    y: 0,
    w: 9.88,
    h: 1.05,
    fill: { color: theme.headerFill },
  })

  slide.addShape('rect', {
    x: 4.8,
    y: 0,
    w: 5.2,
    h: 1.05,
    fill: { color: theme.headerFillLight, transparency: 25 },
  })

  slide.addShape('rect', {
    x: 6.85,
    y: -0.35,
    w: 3.4,
    h: 1.35,
    fill: { color: 'FFFFFF', transparency: 88 },
    rotate: 350,
  })

  slide.addShape('rect', {
    x: 0.12,
    y: 1.02,
    w: 9.88,
    h: 0.04,
    fill: { color: theme.accent },
  })

  slide.addShape('roundRect', {
    x: 0.52,
    y: 0.1,
    w: 1.05,
    h: 0.22,
    rectRadius: PILL_RADIUS,
    fill: { color: 'FFFFFF', transparency: 88 },
    line: { color: 'FFFFFF', width: 0.5, transparency: 80 },
  })

  slide.addText('KEY POINTS', {
    x: 0.55,
    y: 0.12,
    w: 1.0,
    h: 0.18,
    fontSize: 7,
    bold: true,
    color: theme.contentTitle,
    fontFace: FONT,
    transparency: 25,
    charSpacing: 1.2,
  })

  slide.addText('CC_TITLE', {
    x: 0.55,
    y: 0.36,
    w: 8.8,
    h: 0.58,
    fontSize: 22,
    bold: true,
    color: theme.contentTitle,
    fontFace: FONT,
    valign: 'top',
  })

  slide.addShape('roundRect', {
    x: CONTENT_CARD_X,
    y: CONTENT_CARD_Y,
    w: CONTENT_CARD_W,
    h: CONTENT_CARD_H,
    rectRadius: CARD_RADIUS,
    fill: { color: theme.contentCard },
    line: { color: theme.cardBorder, width: 0.75 },
    shadow: {
      type: 'outer',
      blur: 14,
      offset: 4,
      angle: 90,
      color: theme.primaryColor,
      opacity: 0.1,
    },
  })

  for (let slot = 0; slot < BULLET_SLOTS; slot += 1) {
    addBulletCardRow(slide, theme, slot, BULLET_ROW_Y[slot])
  }

  slide.addShape('rect', {
    x: FOOTER_X,
    y: 5.12,
    w: FOOTER_W,
    h: 0.5,
    fill: { color: theme.headerFill },
  })

  slide.addShape('rect', {
    x: FOOTER_X,
    y: 5.12,
    w: FOOTER_ACCENT_W,
    h: 0.5,
    fill: { color: theme.accent, transparency: 10 },
  })

  slide.addShape('roundRect', {
    x: 8.88,
    y: 5.18,
    w: 0.68,
    h: 0.36,
    rectRadius: PILL_RADIUS,
    fill: { color: 'FFFFFF', transparency: 85 },
    line: { color: 'FFFFFF', width: 0.5, transparency: 75 },
  })

  slide.addText('CC_PAGE_NUM', {
    x: 8.88,
    y: 5.18,
    w: 0.68,
    h: 0.36,
    fontSize: 9,
    bold: true,
    color: theme.contentTitle,
    align: 'center',
    valign: 'middle',
    fontFace: FONT,
  })
}

function addClosingSlide(pptx, theme) {
  const slide = pptx.addSlide()
  slide.background = { color: theme.background }
  addAccentBar(slide, theme)

  slide.addText('CC_CLOSING_TITLE', {
    x: 0.55,
    y: 2.05,
    w: 8.8,
    h: 1.1,
    fontSize: 40,
    bold: true,
    color: theme.titleColor,
    align: 'center',
    fontFace: FONT,
  })

  slide.addText('CC_CLOSING_SUBTITLE', {
    x: 0.55,
    y: 3.35,
    w: 8.8,
    h: 0.55,
    fontSize: 18,
    color: theme.subtitleColor,
    align: 'center',
    fontFace: FONT,
  })
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })

  for (const theme of THEMES) {
    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_16x9'
    pptx.author = 'ChartCraft'
    pptx.title = `Full Deck Template ${theme.id}`

    addCoverSlide(pptx, theme)
    addSectionSlide(pptx, theme)
    for (let i = 0; i < CONTENT_SLIDE_COUNT; i += 1) {
      addContentSlide(pptx, theme)
    }
    addSectionSlide(pptx, theme)
    addClosingSlide(pptx, theme)

    const filePath = path.join(outDir, `${theme.id}.pptx`)
    await pptx.writeFile({ fileName: filePath })
    console.log('Wrote', filePath)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
