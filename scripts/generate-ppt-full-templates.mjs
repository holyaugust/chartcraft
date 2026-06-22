/**
 * 生成全文 pptx 模板（14 页，多版式）
 * 开发时运行：npm run generate:ppt-full
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PptxGenJS from 'pptxgenjs'

import { PPT_THEME_GENERATION_DEFS } from './ppt-theme-defs.mjs'
import { buildFullDeck } from './ppt-slide-builders.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../public/ppt-beautify/full')

async function main() {
  fs.mkdirSync(outDir, { recursive: true })

  for (const theme of PPT_THEME_GENERATION_DEFS) {
    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_16x9'
    pptx.author = 'ChartCraft'
    pptx.title = `Full Deck Template ${theme.id}`

    buildFullDeck(pptx, theme)

    const filePath = path.join(outDir, `${theme.id}.pptx`)
    await pptx.writeFile({ fileName: filePath })
    console.log('Wrote', filePath, `[${theme.layout}]`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
