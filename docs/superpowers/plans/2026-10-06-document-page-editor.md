# 文本编辑 Word 式页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「文本编辑」从纯文本框换成可改字的白纸，标题和表格按现有纯文本规则显示，保存的仍是同一段纯文本。

**Architecture:** `documentPageBlocks.ts` 负责解析、拼回、字位置和键盘命令，测试全部打在这些纯函数上。`DocumentTextEditor` 只把命令结果写回现有 `onChange`，并用 `data-plain-start` / `data-plain-end` 把 DOM 选区换算回纯文本下标。工作区改为调用编辑器句柄的选区和滚动，不再读 `textarea`。

**Tech Stack:** React 19、现有 Vitest + happy-dom、`TABLE_COL_SEP`（` | `）、已有的 `detectHeadingLevel`。不新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-06-document-page-editor-design.md`

## Global Constraints

- 保存的正文仍是纯文本；白底、页边距、加粗、首行缩进、表格边框不写进草稿。
- 列分隔符就是 `TABLE_COL_SEP`（` | `）。含该分隔符的行是表格行，优先于标题。
- 标题级别只走导出的 `detectHeadingLevel`，判断前去掉行首空白，存储字符不删。
- 没改过的字符串解析后再拼回，必须逐字相同。
- 纸张：底 `#e8eef5`，宽 `min(720px, calc(100% - 32px))`，内边距 `40px 48px`，白底，边框 `1px solid #e2e8f0`，轻阴影，在编辑区内滚动，不分页。
- 正文：`SimSun`、`宋体`、`Songti SC`，16px，行距 1.85，颜色 `#1e293b`，两端对齐。行首没有空格、全角空格或制表符时首行缩进 `2em`。
- 一级标题 18px、加粗、左对齐、无缩进、段前 18px。其余标题 16px、加粗、左对齐、无缩进、段前 10px。空行高 12px。
- 表格边框 `1px solid #e2e8f0`，单元格内边距 8px，左对齐，不缩进。
- 高亮类名保持 `document-issue-highlight pending`、`document-issue-highlight adopted`、`document-ai-write-highlight`。同一字上校对区间优先于 AI 区间。
- 编辑区获得焦点时 Ctrl+Z 始终拦截浏览器撤销；没有快照时不撤销。逐字输入不记快照，不新增重做。
- 不改版式预览、公文版式、Word 导出、草稿存储键，也不改汇报和图表里的其他文本框。
- 现有 Vitest 只包含 `src/**/*.test.ts`。组件测试若使用 `.tsx`，把 `include` 扩成 `src/**/*.test.ts` 和 `src/**/*.test.tsx`。组件测试用 `react-dom/client`，不新增测试库。

## File Structure

- `src/utils/documentFormatNormalize.ts`：导出 `HeadingLevel` 与 `detectHeadingLevel`。
- `src/utils/documentPageBlocks.ts`：解析、拼回、字位置、`applyPageCommand`。
- `src/utils/documentPageBlocks.test.ts`：上述纯函数的验收。
- `src/utils/documentLocate.ts`：新增 `scrollPageToRange`，旧的文本框滚动函数留着。
- `src/utils/documentUndoKey.ts`：Ctrl+Z 在页面内如何处理。
- `src/utils/documentUndoKey.test.ts`：空栈也要拦截浏览器撤销。
- `src/components/DocumentTextEditor.tsx`：白纸编辑器，替换文本框。
- `src/components/DocumentTextEditor.test.tsx`：画出标题和表格、选区切片、粘贴、输入法、外部替换。
- `src/components/DocumentWorkspace.tsx`：改用编辑器句柄。
- `src/App.css`：只新增 `.document-page-*`，不动 `.document-editor`。
- `vitest.config.ts`：允许 `*.test.tsx`。

## Review Focus

- 中文输入未上屏时父组件重绘，已输入的临时文字被清掉。期望：组合期间不重画，`compositionend` 才写回正文。
- 自己打出的字符串被父组件原样传回，光标跳回开头。期望：回声不重建 DOM；外部换了另一段全文才整页重画。
- 编辑区里撤销栈为空时按 Ctrl+Z，浏览器仍撤销 contenteditable。期望：`preventDefault`，且不调用撤销。
- 从 Word 粘贴带 HTML。期望：只用 `text/plain`，字体和合并单元格不进正文。
- 在非全空行的空单元格开头按退格。期望：正文不变，` | ` 还在。

