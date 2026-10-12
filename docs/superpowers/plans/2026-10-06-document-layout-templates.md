# 按文种共用排版模板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 公文、合同、可研报告和通用文稿各有一份排版表，编辑页与 Word 导出读同一张表，确认文种前不把纯文本排成公文。

**Architecture:** `documentLayoutSpecs.ts` 只放页面和角色的数值。`documentLayoutRole.ts` 把一行认成角色，公文委托现有 `classifyOfficialParagraph`。导出和编辑页只查表，不各写字体。文种存在单独的 localStorage 键里，确认时不改 `chartcraft-document-draft`。

**Tech Stack:** React 19、Vitest、现有 JSZip 与 `docxFormattedExport`。不新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-06-document-layout-templates-design.md`

## Global Constraints

- 排版文种只有 `official`、`contract`、`feasibility`、`general`。未确认用 `general`。
- 公文页面与 `gbt9704ExportSpec.ts` 现有常量一致：页边距上 37 / 下 35 / 左 28 / 右 26 mm，固定行距 28 磅；标题小标宋二号居中；主送黑体三号顶格；正文仿宋三号、两端对齐、首行缩进 2 字；「一、」黑体三号；「（一）」楷体且字号为 `GBT9704_SIZE_HEADING2`；「1.」「（1）」仿宋三号；发文机关右空四字，成文日期右空二字；落款前空三行。
- 合同：A4，页边距四边 2.54 cm（1440 twip），1.5 倍行距（`line` 360、`lineRule` `auto`）。合同名称宋体二号加粗居中；条标题宋体小四加粗顶格；正文宋体小四、两端对齐、首行缩进 2 字；签署栏宋体小四靠右。
- 可研：A4，页边距四边 2.5 cm（1417 twip），1.5 倍行距。报告名称黑体二号居中；章标题黑体三号顶格；正文宋体小四、两端对齐、首行缩进 2 字。
- 通用文稿：A4，页边距四边 2.54 cm，行距 1.85 倍（`line` 444、`lineRule` `auto`）。正文宋体小四；一级标题宋体四号加粗顶格；正文两端对齐、首行缩进 2 字。
- 西文一律 Times New Roman。东亚字体名写进 Word：小标宋、黑体、仿宋_GB2312、楷体_GB2312、宋体。
- 编辑页备用字体：小标宋用华文中宋、宋体；仿宋用仿宋、华文仿宋；黑体用黑体；楷体用楷体；宋体用宋体。
- 非公文表的页眉、页脚距离用 720 twip。公文继续用 `GBT9704_PAGE_MARGINS` 的 header / footer。
- 纸张尺寸保持现有 A4：`w:w="11906" w:h="16838"`。编辑页仍是一张连续白纸，不分页，不编辑页眉页脚。
- 含 `TABLE_COL_SEP`（`|`）的行是表格，不套段落角色。
- 确认文种不改写正文，也不触发「应用智能排版」。
- 文种存在 `chartcraft-document-layout-genre`。不改 `chartcraft-document-draft` 的纯文本。
- 正文出现「可行性研究」时建议可研，优先于校对文体。校对文体 `official_doc` → 公文，`contract` → 合同，其余 → 通用。任何把握都不自动写入文种键。
- 已确认文种后，导出按该表生成新 Word，不再写回原文件。未确认且有原 Word 时，保留原版式导出仍写回原文件。



## Review Focus

- 正文句子「甲方应在十日内付款。」在合同里仍是正文，不靠右。Task 2 的测试锁定。
- 未确认的纯文本导出不含 `w:line="560"`，也不含 `仿宋_GB2312`。Task 4 的测试锁定。
- 确认文种不改 `chartcraft-document-draft`。Task 3 的测试锁定。
- 含 `|` 的行不套首行缩进。Task 5 的测试锁定。
- 文种已确认时，即使要求写回原 Word，导出仍按该表生成。Task 4 的测试锁定。



## File Structure

- `src/data/documentLayoutSpecs.ts`：四种文种的页面和角色数值，以及 `getLayoutSpec`。
- `src/utils/documentLayoutRole.ts`：`layoutRoleForLine`、`suggestLayoutGenre`、文种键的读写。
- `src/utils/docxFormattedExport.ts`：`styleForKind` 改读公文表；按文种生成文档。
- `src/utils/docxExport.ts`：导出入口接收已确认文种；未确认的纯文本走通用表。
- `src/utils/documentOfficialLayout.ts`：公文预览的行内样式读公文表。
- `src/components/DocumentTextEditor.tsx`：按文种把表画到白纸上。
- `src/components/DocumentFormatPanel.tsx`：确认文种，不改正文。
- `src/components/DocumentWorkspace.tsx`：把已确认文种传给编辑页和导出。



### Task 1: 版式表

**Files:**

- Create: `src/data/documentLayoutSpecs.ts`
- Test: `src/data/documentLayoutSpecs.test.ts`

**Interfaces:**

- Consumes: `GBT9704_PAGE_MARGINS`、`GBT9704_LINE_SPACING`、`GBT9704_SIZE_TITLE`、`GBT9704_SIZE_BODY`、`GBT9704_SIZE_HEADING1`、`GBT9704_SIZE_HEADING2`、`GBT9704_SIGNATURE_ORG_RIGHT_CHARS`、`GBT9704_SIGNATURE_DATE_RIGHT_CHARS`、`GBT9704_SIGNATURE_SPACE_BEFORE`。
- Produces:
  - `export type LayoutGenre = 'official' | 'contract' | 'feasibility' | 'general'`
  - `export interface LayoutRoleStyle { fontEastAsia: string; fontAscii: 'Times New Roman'; fontFamily: string; sizeHalfPoints: number; bold: boolean; align: 'left' | 'center' | 'both' | 'right'; firstLineIndentChars: number; rightIndentChars?: number; spaceBefore?: number; spaceAfter?: number }`
  - `export interface LayoutPageSpec { marginTwip: { top: number; right: number; bottom: number; left: number; header: number; footer: number }; line: number; lineRule: 'exact' | 'auto' }`
  - `export function getLayoutSpec(genre: LayoutGenre): { genre: LayoutGenre; page: LayoutPageSpec; roles: Readonly<Record<string, LayoutRoleStyle>> }`
  - 公文 `roles` 的键覆盖 `docxFormattedExport.ts` 里现有的全部 `ParagraphKind`。把 `styleForKind` 各分支的数值原样搬进 `official`，本任务先不改导出文件。

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import {
  GBT9704_LINE_SPACING,
  GBT9704_PAGE_MARGINS,
  GBT9704_SIZE_BODY,
  GBT9704_SIZE_HEADING2,
  GBT9704_SIZE_TITLE,
} from './gbt9704ExportSpec'
import { getLayoutSpec } from './documentLayoutSpecs'

describe('getLayoutSpec', () => {
  it('keeps the official page metrics on the existing constants', () => {
    const spec = getLayoutSpec('official')
    expect(spec.page.marginTwip).toEqual(GBT9704_PAGE_MARGINS)
    expect(spec.page.line).toBe(GBT9704_LINE_SPACING)
    expect(spec.page.lineRule).toBe('exact')
    expect(spec.roles.title).toMatchObject({
      fontEastAsia: '小标宋',
      fontAscii: 'Times New Roman',
      sizeHalfPoints: GBT9704_SIZE_TITLE,
      align: 'center',
    })
    expect(spec.roles.body).toMatchObject({
      fontEastAsia: '仿宋_GB2312',
      sizeHalfPoints: GBT9704_SIZE_BODY,
      align: 'both',
      firstLineIndentChars: 200,
    })
    expect(spec.roles.heading2.sizeHalfPoints).toBe(GBT9704_SIZE_HEADING2)
    expect(spec.roles.heading2.fontEastAsia).toBe('楷体_GB2312')
  })

  it('defines contract, feasibility, and general pages from the spec', () => {
    expect(getLayoutSpec('contract').page).toMatchObject({
      marginTwip: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 720 },
      line: 360,
      lineRule: 'auto',
    })
    expect(getLayoutSpec('contract').roles.contractTitle).toMatchObject({
      fontEastAsia: '宋体', sizeHalfPoints: 44, bold: true, align: 'center', firstLineIndentChars: 0,
    })
    expect(getLayoutSpec('contract').roles.article).toMatchObject({
      fontEastAsia: '宋体', sizeHalfPoints: 24, bold: true, align: 'left', firstLineIndentChars: 0,
    })
    expect(getLayoutSpec('contract').roles.signature).toMatchObject({
      fontEastAsia: '宋体', sizeHalfPoints: 24, align: 'right',
    })
    expect(getLayoutSpec('feasibility').page.marginTwip.top).toBe(1417)
    expect(getLayoutSpec('feasibility').roles.reportTitle).toMatchObject({
      fontEastAsia: '黑体', sizeHalfPoints: 44, align: 'center',
    })
    expect(getLayoutSpec('feasibility').roles.chapter).toMatchObject({
      fontEastAsia: '黑体', sizeHalfPoints: 32, align: 'left', firstLineIndentChars: 0,
    })
    expect(getLayoutSpec('general').page).toMatchObject({ line: 444, lineRule: 'auto' })
    expect(getLayoutSpec('general').roles.heading.sizeHalfPoints).toBe(28)
    expect(getLayoutSpec('general').roles.body).toMatchObject({
      fontEastAsia: '宋体', sizeHalfPoints: 24, firstLineIndentChars: 200, align: 'both',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/documentLayoutSpecs.test.ts`
