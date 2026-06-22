/**
 * 生成封面 pptx 模板（开发时运行：npm run generate:ppt-covers）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PptxGenJS from 'pptxgenjs'

import { PPT_THEME_GENERATION_DEFS } from './ppt-theme-defs.mjs'
import { addCoverSlide } from './ppt-slide-builders.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../public/ppt-beautify/covers')

async function main() {
  fs.mkdirSync(outDir, { recursive: true })

  for (const theme of PPT_THEME_GENERATION_DEFS) {
    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_16x9'
    pptx.author = 'ChartCraft'
    pptx.title = `Cover Template ${theme.id}`
    addCoverSlide(pptx, theme)
    const filePath = path.join(outDir, `${theme.id}.pptx`)
    await pptx.writeFile({ fileName: filePath })
    console.log('Wrote', filePath, `[${theme.layout}]`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