---

### Task 1: 解析、拼回和字位置

**Files:**
- Modify: `src/utils/documentFormatNormalize.ts`（导出 `HeadingLevel`、`detectHeadingLevel`）
- Create: `src/utils/documentPageBlocks.ts`
- Test: `src/utils/documentPageBlocks.test.ts`

**Interfaces:**
- Consumes: `detectHeadingLevel(trimmed: string): HeadingLevel | null`，`HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4'`，`TABLE_COL_SEP`。
- Produces:
  - `parseDocumentPage(text: string): DocumentPageBlock[]`
  - `serializeDocumentPage(blocks: DocumentPageBlock[]): string`
  - `locatePageOffset(text: string, offset: number): PageOffset`
  - `DocumentPageBlock`：`blank` 为 `{ kind: 'blank'; start: number; end: number }`；`paragraph` 与 `heading` 含 `text`，`heading` 另含 `level`；`table` 含 `rows`。`start`/`end` 是该行文字的下标，不含行后的换行。表格的 `start`/`end` 覆盖首行到末行文字。每个单元格含 `text`、`start`、`end`。
  - `PageOffset`：`{ blockIndex: number; offsetInBlock: number; rowIndex: number | null; cellIndex: number | null; offsetInCell: number | null }`。下标落在换行上时，`offsetInBlock` 等于上一块文字长度，行列为空。

空行是长度为 0 的行。只含空格的行是段落，不是空行。拼回用 `\n` 连接各行文字，行数与 `split('\n')` 一致，从而保留首尾换行。

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { detectHeadingLevel } from './documentFormatNormalize'
import { locatePageOffset, parseDocumentPage, serializeDocumentPage } from './documentPageBlocks'

const sample = '普通段落\n\n一、总则\n（一）范围\n1. 条目\n（1）细目\n\u3000已有缩进\n甲 |  乙 \n丙 | 丁 | 戊\n附件：说明\n'