Expected: FAIL with cannot find module `./documentLayoutSpecs`

- [ ] **Step 3: Implement** `getLayoutSpec` **in** `src/data/documentLayoutSpecs.ts`

公文角色从 `styleForKind` 原样搬迁。`fontFamily` 按 Global Constraints 的备用字体写成 CSS 字体栈，并把 Word 字体名放在栈首。合同正文、可研正文、通用正文都是宋体小四、`firstLineIndentChars: 200`、`align: 'both'`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/documentLayoutSpecs.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/documentLayoutSpecs.ts src/data/documentLayoutSpecs.test.ts
git commit -m "feat: add shared layout specs for each document genre"
```



### Task 2: 认角色

**Files:**

- Create: `src/utils/documentLayoutRole.ts`
- Test: `src/utils/documentLayoutRole.test.ts`

**Interfaces:**

- Consumes: `LayoutGenre`，`classifyOfficialParagraph`。
- Produces: `export function layoutRoleForLine(genre: LayoutGenre, line: string, context?: { previousOfficialKind?: OfficialParagraphKind; isFirstContentLine?: boolean }): string | 'table'`
  - 行内含 `TABLE_COL_SEP` 时返回 `'table'`。
  - `official` 忽略 `isFirstContentLine`，返回 `classifyOfficialParagraph(line, context?.previousOfficialKind)`。
  - `contract`：`isFirstContentLine` 且不是条标题、也不是签署栏 → `contractTitle`。以「第……条」开头，或以「数字.数字」开头且行内没有 `。` → `article`。单独成行且以甲方、乙方、丙方、签字、盖章、法定代表人、授权代表开头 → `signature`。其余 → `body`。
  - `feasibility`：`isFirstContentLine` 且不是章标题 → `reportTitle`。以「第……章」或「一、」这类现有一级标题开头 → `chapter`。其余 → `body`。
  - `general`：`detectHeadingLevel` 命中 → `heading`。其余 → `body`。

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { classifyOfficialParagraph } from './docxFormattedExport'
import { layoutRoleForLine } from './documentLayoutRole'

describe('layoutRoleForLine', () => {
  it('delegates official lines to the existing classifier', () => {
    expect(layoutRoleForLine('official', '一、重点工作')).toBe(
      classifyOfficialParagraph('一、重点工作'),
    )
  })

  it('keeps a contract sentence about 甲方 as body', () => {
    expect(layoutRoleForLine('contract', '甲方应在十日内付款。', { isFirstContentLine: false })).toBe('body')
  })

  it('classifies contract title, article, and signature', () => {
    expect(layoutRoleForLine('contract', '采购合同', { isFirstContentLine: true })).toBe('contractTitle')
    expect(layoutRoleForLine('contract', '第一条 标的')).toBe('article')
    expect(layoutRoleForLine('contract', '1.1 价款')).toBe('article')
    expect(layoutRoleForLine('contract', '甲方：某某公司')).toBe('signature')
  })

  it('classifies feasibility title and chapter', () => {
    expect(layoutRoleForLine('feasibility', '某某项目可行性研究报告', { isFirstContentLine: true })).toBe('reportTitle')
    expect(layoutRoleForLine('feasibility', '第一章 总论')).toBe('chapter')
    expect(layoutRoleForLine('feasibility', '一、编制依据')).toBe('chapter')
    expect(layoutRoleForLine('feasibility', '本章说明范围。')).toBe('body')
  })

  it('does not assign a paragraph role to a table line', () => {
    expect(layoutRoleForLine('general', '甲 | 乙')).toBe('table')
  })

  it('uses the existing heading rule for a general document', () => {
    expect(layoutRoleForLine('general', '一、标题')).toBe('heading')
    expect(layoutRoleForLine('general', '普通句子。')).toBe('body')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/documentLayoutRole.test.ts`
