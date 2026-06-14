/**
 * 生成 5 套封面 pptx 模板（开发时运行：npm run generate:ppt-covers）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PptxGenJS from 'pptxgenjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../public/ppt-beautify/covers')

const THEMES = [
  {
    id: 'green-academic',
    background: '1F6B4F',
    titleColor: 'FFFFFF',
    subtitleColor: 'D1FAE5',
    footerColor: 'FFFFFF',
    accent: 'FBBF24',
  },
  {
    id: 'blue-business',
    background: '1E3A5F',
    titleColor: 'FFFFFF',
    subtitleColor: 'DBEAFE',
    footerColor: 'FFFFFF',
    accent: '60A5FA',
  },
  {
    id: 'dark-modern',
    background: '0F172A',
    titleColor: 'F8FAFC',
    subtitleColor: '94A3B8',
    footerColor: 'CBD5E1',
    accent: '38BDF8',
  },
  {
    id: 'red-corporate',
    background: '991B1B',
    titleColor: 'FFFFFF',
    subtitleColor: 'FEE2E2',
    footerColor: 'FFFFFF',
    accent: 'FDE68A',
  },
  {
    id: 'minimal-gray',
    background: 'F1F5F9',
    titleColor: '0F172A',
    subtitleColor: '475569',
    footerColor: '64748B',
    accent: '94A3B8',
  },
]

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

  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: 0.12,
    h: 5.625,
    fill: { color: theme.accent },
  })

  slide.addText('在此填写主标题', {
    x: 0.55,
    y: 1.65,
    w: 8.8,
    h: 1.2,
    fontSize: 32,
    bold: true,
    color: theme.titleColor,
    fontFace: 'Microsoft YaHei',
  })

  slide.addText('在此填写副标题', {
    x: 0.55,
    y: 2.95,
    w: 8.8,
    h: 0.75,
    fontSize: 16,
    color: theme.subtitleColor,
    fontFace: 'Microsoft YaHei',
  })

  slide.addText('汇报人', {
    x: 0.55,
    y: 5.15,
    w: 4,
    h: 0.35,
    fontSize: 12,
    color: theme.footerColor,
    fontFace: 'Microsoft YaHei',
  })

  slide.addText('2025.01.01', {
    x: 5.5,
    y: 5.15,
    w: 3.95,
    h: 0.35,
    fontSize: 12,
    color: theme.footerColor,
    align: 'right',
    fontFace: 'Microsoft YaHei',
  })
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })

  for (const theme of THEMES) {
    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_16x9'
    pptx.author = 'ChartCraft'
    pptx.title = `Cover Template ${theme.id}`
    addCoverSlide(pptx, theme)
    const filePath = path.join(outDir, `${theme.id}.pptx`)
    await pptx.writeFile({ fileName: filePath })
    console.log('Wrote', filePath)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