describe('document page blocks', () => {
  it('exports the existing heading levels', () => {
    expect(detectHeadingLevel('一、总则')).toBe('h1')
    expect(detectHeadingLevel('（一）范围')).toBe('h2')
    expect(detectHeadingLevel('1. 条目')).toBe('h3')
    expect(detectHeadingLevel('（1）细目')).toBe('h4')
    expect(detectHeadingLevel('普通')).toBeNull()
  })

  it('round-trips paragraphs, blanks, headings, cell spaces, ragged rows, and a trailing newline', () => {
    expect(serializeDocumentPage(parseDocumentPage(sample))).toBe(sample)
  })

  it('keeps a space-only line as a paragraph', () => {
    const text = ' \n甲'
    const blocks = parseDocumentPage(text)
    expect(blocks[0]).toMatchObject({ kind: 'paragraph', text: ' ' })
    expect(serializeDocumentPage(blocks)).toBe(text)
  })

  it('treats a separator line as a table even when the trimmed line looks like a heading', () => {
    const blocks = parseDocumentPage('一、标题 | 不是标题')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      kind: 'table',
      rows: [{ cells: [{ text: '一、标题' }, { text: '不是标题' }] }],
    })
  })

  it('keeps leading spaces on a heading line', () => {
    const blocks = parseDocumentPage('  一、总则')
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 'h1', text: '  一、总则' })
  })

  it('maps a cell offset and an offset past the newline', () => {
    const text = '甲 | 乙\n丙'
    expect(locatePageOffset(text, 4)).toMatchObject({
      blockIndex: 0,
      rowIndex: 0,
      cellIndex: 1,
      offsetInCell: 0,
    })
    expect(locatePageOffset(text, 5)).toMatchObject({
      blockIndex: 0,
      offsetInBlock: 5,
      rowIndex: null,
      cellIndex: null,
    })
    expect(locatePageOffset(text, 6)).toMatchObject({
      blockIndex: 1,
      offsetInBlock: 0,
      rowIndex: null,
    })
    expect(text.slice(4, 7)).toBe('乙\n丙')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/documentPageBlocks.test.ts`

Expected: FAIL，`documentPageBlocks` 或导出的 `detectHeadingLevel` 不存在。

- [ ] **Step 3: Export the heading detector and implement parse, serialize, and locatePageOffset**

导出 `HeadingLevel` 与 `detectHeadingLevel`，函数体不改。实现上面的三个函数。单元格按 `split(TABLE_COL_SEP)` 拆开，不 `trim`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/documentPageBlocks.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/documentFormatNormalize.ts src/utils/documentPageBlocks.ts src/utils/documentPageBlocks.test.ts
git commit -m "feat: parse document text into page blocks"
```

### Task 2: 键盘命令

**Files:**
- Modify: `src/utils/documentPageBlocks.ts`
- Test: `src/utils/documentPageBlocks.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `parseDocumentPage`。
- Produces: `applyPageCommand(text: string, caret: PageCaret, command: 'insertText' | 'enter' | 'backspace' | 'delete' | 'tab', insertText?: string): { text: string; caret: PageCaret }`。`PageCaret` 为 `{ start: number; end: number }`。

规则：除 `tab` 外，先把 `[start, end)` 删掉，光标收到 `start`，再执行该键。`tab` 不删选区，用 `end` 决定当前格。

- 段落回车：在光标处插入 `\n`。
- 表格回车：在当前行下面加一行，列数与当前行相同，空格用 `TABLE_COL_SEP` 拼出（两列 ` | `，三列 ` |  | `）。光标到新行第一个单元格起点。不拆开当前格。
- 行首退格：上一行是表格则字符串不变；否则删掉前面的 `\n`。
- 单元格起点退格：不删分隔符。仅当该行每格都为空且光标在第一个单元格起点时删行。同表还有别的行时去掉这一行；这是该表最后一行时，把这一行换成空行。光标留在被删行原来的起点。
- Delete：行末且下一行不是表格时删掉后面的 `\n`；下一行是表格则不变。单元格末尾、后面是分隔符时不变。
- Tab：不在表格里则不变。否则移到下一格起点；已是行末则到下一行第一格；已是表的最后一格则与表格回车相同。

- [ ] **Step 1: Write the failing test**

在 `documentPageBlocks.test.ts` 增加：

```ts
import { applyPageCommand } from './documentPageBlocks'

it('splits a paragraph on enter and also splits after deleting a selection', () => {
  expect(applyPageCommand('甲乙丙', { start: 1, end: 1 }, 'enter')).toEqual({
    text: '甲\n乙丙',
    caret: { start: 2, end: 2 },
  })
  expect(applyPageCommand('甲乙丙丁', { start: 1, end: 3 }, 'enter')).toEqual({
    text: '甲\n丁',
    caret: { start: 2, end: 2 },
  })
})

it('merges into the previous line unless that line is a table', () => {
  expect(applyPageCommand('甲\n乙', { start: 2, end: 2 }, 'backspace')).toEqual({
    text: '甲乙',
    caret: { start: 1, end: 1 },
  })
  expect(applyPageCommand('甲 | 乙\n丙', { start: 6, end: 6 }, 'backspace').text).toBe('甲 | 乙\n丙')
})

it('deletes the selection and then one more character on backspace', () => {
  expect(applyPageCommand('甲乙丙', { start: 1, end: 2 }, 'backspace')).toEqual({
    text: '丙',
    caret: { start: 0, end: 0 },
  })
})

it('joins the next line on delete unless the next line is a table', () => {
  expect(applyPageCommand('甲\n乙', { start: 1, end: 1 }, 'delete')).toEqual({
    text: '甲乙',
    caret: { start: 1, end: 1 },
  })
  expect(applyPageCommand('甲\n乙 | 丙', { start: 1, end: 1 }, 'delete').text).toBe('甲\n乙 | 丙')
})

it('replaces one cell and splits a cell when the separator is inserted', () => {
  expect(applyPageCommand('甲 | 乙\n丙 | 丁', { start: 0, end: 1 }, 'insertText', '戊').text).toBe(
    '戊 | 乙\n丙 | 丁',
  )
  const inserted = applyPageCommand('甲 | 乙', { start: 1, end: 1 }, 'insertText', ' | ')
  expect(inserted.text).toBe('甲 |  | 乙')
  expect(parseDocumentPage(inserted.text)[0]).toMatchObject({
    kind: 'table',
    rows: [{ cells: [{ text: '甲' }, { text: '' }, { text: '乙' }] }],
  })
})

it('leaves an empty line when the last character of that line is deleted', () => {
  expect(applyPageCommand('前\n甲', { start: 3, end: 3 }, 'backspace')).toEqual({
    text: '前\n',
    caret: { start: 2, end: 2 },
  })
})

it('inserts an empty row of the same width on enter and on tab in the last cell', () => {
  expect(applyPageCommand('甲 | 乙 | 丙', { start: 0, end: 0 }, 'enter')).toEqual({
    text: '甲 | 乙 | 丙\n |  | ',
    caret: { start: 10, end: 10 },
  })
  expect(applyPageCommand('甲 | 乙', { start: 4, end: 4 }, 'tab')).toEqual({
    text: '甲 | 乙\n | ',
    caret: { start: 6, end: 6 },
  })
})

it('moves tab to the next cell without deleting a selection', () => {
  expect(applyPageCommand('甲 | 乙\n丙 | 丁', { start: 0, end: 1 }, 'tab')).toEqual({
    text: '甲 | 乙\n丙 | 丁',
    caret: { start: 4, end: 4 },
  })
  expect(applyPageCommand('甲 | 乙\n丙 | 丁', { start: 4, end: 4 }, 'tab').caret).toEqual({
    start: 6,
    end: 6,
  })
})

it('does not eat a separator from an empty cell unless the whole row is empty', () => {
  expect(applyPageCommand('甲 | ', { start: 4, end: 4 }, 'backspace').text).toBe('甲 | ')
  expect(applyPageCommand('甲 | 乙\n | ', { start: 6, end: 6 }, 'backspace').text).toBe('甲 | 乙')
  expect(applyPageCommand('前文\n | \n后文', { start: 3, end: 3 }, 'backspace').text).toBe('前文\n\n后文')
  expect(applyPageCommand(' | ', { start: 0, end: 0 }, 'backspace')).toEqual({
    text: '',
    caret: { start: 0, end: 0 },
  })
})
```

`甲 | 乙 | 丙` 的长度是 9，换行在下标 9，新行第一格从 10 开始。`前文\n` 长度是 3。`前\n甲` 里「甲」在下标 2，光标在它后面是 3。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/documentPageBlocks.test.ts`

Expected: FAIL，`applyPageCommand` 未定义。

- [ ] **Step 3: Implement `applyPageCommand`**

按本任务的规则实现。单元格边界上的退格和 Delete 不得删掉 ` | `。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/documentPageBlocks.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/documentPageBlocks.ts src/utils/documentPageBlocks.test.ts
git commit -m "feat: apply page editor commands to plain text"
```

### Task 3: 白纸、高亮和选区换算

**Files:**
- Create: `src/components/DocumentTextEditor.test.tsx`
- Modify: `src/components/DocumentTextEditor.tsx`
- Modify: `src/utils/documentLocate.ts`（新增 `scrollPageToRange`）
- Modify: `src/App.css`
- Modify: `vitest.config.ts`（`include` 加上 `src/**/*.test.tsx`）

**Interfaces:**
- Consumes: `parseDocumentPage`、`locatePageOffset`、`TextHighlightRange`。
- Produces:
  - `DocumentPageEditorHandle`：`getPlainSelection(): { start: number; end: number; text: string } | null`、`scrollToRange(start: number, end: number): void`、`scrollToTop(): void`
  - `plainOffsetFromNode(root: HTMLElement, node: Node, offset: number): number | null`
  - `scrollPageToRange(container: HTMLElement, marker: HTMLElement): void`
  - 编辑器改为 `forwardRef` 挂上该句柄。去掉 `editorRef` 属性。`value`、`onChange`、`highlightRange`、`aiHighlightRanges`、`onSelectionChange`、`className`、`placeholder` 保留。
  - 每个文字块带 `data-plain-start` 与 `data-plain-end`。选区文字必须是 `value.slice(start, end)`，这样分隔符和换行还在。

`scrollPageToRange`：`centeredTop = marker.offsetTop - (container.clientHeight - marker.offsetHeight) / 2`，再夹在 `0` 与 `scrollHeight - clientHeight` 之间，赋给 `container.scrollTop`。禁止 `scrollIntoView`。

行首匹配 `/^[ \t\u3000]/u` 的正文加上 `document-page-own-indent`，该修饰取消 `text-indent`。标题块带 `data-level`。表格用 `<table>`。

- [ ] **Step 1: Write the failing test**

```tsx
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { createRef } from 'react'
import { describe, expect, it } from 'vitest'
import DocumentTextEditor, { plainOffsetFromNode, type DocumentPageEditorHandle } from './DocumentTextEditor'
import { scrollPageToRange } from '../utils/documentLocate'

function renderEditor(value: string, props: Record<string, unknown> = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root: Root = createRoot(host)
  const ref = createRef<DocumentPageEditorHandle>()
  act(() => {
    root.render(<DocumentTextEditor ref={ref} value={value} onChange={() => {}} {...props} />)
  })
  return { host, root, ref }
}

describe('DocumentTextEditor page', () => {
  it('renders a heading and a table', () => {
    const { host, root } = renderEditor('一、标题\n正文\n甲 | 乙')
    const heading = host.querySelector('[data-level="h1"]')
    expect(heading?.textContent).toBe('一、标题')
    const rows = host.querySelectorAll('tr')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.querySelectorAll('td')).toHaveLength(2)
    expect(rows[0]?.textContent).toContain('甲')
    expect(rows[0]?.textContent).toContain('乙')
    act(() => root.unmount())
  })

  it('does not add a first-line indent class when the line already has indent', () => {
    const { host, root } = renderEditor('\u3000已有缩进')
    expect(host.querySelector('.document-page-own-indent')).not.toBeNull()
    act(() => root.unmount())
  })

  it('marks a proofread range with the pending class', () => {
    const { host, root } = renderEditor('甲乙丙', {
      highlightRange: { start: 1, end: 2 },
    })
    expect(host.querySelector('mark.document-issue-highlight.pending')?.textContent).toBe('乙')
    act(() => root.unmount())
  })

  it('reads a cross-table selection as a slice of the plain text', () => {
    const text = '甲 | 乙'
    const { host, ref, root } = renderEditor(text)
    const cells = host.querySelectorAll('td')
    const first = cells[0]?.firstChild as Text
    const second = cells[1]?.firstChild as Text
    expect(plainOffsetFromNode(host, first, 0)).toBe(0)
    expect(plainOffsetFromNode(host, second, 1)).toBe(5)
    const range = document.createRange()
    range.setStart(first, 0)
    range.setEnd(second, 1)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    expect(ref.current?.getPlainSelection()).toEqual({ start: 0, end: 5, text: '甲 | 乙' })
    act(() => root.unmount())
  })

  it('scrolls the page handle to the heading', () => {
    const { host, ref, root } = renderEditor('一、标题\n正文')
    const scroller = host.querySelector('.document-page-scroll') as HTMLElement
    const heading = host.querySelector('[data-level="h1"]') as HTMLElement
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 100 })
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 800 })
    Object.defineProperty(heading, 'offsetTop', { configurable: true, value: 240 })
    Object.defineProperty(heading, 'offsetHeight', { configurable: true, value: 20 })
    act(() => {
      ref.current?.scrollToRange(0, 1)
    })
    expect(scroller.scrollTop).toBe(200)
    act(() => root.unmount())
  })

  it('centers the marker inside the page scroller', () => {
    const container = document.createElement('div')
    const marker = document.createElement('div')
    Object.defineProperty(container, 'clientHeight', { value: 100 })
    Object.defineProperty(container, 'scrollHeight', { value: 800 })
    Object.defineProperty(marker, 'offsetTop', { value: 240 })
    Object.defineProperty(marker, 'offsetHeight', { value: 20 })
    scrollPageToRange(container, marker)
    expect(container.scrollTop).toBe(200)
  })
})
```

`getPlainSelection()` 必须返回 `{ start: 0, end: 5, text: '甲 | 乙' }`，不能改成允许 `null`。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DocumentTextEditor.test.tsx`