Expected: FAIL with cannot find module `./documentLayoutRole`

- [ ] **Step 3: Implement** `layoutRoleForLine` **in** `src/utils/documentLayoutRole.ts`

签署栏用行首匹配，不用「行内包含」。条标题的「数字.数字」不要匹配「2024.10 已完成。」这种带句号的行。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/documentLayoutRole.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/documentLayoutRole.ts src/utils/documentLayoutRole.test.ts
git commit -m "feat: classify a line into the shared layout role"
```



### Task 3: 建议文种与存储

**Files:**

- Modify: `src/utils/documentLayoutRole.ts`
- Test: `src/utils/documentLayoutRole.test.ts`

**Interfaces:**

- Consumes: `LayoutGenre`。
- Produces:
  - `export const LAYOUT_GENRE_STORAGE_KEY = 'chartcraft-document-layout-genre'`
  - `export function suggestLayoutGenre(proofreadGenreId: string | null, text: string): LayoutGenre`
  - `export function readLayoutGenre(storage: Pick<Storage, 'getItem'>): LayoutGenre | null`
  - `export function writeLayoutGenre(storage: Pick<Storage, 'setItem' | 'removeItem'>, genre: LayoutGenre | null): void`
  - 非法存储值读作 `null`。`writeLayoutGenre(..., null)` 删除该键。

- [ ] **Step 1: Write the failing test**

```ts
it('suggests feasibility before the proofread genre', () => {
  expect(suggestLayoutGenre('official_doc', '关于某某可行性研究的报告')).toBe('feasibility')
  expect(suggestLayoutGenre('research', '市场调研分析')).toBe('general')
  expect(suggestLayoutGenre('official_doc', '关于放假的通知')).toBe('official')
  expect(suggestLayoutGenre('contract', '采购合同')).toBe('contract')
})

