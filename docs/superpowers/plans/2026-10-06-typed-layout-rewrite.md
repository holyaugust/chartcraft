# 按文档类型改写后再编辑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 认出公文、合同、可研报告后整理已有结构，确认才写入「文本编辑」；已排好版的 Word 可以只改文字并写回原文件。

**Architecture:** 识别与改写是纯函数。`documentLayoutRewrite` 决定要不要预览并产出新正文。工作区只负责选择、预览和确认。蓝框用类型样式类绘制。只改文字时，改变行数或列数的命令在进入 `applyPageCommand` 之前被拦住。

**Tech Stack:** React 19、Vitest + happy-dom、现有 `detectDocumentGenre`、`normalizeDocumentStructure`、`applyPageCommand`、`createFormattedDocxFromPlainText`。不新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-06-typed-layout-rewrite-design.md`

## Global Constraints

- 只自动改写公文、合同、可研报告；把握高指 `confidence === 'high'`。
- 不编造原文没有的主送、落款、条款或章节，不把段落放进「其他原文」。
- 公文空标题下的占位句是「（请在此补充具体内容。）」。
- 确认替换前不写正文；取消回到抽出的原文。
- 字体和对齐只用于显示。按类型排版确认后隐藏「公文版式」标签，「版式预览」保留。
- 「只改文字」拦住回车拆行、并行、删整行、插表行和改变列数。
- 正文草稿键仍是 `chartcraft-document-draft` 的纯文本。排版选择存在新键 `chartcraft-document-layout`。
- 确认替换后的导出不再做第二次结构改写。只有「只改文字」写回原 Word。

## Review Focus

- 把握为 `medium` 的公文不得改写。
- 预览里改选类型后，在确认前正文保持抽出的原文。
- 「只改文字」时粘贴含换行的文字不得拆行。
- 确认之后继续打字不得再次改写结构。
- 没有原 Word 的 AI 稿不得出现「只改文字，保留原版式」。

## File Structure

- `src/data/documentProofreadGenres.ts`：增加 `feasibility` / `可研报告`。
- `src/utils/documentGenreDetect.ts`：可研识别规则，以及 AI 识别允许的 id。
- `src/utils/documentLayoutRewrite.ts`：三种整理、预览决定、手动改选。
- `src/utils/documentLayoutChoice.ts`：`chartcraft-document-layout` 的读写。
- `src/utils/documentPreserveEdit.ts`：只改文字时的命令拦截。
- `src/utils/documentTypedExport.ts`：按类型生成新 Word，不再整理正文。
- `src/components/DocumentLayoutBar.tsx`：入口选择、识别说明、确认和取消。
- `src/components/DocumentTextEditor.tsx`：类型样式类，并把拦截后的命令交给现有键盘逻辑。
- `src/components/DocumentWorkspace.tsx`：把选择、预览和导出接上。
- `src/App.css`：三种类型的字体和对齐。

---

### Task 1: 可研报告识别

**Files:**
- Modify: `src/data/documentProofreadGenres.ts`
- Modify: `src/utils/documentGenreDetect.ts`
- Test: `src/utils/documentGenreDetect.test.ts`

**Interfaces:**
- Consumes: 现有 `detectDocumentGenre(text: string, isTableDocument?: boolean) => GenreDetectionResult`
- Produces: `DocumentProofreadGenreId` 含 `'feasibility'`；标签「可研报告」

- [ ] **Step 1: Write the failing test**

```ts
it('detects a feasibility study with high confidence', () => {
  const result = detectDocumentGenre(
    '可行性研究报告\n第一章 总论\n本项目概况。\n投资估算与资金筹措\n财务分析',
  )
  expect(result.genreId).toBe('feasibility')
  expect(result.label).toBe('可研报告')
  expect(result.confidence).toBe('high')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/documentGenreDetect.test.ts`
Expected: FAIL，`feasibility` 不是合法文体或识别结果不是它

- [ ] **Step 3: Add the genre and a weight-3 rule**

规则至少包含 `/可行性研究/u`、`/投资估算/u`、`/资金筹措/u`、`/财务评价|财务分析/u`。`STANDARD_FOCUS.feasibility` 与 `DEEP_FOCUS.feasibility` 各写三条以内的校对关注点。AI 识别提示和合法 id 列表加入 `feasibility`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/documentGenreDetect.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/documentProofreadGenres.ts src/utils/documentGenreDetect.ts src/utils/documentGenreDetect.test.ts
git commit -m "feat: detect feasibility study documents"
```

### Task 2: 三种整理和预览决定

**Files:**
- Create: `src/utils/documentLayoutRewrite.ts`
- Test: `src/utils/documentLayoutRewrite.test.ts`

**Interfaces:**
- Consumes: `normalizeDocumentStructure(text: string) => string`；`GenreDetectionResult`
- Produces:
  - `export type LayoutGenre = 'official_doc' | 'contract' | 'feasibility'`
  - `rewriteDocumentForGenre(text: string, genre: LayoutGenre) => string`
  - `layoutRewriteOffer(detection: GenreDetectionResult) => { kind: 'preview'; genre: LayoutGenre; label: string } | { kind: 'keep'; message: '未识别为公文、合同或可研报告，已保持原文' }`

- [ ] **Step 1: Write the failing test**

覆盖：已分行的合同与可研字符串不变；`第一条 标的 采购设备。` 变成 `第一条 标的\n采购设备。`；`甲方：甲公司 乙方：乙公司` 变成两行；`第一章 总论 本项目位于深圳。` 变成 `第一章 总论\n本项目位于深圳。`；公文原文没有「主送」时结果里也不出现「主送」；只有标题没有正文的公文层次补上「（请在此补充具体内容。）」；`confidence: 'medium'` 的 `official_doc` 得到 `kind: 'keep'`；`confidence: 'high'` 的 `contract` 得到预览。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/documentLayoutRewrite.test.ts`
Expected: FAIL，模块不存在

- [ ] **Step 3: Implement the rewriters and offer**

公文调用 `normalizeDocumentStructure`。合同只拆已有的当事人、`第…条`、`数字.数字` 条目和签署栏。可研只拆已有的 `第…章`、「一、」和带空格的 `1.` 标题。不改标题用字，不重编号。`layoutRewriteOffer` 仅在 `confidence === 'high'` 且 id 为三种之一时返回预览。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/documentLayoutRewrite.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/documentLayoutRewrite.ts src/utils/documentLayoutRewrite.test.ts
git commit -m "feat: rewrite detected documents without inventing sections"
```

### Task 3: 记住排版选择

**Files:**
- Create: `src/utils/documentLayoutChoice.ts`
- Test: `src/utils/documentLayoutChoice.test.ts`

**Interfaces:**
- Consumes: `LayoutGenre`
- Produces:
  - `export const DOCUMENT_LAYOUT_KEY = 'chartcraft-document-layout'`
  - `export type DocumentLayoutChoice = { mode: 'format' | 'preserve'; genre: LayoutGenre | null; confirmed: boolean }`
  - `loadDocumentLayoutChoice(): DocumentLayoutChoice | null`
  - `saveDocumentLayoutChoice(choice: DocumentLayoutChoice): void`
  - `showOfficialLayoutTab(choice: DocumentLayoutChoice | null): boolean`

- [ ] **Step 1: Write the failing test**

保存 `{ mode: 'format', genre: 'contract', confirmed: true }` 后再读出同一对象。没有记录时返回 `null`。不读写 `chartcraft-document-draft`。`showOfficialLayoutTab({ mode: 'format', genre: 'official_doc', confirmed: true })` 为 false；`confirmed: false` 或 `mode: 'preserve'` 为 true。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/documentLayoutChoice.test.ts`
Expected: FAIL，模块不存在

- [ ] **Step 3: Implement localStorage JSON read and write**

坏 JSON 时返回 `null`。`showOfficialLayoutTab` 仅在 `mode === 'format'` 且 `confirmed` 时返回 false。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/documentLayoutChoice.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/documentLayoutChoice.ts src/utils/documentLayoutChoice.test.ts
git commit -m "feat: remember the document layout choice"
```

### Task 4: 只改文字时拦住改结构

**Files:**
- Create: `src/utils/documentPreserveEdit.ts`
- Test: `src/utils/documentPreserveEdit.test.ts`

**Interfaces:**
- Consumes: `applyPageCommand`、`PageCaret`、`PageCommand`
- Produces: `guardPreserveCommand(text: string, caret: PageCaret, command: PageCommand, insertText?: string) => { text: string; caret: PageCaret; blocked: boolean }`

- [ ] **Step 1: Write the failing test**

`甲` 的末尾回车被拦住，字符串仍是 `甲`，`blocked` 为 true。在 `甲` 中插入 `乙` 得到 `甲乙`，`blocked` 为 false。粘贴 `乙\n丙` 被拦住。向 `甲 | 乙` 的格子插入 ` | ` 被拦住。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/documentPreserveEdit.test.ts`
Expected: FAIL，模块不存在

- [ ] **Step 3: Implement the guard**

先算 `applyPageCommand` 的结果。行数变化，或任一行的 ` | ` 出现次数变化，则返回原文字、原光标和 `blocked: true`。否则返回命令结果和 `blocked: false`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/documentPreserveEdit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/documentPreserveEdit.ts src/utils/documentPreserveEdit.test.ts
git commit -m "feat: block structural edits when preserving Word layout"
```

### Task 5: 蓝框按类型显示

**Files:**
- Modify: `src/App.css`
- Modify: `src/components/DocumentTextEditor.tsx`
- Test: `src/components/DocumentTextEditor.test.tsx`

**Interfaces:**
- Consumes: `LayoutGenre | null`
- Produces: `DocumentTextEditor` 新属性 `layoutGenre?: LayoutGenre | null`。页面根节点在有类型时带 `document-page-genre-official`、`document-page-genre-contract` 或 `document-page-genre-feasibility`。

- [ ] **Step 1: Write the failing test**

传入 `layoutGenre="contract"` 时，`.document-page` 含有 `document-page-genre-contract`。样式表中该选择器下的正文为宋体，条目为加粗且无缩进。公文选择器含小标宋、黑体、楷体、仿宋。可研选择器的正文字体为宋体。在合同样式下于「第一条 标的」末尾输入「甲」，`onChange` 得到的字符串以「甲」结尾，且仍含「第一条 标的」，不被整理成另一种章节。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DocumentTextEditor.test.tsx -t "layout genre"`
Expected: FAIL，属性或类名不存在

- [ ] **Step 3: Add the prop, class, and CSS**

不改变无 `layoutGenre` 时的现有通用样式。样式不写入正文回调。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/DocumentTextEditor.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.css src/components/DocumentTextEditor.tsx src/components/DocumentTextEditor.test.tsx
git commit -m "feat: style the document page for the detected type"
```

### Task 6: 选择条、预览和确认

**Files:**
- Create: `src/components/DocumentLayoutBar.tsx`
- Test: `src/components/DocumentLayoutBar.test.tsx`
- Modify: `src/components/DocumentWorkspace.tsx`
- Modify: `src/components/DocumentTextEditor.tsx`

**Interfaces:**
- Consumes: `layoutRewriteOffer`、`rewriteDocumentForGenre`、`DocumentLayoutChoice`、`guardPreserveCommand`、`LayoutGenre`
- Produces: 条上的按钮文案「按类型排版」「只改文字，保留原版式」「确认替换」「取消」

- [ ] **Step 1: Write the failing test**

`DocumentLayoutBar` 在 `phase: 'choose'` 且 `hasOriginalWord` 为 true 时渲染两个选择。`hasOriginalWord` 为 false 时不渲染「只改文字，保留原版式」。`phase: 'preview'` 且标签为「合同」时渲染「识别为合同」「确认替换」「取消」，以及公文、合同、可研三个改选项。点「可研报告」只调用 `onSelectGenre('feasibility')`，不调用 `onConfirm`。`phase: 'keep'` 时渲染「未识别为公文、合同或可研报告，已保持原文」。`phase: 'preserve'` 时渲染「按类型排版」，不渲染「确认替换」。`phase: 'editing'` 且已确认时不渲染「只改文字，保留原版式」。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/DocumentLayoutBar.test.tsx`
Expected: FAIL，组件不存在

- [ ] **Step 3: Implement the bar and wire it**

上传 Word 后 `phase` 为 `choose`，蓝框仍是抽出的原文。AI 稿和模板稿跳过 `choose`。点「按类型排版」调用 `layoutRewriteOffer`。预览阶段把 `rewriteDocumentForGenre` 的结果只传给编辑器显示，不调用 `setContent`。确认时先记撤销快照，再 `setContent`，并保存 `{ mode: 'format', genre, confirmed: true }`。取消时清掉预览。改选类型只更新预览。已确认的稿打开时不再预览，也不再提供「只改文字」。`phase: 'preserve'` 的「按类型排版」重新进入预览。`mode: 'preserve'` 时键盘命令走 `guardPreserveCommand`；`blocked` 时设置说明「要改结构请改选按类型排版」。确认后的格式稿用 `showOfficialLayoutTab` 隐藏「公文版式」按钮。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/DocumentLayoutBar.test.tsx src/components/DocumentTextEditor.test.tsx src/utils/documentLayoutRewrite.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/DocumentLayoutBar.tsx src/components/DocumentLayoutBar.test.tsx src/components/DocumentWorkspace.tsx src/components/DocumentTextEditor.tsx
git commit -m "feat: confirm a typed rewrite before editing"
```

### Task 7: 按类型导出

**Files:**
- Create: `src/utils/documentTypedExport.ts`
- Test: `src/utils/documentTypedExport.test.ts`
- Modify: `src/components/DocumentWorkspace.tsx`

**Interfaces:**
- Consumes: `createFormattedDocxFromPlainText(text: string) => Promise<ArrayBuffer>`；`LayoutGenre`；`exportDocxFromBuffer`
- Produces: `exportTypedDocument(text: string, genre: LayoutGenre) => Promise<ArrayBuffer>`

- [ ] **Step 1: Write the failing test**

合同导出的 `word/document.xml` 含宋体，且正文段落不含仿宋。输入在导出前后不被整理函数改写：对同一字符串调用导出，文件中的文字顺序与输入行一致。公文导出与 `createFormattedDocxFromPlainText` 的 `word/document.xml` 文本相同。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/documentTypedExport.test.ts`
Expected: FAIL，模块不存在

- [ ] **Step 3: Implement export without a second rewrite**

`official_doc` 直接调用 `createFormattedDocxFromPlainText`。合同和可研按蓝框字体生成段落，不调用 `rewriteDocumentForGenre`。工作区在 `mode: 'preserve'` 时仍走 `exportDocxFromBuffer`；已确认的按类型排版走 `exportTypedDocument`。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/utils/documentTypedExport.test.ts src/utils/documentLayoutRewrite.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/documentTypedExport.ts src/utils/documentTypedExport.test.ts src/components/DocumentWorkspace.tsx
git commit -m "feat: export the confirmed document in its type style"
```