Expected: FAIL，页面组件或 `scrollPageToRange` 尚未按上述结构存在。若失败原因是 include 未包含 tsx，先改 `vitest.config.ts` 再跑，仍然应当因缺少实现而失败。

- [ ] **Step 3: Implement the page view, styles, plain offsets, and scrollPageToRange**

根节点类名 `document-page-editor`，滚动容器 `document-page-scroll`，纸张 `document-page`。样式只用 Global Constraints 里的数值，选择器都带 `.document-page` 前缀。高亮包在 `<mark>` 里。`scrollToRange` 找到 `data-plain-start <= start < data-plain-end` 的元素；找不到时用 `data-plain-end` 最大且仍 `<= start` 的元素，再调用 `scrollPageToRange`。`scrollToTop` 把滚动容器的 `scrollTop` 设为 0。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/DocumentTextEditor.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts src/App.css src/utils/documentLocate.ts src/components/DocumentTextEditor.tsx src/components/DocumentTextEditor.test.tsx
git commit -m "feat: render the document text as a page"
```

### Task 4: 输入、粘贴和输入法

**Files:**
- Modify: `src/components/DocumentTextEditor.tsx`
- Test: `src/components/DocumentTextEditor.test.tsx`

**Interfaces:**
- Consumes: `applyPageCommand`、`DocumentPageEditorHandle`。
- Produces: 无新导出。键盘在 `keydown` 里 `preventDefault` 后调用 `applyPageCommand`，再 `onChange`。粘贴读取 `text/plain`。组合输入期间跳过按 `value` 重画 DOM。

回车、Shift+回车、退格、Delete、Tab 走命令。普通字符走 `insertText`。不把这些键交给浏览器去改 DOM。`compositionstart` 到 `compositionend` 之间，即使 `value` 变化也不替换页面子节点；`compositionend` 时用该块当前文字替换它在全文中的切片并 `onChange`。父组件把刚刚 `onChange` 的同一字符串传回来时不重建 DOM；传来不同字符串时整页按新字符串重画。

- [ ] **Step 1: Write the failing test**

```tsx
it('splits at the zero caret on enter and on shift+enter', () => {
  const run = (shiftKey: boolean) => {
    let next = ''
    const { host, root } = renderEditor('甲乙', {
      onChange: (value: string) => {
        next = value
      },
    })
    const page = host.querySelector('.document-page-editor') as HTMLElement
    page.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey, bubbles: true }))
    expect(next).toBe('\n甲乙')
    act(() => root.unmount())
  }
  run(false)
  run(true)
})