it('stores the genre without touching the draft text', () => {
  const memory = new Map<string, string>()
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value) },
    removeItem: (key: string) => { memory.delete(key) },
  }
  storage.setItem('chartcraft-document-draft', '原文')
  expect(readLayoutGenre(storage)).toBeNull()
  writeLayoutGenre(storage, 'contract')
  expect(readLayoutGenre(storage)).toBe('contract')
  expect(storage.getItem('chartcraft-document-draft')).toBe('原文')
  writeLayoutGenre(storage, null)
  expect(readLayoutGenre(storage)).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/documentLayoutRole.test.ts`
Expected: FAIL with `suggestLayoutGenre` is not defined

- [ ] **Step 3: Implement the three functions in** `src/utils/documentLayoutRole.ts`

建议顺序按 Interfaces。存储只读写 `LAYOUT_GENRE_STORAGE_KEY`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/documentLayoutRole.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/documentLayoutRole.ts src/utils/documentLayoutRole.test.ts
git commit -m "feat: suggest and store the confirmed layout genre"
```



### Task 4: 导出读版式表

**Files:**

- Modify: `src/utils/docxFormattedExport.ts`
- Modify: `src/utils/docxExport.ts`
- Test: `src/utils/documentLayoutExport.test.ts`

**Interfaces:**

- Consumes: `getLayoutSpec`、`layoutRoleForLine`、`LayoutGenre`。
- Produces:
  - `export async function createFormattedDocxFromPlainText(text: string, genre: LayoutGenre): Promise<ArrayBuffer>`
  - `exportDocumentToDocx` 的 options 增加 `layoutGenre?: LayoutGenre | null`。
  - `layoutGenre` 非空：忽略 `preferFormatted`，按该文种生成。
  - `layoutGenre` 为空且 `preferFormatted === false` 且有 `originalBuffer`：保持现有写回。
  - 其余情况按 `layoutGenre ?? 'general'` 生成。
  - `official` 仍走现有 `classifyLine` / `expandExportParts`，`styleForKind` 改为返回公文表中同名角色。
  - 合同、可研、通用按行调用 `layoutRoleForLine`。`'table'` 沿用现有表格 XML，字体改用该表的 `body.fontEastAsia`。页面 `pgMar` 和正文行距改读 `getLayoutSpec(genre).page`。

- [ ] **Step 1: Write the failing test**

用 JSZip 读出 `word/document.xml`。

```ts
it('exports an unconfirmed plain document with the general table', async () => {
  const xml = await documentXml(await exportDocumentToDocx('采购合同\n第一条 标的', {}).then((r) => r.buffer))
  expect(xml).not.toContain('w:line="560"')
  expect(xml).not.toContain('仿宋_GB2312')
  expect(xml).toContain('w:line="444"')
  expect(xml).toContain('宋体')
})

it('exports a confirmed genre even when an original buffer asks to write back', async () => {
  const original = await createFormattedDocxFromPlainText('旧公文', 'official')
  const xml = await documentXml(
    await exportDocumentToDocx('采购合同', {
      originalBuffer: original,
      preferFormatted: false,
      layoutGenre: 'contract',
    }).then((r) => r.buffer),
  )
  expect(xml).toContain('w:line="360"')
  expect(xml).toContain('宋体')
  expect(xml).not.toContain('仿宋_GB2312')
})
```

再断言 `createFormattedDocxFromPlainText('一、重点', 'official')` 的 XML 含 `w:line="560"` 与 `黑体`。

未确认且有原 Word 时，改过一个段落仍写回原文件，不换成通用表：

```ts
it('writes back into the original document when the genre is unconfirmed', async () => {
  const original = await createFormattedDocxFromPlainText('旧公文', 'official')
  const xml = await documentXml(
    await exportDocumentToDocx('旧公文改', {
      originalBuffer: original,
      originalFullText: '旧公文',
      preferFormatted: false,
      layoutGenre: null,
    }).then((r) => r.buffer),
  )
  expect(xml).toContain('w:line="560"')
  expect(xml).not.toContain('w:line="444"')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/documentLayoutExport.test.ts`
Expected: FAIL，因为 `createFormattedDocxFromPlainText` 尚不接受文种，且未确认导出仍是 560 / 仿宋。

- [ ] **Step 3: Implement genre-aware export**