it('does not call onChange for arrow keys', () => {
  let calls = 0
  const { host, root } = renderEditor('甲乙', {
    onChange: () => {
      calls += 1
    },
  })
  const page = host.querySelector('.document-page-editor') as HTMLElement
  page.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
  expect(calls).toBe(0)
  act(() => root.unmount())
})

it('pastes only plain text at the zero caret', () => {
  let next = ''
  const { host, root } = renderEditor('甲', {
    onChange: (value: string) => {
      next = value
    },
  })
  const page = host.querySelector('.document-page-editor') as HTMLElement
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
  Object.defineProperty(event, 'clipboardData', {
    value: {
      getData: (type: string) => (type === 'text/plain' ? '乙 | 丙' : '<b>乙</b>'),
    },
  })
  page.dispatchEvent(event)
  expect(next).toBe('乙 | 丙甲')
  expect(next).not.toContain('<b>')
  act(() => root.unmount())
})

it('does not rebuild the page when the parent echoes the edited string', () => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  let value = '甲乙'
  const draw = () => {
    act(() => {
      root.render(
        <DocumentTextEditor
          value={value}
          onChange={(next) => {
            value = next
          }}
        />,
      )
    })
  }
  draw()
  const page = host.querySelector('.document-page-editor') as HTMLElement
  act(() => {
    page.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  })
  const block = host.querySelector('[data-plain-start]') as HTMLElement
  block.dataset.marker = 'keep'
  draw()
  expect(host.querySelector('[data-marker="keep"]')).not.toBeNull()
  act(() => root.unmount())
})