`styleForKind` 只做公文表查找。合同、可研、通用不要调用 `classifyLine`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/documentLayoutExport.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/docxFormattedExport.ts src/utils/docxExport.ts src/utils/documentLayoutExport.test.ts
git commit -m "feat: export Word from the shared layout spec"
```



### Task 5: 编辑页读版式表

**Files:**

- Modify: `src/components/DocumentTextEditor.tsx`
- Test: `src/components/DocumentTextEditor.test.tsx`

**Interfaces:**

- Consumes: `getLayoutSpec`、`layoutRoleForLine`、`LayoutGenre`。
- Produces: `DocumentTextEditor` 增加可选属性 `layoutGenre?: LayoutGenre | null`。`null` 或未传按 `general` 绘制。纸张内边距由 `page.marginTwip` 换成像素（twip × 96 / 1440）。行高：`exact` 用 `${page.line / 20}pt`，`auto` 用 `page.line / 240`。每个段落用其角色的 `fontFamily`、`${sizeHalfPoints / 2}pt`、`bold`、对齐（`both` 写成 `justify`）和缩进（`firstLineIndentChars / 100` 个 em）。表格单元格不套首行缩进。

- [ ] **Step 1: Write the failing test**

在现有 `renderEditor` 上增加：

```ts
it('applies the contract table without indenting a table row', () => {
  const { host, root } = renderEditor('采购合同\n甲方应在十日内付款。\n甲 | 乙', { layoutGenre: 'contract' })
  const title = host.querySelector('p')
  expect(title?.textContent).toBe('采购合同')
  expect((title as HTMLElement).style.textAlign).toBe('center')
  expect((title as HTMLElement).style.fontSize).toBe('22pt')
  const body = host.querySelectorAll('p')[1] as HTMLElement
  expect(body.style.textAlign).toBe('justify')
  expect(body.style.textIndent).toBe('2em')
  const cell = host.querySelector('td') as HTMLElement
  expect(cell.style.textIndent).toBe('')
  act(() => { root.unmount() })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DocumentTextEditor.test.tsx`
Expected: FAIL，标题没有 `text-align: center`。

- [ ] **Step 3: Paint roles from** `getLayoutSpec`

遍历行时自己累计 `isFirstContentLine` 和公文的 `previousOfficialKind`。不把样式写进 `onChange`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/DocumentTextEditor.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/DocumentTextEditor.tsx src/components/DocumentTextEditor.test.tsx
git commit -m "feat: render the editor page from the shared layout spec"
```



### Task 6: 公文预览读同一张表

**Files:**

- Modify: `src/utils/documentOfficialLayout.ts`
- Test: `src/utils/documentOfficialLayout.test.ts`

**Interfaces:**

- Consumes: `getLayoutSpec('official')`、`classifyOfficialParagraph`（经现有 `buildOfficialLayoutHtml`）。
- Produces: `buildOfficialLayoutHtml` 仍返回按角色分的段落，并在每个段落上写入与该角色 `fontFamily`、字号、对齐一致的行内样式。

- [ ] **Step 1: Write the failing test**

```ts
import { buildOfficialLayoutHtml } from './documentOfficialLayout'

it('styles the official title from the shared spec', () => {
  const html = buildOfficialLayoutHtml('关于放假的通知')
  expect(html).toContain('22pt')
  expect(html).toContain('小标宋')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/documentOfficialLayout.test.ts`
Expected: FAIL，HTML 没有 `22pt`。

- [ ] **Step 3: Apply official role styles in** `buildOfficialLayoutHtml`

只加行内样式，不改角色分类。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/documentOfficialLayout.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/documentOfficialLayout.ts src/utils/documentOfficialLayout.test.ts
git commit -m "feat: style the official preview from the shared layout spec"
```



### Task 7: 确认文种并接到编辑和导出

**Files:**

- Modify: `src/components/DocumentFormatPanel.tsx`
- Modify: `src/components/DocumentWorkspace.tsx`
- Test: `src/components/DocumentFormatPanel.test.tsx`

**Interfaces:**

- Consumes: `suggestLayoutGenre`、`readLayoutGenre`、`writeLayoutGenre`、`LAYOUT_GENRE_STORAGE_KEY`、`LayoutGenre`。
- Produces:
  - `DocumentFormatPanel` 增加 `suggestedGenre: LayoutGenre`、`confirmedGenre: LayoutGenre | null`、`onConfirmGenre: (genre: LayoutGenre) => void`。
  - 四个按钮文案：`公文`、`合同`、`可研报告`、`通用文稿`。建议项的按钮带 `data-suggested="true"`。点击只调用 `onConfirmGenre`。
  - 说明文字：`确认后编辑页和导出使用该版式，不改正文。`
  - 工作区启动时 `readLayoutGenre(localStorage)`。确认时 `writeLayoutGenre` 并更新状态，不调用 `setContent`。
  - `DocumentTextEditor` 收到 `layoutGenre={confirmedGenre}`。
  - 「导出 Word」调用 `exportDocumentToDocx` 时传入 `layoutGenre: confirmedGenre`。`confirmedGenre === null` 且有原 Word 时仍显示「保留原版式导出」。已确认后不显示该按钮。

- [ ] **Step 1: Write the failing test**

```tsx
it('confirms a genre without asking to apply structure edits', () => {
  const confirmed: string[] = []
  const { host, root } = renderPanel({
    suggestedGenre: 'contract',
    confirmedGenre: null,
    onConfirmGenre: (genre: string) => { confirmed.push(genre) },
  })
  const suggested = host.querySelector('[data-suggested="true"]')
  expect(suggested?.textContent).toBe('合同')
  act(() => { (host.querySelector('button[data-genre="feasibility"]') as HTMLButtonElement).click() })
  expect(confirmed).toEqual(['feasibility'])
  act(() => { root.unmount() })
})
```

面板渲染沿用 `DocumentTextEditor.test.tsx` 的 `react-dom/client` 写法。四个按钮的 `data-genre` 分别为 `official`、`contract`、`feasibility`、`general`。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DocumentFormatPanel.test.tsx`
Expected: FAIL，找不到 `data-suggested`。

- [ ] **Step 3: Wire the panel and the workspace**

不改「应用智能排版」的回调。导出菜单在已确认文种后只保留「导出 Word」和「导出 TXT」。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/DocumentFormatPanel.test.tsx src/utils/documentLayoutRole.test.ts src/utils/documentLayoutExport.test.ts src/components/DocumentTextEditor.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/DocumentFormatPanel.tsx src/components/DocumentFormatPanel.test.tsx src/components/DocumentWorkspace.tsx
git commit -m "feat: confirm a layout genre for the editor and export"
```