it('keeps in-progress composition text when the parent re-renders', () => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const draw = (value: string) => {
    act(() => {
      root.render(<DocumentTextEditor value={value} onChange={() => {}} />)
    })
  }
  draw('甲')
  const page = host.querySelector('.document-page-editor') as HTMLElement
  page.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
  const block = host.querySelector('[data-plain-start]') as HTMLElement
  block.textContent = '甲乙'
  draw('完全不同的外部稿')
  expect(host.textContent).toContain('甲乙')
  expect(host.textContent).not.toContain('完全不同的外部稿')
  act(() => root.unmount())
})

it('rebuilds the page when the value changes from outside', () => {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => {
    root.render(<DocumentTextEditor value="甲" onChange={() => {}} />)
  })
  act(() => {
    root.render(<DocumentTextEditor value="全新" onChange={() => {}} />)
  })
  expect(host.textContent).toContain('全新')
  expect(host.textContent).not.toContain('甲')
  act(() => root.unmount())
})
```

没有 DOM 选区时，光标按 `{ start: 0, end: 0 }`。方向键不 `preventDefault`。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DocumentTextEditor.test.tsx`

Expected: FAIL，回车、粘贴或组合输入尚未写回。

- [ ] **Step 3: Handle keys, paste, composition, and external value changes**

记录最近一次 `onChange` 出去的字符串。`value` 与它相同则跳过重画。组合进行中一律跳过重画。粘贴 `preventDefault`，忽略 `text/html`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/DocumentTextEditor.test.tsx src/utils/documentPageBlocks.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/DocumentTextEditor.tsx src/components/DocumentTextEditor.test.tsx
git commit -m "feat: edit the document page through plain-text commands"
```

### Task 5: 接上工作区

**Files:**
- Create: `src/utils/documentUndoKey.ts`
- Create: `src/utils/documentUndoKey.test.ts`
- Modify: `src/components/DocumentWorkspace.tsx`

**Interfaces:**
- Consumes: `DocumentPageEditorHandle`。`resolveIssueRange`、`expandRangeToCjkWord` 仍从 `documentLocate.ts` 引入。
- Produces: `resolveDocumentUndoKey(args: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; key: string; target: EventTarget | null; undoCount: number }): 'ignore' | 'blocked' | 'undo'`

`target` 位于 `.document-page-editor` 内，且是 Ctrl/Cmd+Z、没有 Shift：`undoCount > 0` 返回 `'undo'`，否则 `'blocked'`。输入框、其他文本框、以及不是该快捷键的按键返回 `'ignore'`。

工作区：`editorRef` 改为 `DocumentPageEditorHandle`。局部润色用 `getPlainSelection()`，没有选区时仍用 `editorSelection`。校对定位、结构定位改为 `resolveIssueRange` 或现有的区间计算，再 `scrollToRange`；全文级提醒调用 `scrollToTop`。这些调用点目前在采纳单条、定位问题、结构改写预览、确认结构改写、定位结构条目。纸张外的表格说明、AI 高亮提示、校对定位提示的 JSX 不动。Ctrl+Z 监听先问 `resolveDocumentUndoKey`：`'undo'` 时 `preventDefault` 并 `handleUndo`；`'blocked'` 时只 `preventDefault`；`'ignore'` 时保持现在对非页面文本框的处理。`handleContentChange` 的清理逻辑不改。

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { resolveDocumentUndoKey } from './documentUndoKey'

function eventTarget(className: string, tag = 'DIV') {
  const el = document.createElement(tag)
  el.className = className
  document.body.appendChild(el)
  return el
}

describe('resolveDocumentUndoKey', () => {
  it('blocks browser undo on the page when the snapshot stack is empty', () => {
    const target = eventTarget('document-page-editor')
    expect(
      resolveDocumentUndoKey({
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        key: 'z',
        target,
        undoCount: 0,
      }),
    ).toBe('blocked')
  })

  it('undoes when the page has a snapshot', () => {
    const target = eventTarget('document-page-editor')
    expect(
      resolveDocumentUndoKey({
        ctrlKey: false,
        metaKey: true,
        shiftKey: false,
        key: 'z',
        target,
        undoCount: 1,
      }),
    ).toBe('undo')
  })

  it('ignores inputs and foreign textareas', () => {
    expect(
      resolveDocumentUndoKey({
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        key: 'z',
        target: eventTarget('', 'INPUT'),
        undoCount: 1,
      }),
    ).toBe('ignore')
    expect(
      resolveDocumentUndoKey({
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
        key: 'z',
        target: eventTarget('refine-prompt', 'TEXTAREA'),
        undoCount: 1,
      }),
    ).toBe('ignore')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/documentUndoKey.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: Implement the undo key helper and point the workspace at the page handle**

搜索 `DocumentWorkspace.tsx` 里全部 `editorRef.current`，按本任务的接口改完。页面根节点已经是 `.document-page-editor`，快捷键判断用 `closest`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/documentUndoKey.test.ts src/utils/documentPageBlocks.test.ts src/components/DocumentTextEditor.test.tsx`

Expected: PASS

再跑 `npx tsc -b --pretty false`，Expected: 无新增类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/utils/documentUndoKey.ts src/utils/documentUndoKey.test.ts src/components/DocumentWorkspace.tsx
git commit -m "feat: locate and undo from the document page"
```
