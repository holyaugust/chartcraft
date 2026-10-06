# 文档编辑使用引导 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在文档编辑里加入由用户主动打开的分步引导、下一步清单和示例演练，演练退出或刷新后回到原稿。

**Architecture:** 五步文案、引导状态机和演练暂存都是不依赖 DOM 的纯模块，由 `scripts/check-document-guide.ts` 断言。`DocumentGuide` 只负责菜单、聚光灯、清单和演练顶栏。`DocumentWorkspace` 持有引导状态，并在换上示例稿之前把三个正式本地存储键写入暂存。

**Tech Stack:** React 19、TypeScript、Vite、现有 `localStorage` 键。不新增测试框架。验证脚本用 Node 24 的 `node --experimental-strip-types`。

**Spec:** `docs/superpowers/specs/2026-10-03-document-guide-design.md`

## Global Constraints

- 进入文档编辑不自动弹出任何引导。
- 引导状态只有 `off` | `spotlight` | `checklist` | `practice`，同时只有一种。再次点当前项则关闭。从演练关闭或改选时直接恢复原稿，不另弹确认框。
- 按钮文案：`使用引导`。菜单项：`分步引导`、`下一步清单`、`示例演练`。顶栏：`演练中`、`退出并恢复原稿`。失败文案：`暂时无法开始演练`、`原稿尚未恢复`。
- 暂存键：`chartcraft-document-practice-stash`。正式键：`chartcraft-document-draft`、`chartcraft-document-structure`、`chartcraft-document-format-done`。
- 示例稿含 `准是参加` 和 `【联系人】`。演练从 `structure` 开始。不修复「回到准备文档会盖住已有正文」。
- `beginPracticeStash` 成功返回 `{ ok: true }`，失败返回 `{ ok: false }`。失败时不载入示例稿。
- `isStalePracticeResult(activeEpoch, resultEpoch)` 在两个序号不一致时返回 `true`。
- 纯模块之间不要互相 import，这样 Node 能直接加载。`src` 里其余 import 保持现有的无扩展名写法。验证脚本 import 必须带 `.ts` 后缀。
- 脚本命令：`node --experimental-strip-types scripts/check-document-guide.ts`。`npm run build` 必须通过。

## Review Focus

- 刷新时若先读正式草稿再恢复暂存，用户会看到示例稿。`readDocumentDraft` 必须先恢复。Task 2 的脚本覆盖这一点。
- 离开文档编辑页时若只靠 setState 恢复，其他功能会读到示例稿。Task 4 在卸载 cleanup 里同步调用 `recoverPracticeStash`。
- 演练退出后，梳理、校对、排版、结构优化和局部优化的迟到结果仍可能写回原稿。Task 4 在这五个异步函数里用进入时捕获的序号调用 `isStalePracticeResult`。
- 聚光灯的遮罩若挡住流程条，替代说明里让用户去点的步骤就点不到。遮罩不接收指针事件，只有说明卡片接收。Task 5 在浏览器里点被提示的流程步骤。
- 演练中用户自己点「准备文档」仍会看到现有空状态。这是已知行为，不要用禁用流程条来绕开。点「退出并恢复原稿」后正文必须回到进入前。Task 5 覆盖。

## File Structure

- Create `src/utils/documentGuideMode.ts`：状态切换与序号比较。
- Create `src/data/documentGuideSteps.ts`：五步文案、完成判断、聚光灯目标。
- Create `src/data/documentGuideSample.ts`：示例通知全文。
- Create `src/utils/documentPracticeStash.ts`：暂存、恢复、先恢复再读草稿。
- Create `src/utils/documentPracticeMemory.ts`：内存快照类型。
- Create `src/components/DocumentGuide.tsx`：菜单、聚光灯、清单、演练顶栏。
- Create `scripts/check-document-guide.ts`：纯函数断言。
- Modify `src/components/DocumentWorkflowBar.tsx`：流程步骤 `data-guide`。
- Modify `src/components/DocumentEmptyState.tsx`：空状态入口 `data-guide`。
- Modify `src/components/DocumentStructurePanel.tsx`、`DocumentIssuePanel.tsx`、`DocumentFormatPanel.tsx`：侧栏主操作 `data-guide`。
- Modify `src/components/DocumentWorkspace.tsx`：引导状态、进入/退出演练、序号、恢复时机。
- Modify `src/App.css`：引导样式。

---

### Task 1: 引导状态、五步文案与示例稿

**Files:**
- Create: `src/utils/documentGuideMode.ts`
- Create: `src/data/documentGuideSteps.ts`
- Create: `src/data/documentGuideSample.ts`
- Create: `scripts/check-document-guide.ts`

**Interfaces:**
- Consumes: 无
- Produces:
  - `export type DocumentGuideMode = 'off' | 'spotlight' | 'checklist' | 'practice'`
  - `export type DocumentGuideChoice = Exclude<DocumentGuideMode, 'off'>`
  - `export function selectDocumentGuide(current: DocumentGuideMode, choice: DocumentGuideChoice): { mode: DocumentGuideMode; restorePractice: boolean }`
  - `export function isStalePracticeResult(activeEpoch: number, resultEpoch: number): boolean`
  - `export type DocumentGuideStepId = 'prepare' | 'structure' | 'proofread' | 'format' | 'export'`
  - `export interface DocumentGuideStep { id: DocumentGuideStepId; title: string; action: string; doneWhen: string; missingHint: string }`
  - `export const DOCUMENT_GUIDE_STEPS: readonly DocumentGuideStep[]`
  - `export function guideStepDone(stepId: DocumentGuideStepId, input: { hasContent: boolean; structureFingerprint: string | null; contentFingerprint: string; proofreadCompleted: boolean; formatCompleted: boolean }): boolean`
  - `export function spotlightTargetId(stepId: DocumentGuideStepId, hasContent: boolean): string`
  - `export function resolveSpotlightTarget(stepId: DocumentGuideStepId, hasContent: boolean, isPresent: (guideId: string) => boolean): { highlightId: string | null; extraHint: string | null }`
  - `export const DOCUMENT_GUIDE_SAMPLE: string`

- [ ] **Step 1: Write the failing script**

创建 `scripts/check-document-guide.ts`，用带 `.ts` 后缀的 import 引用上面三个模块，并断言：

- `selectDocumentGuide('practice', 'checklist')` 为 `{ mode: 'checklist', restorePractice: true }`
- `selectDocumentGuide('spotlight', 'spotlight')` 为 `{ mode: 'off', restorePractice: false }`
- `selectDocumentGuide('practice', 'practice')` 为 `{ mode: 'off', restorePractice: true }`
- `selectDocumentGuide('off', 'spotlight')` 为 `{ mode: 'spotlight', restorePractice: false }`
- `isStalePracticeResult(2, 1)` 为 `true`，`isStalePracticeResult(2, 2)` 为 `false`
- `DOCUMENT_GUIDE_STEPS` 的 id 顺序为 `prepare`、`structure`、`proofread`、`format`、`export`
- `guideStepDone('prepare', emptyInput)` 为 `false`；`hasContent: true` 时为 `true`
- `guideStepDone('structure', …)` 仅当 `structureFingerprint === contentFingerprint` 且两者非空时为 `true`
- `guideStepDone('proofread', …)` 等于 `proofreadCompleted`
- `guideStepDone('format', …)` 等于 `formatCompleted`
- `guideStepDone('export', …)` 恒为 `false`
- `spotlightTargetId('prepare', false)` 为 `prepare-cards`；`spotlightTargetId('prepare', true)` 为 `workflow-prepare`
- `spotlightTargetId('structure' | 'proofread' | 'format' | 'export', true)` 依次为 `action-structure`、`action-proofread`、`action-format`、`action-export`
- `resolveSpotlightTarget('export', false, (id) => id === 'workflow-export')` 的 `highlightId` 为 `workflow-export`，`extraHint` 含 `导出文件`
- `resolveSpotlightTarget('structure', true, (id) => id === 'action-structure')` 的 `highlightId` 为 `action-structure`，`extraHint` 为 `null`
- `resolveSpotlightTarget('structure', true, () => false)` 的 `highlightId` 为 `null`，`extraHint` 非空
- `DOCUMENT_GUIDE_SAMPLE` 同时包含 `准是参加` 和 `【联系人】`

`emptyInput` 为 `{ hasContent: false, structureFingerprint: null, contentFingerprint: '', proofreadCompleted: false, formatCompleted: false }`。断言失败时 `throw new Error`，通过时打印 `document guide checks passed`。

- [ ] **Step 2: Run the script to verify it fails**

Run: `node --experimental-strip-types scripts/check-document-guide.ts`  
Expected: FAIL，因为模块尚不存在。

- [ ] **Step 3: Implement the three modules**

`selectDocumentGuide`：`current === choice` 时 `mode` 为 `off`，否则 `mode` 为 `choice`。`restorePractice` 为 `current === 'practice'`。

`isStalePracticeResult`：返回 `activeEpoch !== resultEpoch`。

五步文案：

| id | title | action | doneWhen | missingHint |
|----|-------|--------|----------|-------------|
| prepare | 准备文档 | 从「AI 写文书」「上传 Word」或「套用模板」得到正文。 | 编辑区里已有正文。 | 三个入口在流程条的「准备文档」这一步。 |
| structure | 结构梳理 | 在右侧点击「开始梳理」，查看大纲和建议；写入前需要确认。 | 已有与当前正文匹配的结构分析结果。 | 点流程条「结构梳理」后，右侧会出现「开始梳理」。 |
| proofread | 智能校对 | 在右侧启动校对，先确认文体和提示词，再提交。 | 这一轮校对已经跑完。 | 点流程条「智能校对」后，右侧会出现「开始智能校对」。 |
| format | 智能排版 | 在右侧点击「开始排版」，确认后再写入正文。 | 排版完成标记与当前正文一致。 | 点流程条「智能排版」后，右侧会出现「开始排版」。 |
| export | 导出 Word | 点右上角「导出文件」，选择一种格式。 | 点「导出文件」并选择一种格式即可。 | 有正文后，右上角会出现「导出文件」。 |

`guideStepDone` 按上表的完成信号实现。`export` 永远返回 `false`。

`resolveSpotlightTarget`：首选 `spotlightTargetId`。存在则 `extraHint` 为 `null`。否则若 `workflow-${stepId}` 存在，高亮它并带上该步 `missingHint`。都不存在则 `highlightId` 为 `null`，`extraHint` 为 `missingHint`。

`DOCUMENT_GUIDE_SAMPLE` 为下面这篇短通知，保留错字和占位：

```text
关于召开第四季度工作例会的通知

各部门：

定于10月10日上午9:00在三楼会议室召开第四季度工作例会。请各部门负责人准是参加，并准备本季度工作总结。

一、通报第三季度工作完成情况
二、研究第四季度重点任务

请于10月8日前将参会人员名单报办公室【联系人】。

办公室
2026年10月3日
```

- [ ] **Step 4: Run the script to verify it passes**

Run: `node --experimental-strip-types scripts/check-document-guide.ts`  
Expected: 打印 `document guide checks passed`。

- [ ] **Step 5: Commit**

```bash
git add src/utils/documentGuideMode.ts src/data/documentGuideSteps.ts src/data/documentGuideSample.ts scripts/check-document-guide.ts
git commit -m "Add document guide steps and mode selection."
```

---

### Task 2: 演练暂存与恢复

**Files:**
- Create: `src/utils/documentPracticeStash.ts`
- Modify: `scripts/check-document-guide.ts`

**Interfaces:**
- Consumes: 无（不 import Task 1 的模块）
- Produces:
  - `export const PRACTICE_STASH_KEY = 'chartcraft-document-practice-stash'`
  - `export const DOCUMENT_DRAFT_KEY = 'chartcraft-document-draft'`
  - `export const DOCUMENT_STRUCTURE_KEY = 'chartcraft-document-structure'`
  - `export const DOCUMENT_FORMAT_DONE_KEY = 'chartcraft-document-format-done'`
  - `export type PracticeStashFailure = 'corrupt' | 'write'`
  - `export function beginPracticeStash(storage: Storage): { ok: true } | { ok: false }`
  - `export function recoverPracticeStash(storage: Storage): { ok: true; restored: boolean } | { ok: false; reason: PracticeStashFailure }`
  - `export function readDocumentDraft(storage: Storage): string`
  - `export function consumePracticeRecoverNotice(): PracticeStashFailure | null`

暂存 JSON：`{ version: 1, draft: string | null, structure: string | null, formatDone: string | null }`。`null` 表示当时键不存在，恢复时 `removeItem`。

- [ ] **Step 1: Add failing assertions**

在同一脚本里增加一个内存 `Storage`。断言：

- 已有三个正式键时，`beginPracticeStash` 返回 `{ ok: true }`，随后改写正式键，`recoverPracticeStash` 还原原值、删除暂存，并返回 `{ ok: true, restored: true }`。再调用一次恢复，返回 `{ ok: true, restored: false }`，正式键仍是原值。
- 三个正式键都不存在时开始暂存，再写入示例正文，恢复后三个键都不存在。
- `setItem` 在写入暂存键时抛错：`beginPracticeStash` 返回 `{ ok: false }`，正式键保持原值。
- 暂存值为 `{`：`recoverPracticeStash` 返回 `{ ok: false, reason: 'corrupt' }`，正式键不变，暂存键仍在。`consumePracticeRecoverNotice()` 为 `'corrupt'`，再调用为 `null`。
- 恢复写回正式键时 `setItem` 抛错：返回 `{ ok: false, reason: 'write' }`，暂存键仍在。
- 正式键已被改成示例稿时，`readDocumentDraft` 返回暂存里的原稿。

- [ ] **Step 2: Run the script to verify it fails**

Run: `node --experimental-strip-types scripts/check-document-guide.ts`  
Expected: FAIL，因为暂存模块尚不存在。

- [ ] **Step 3: Implement `documentPracticeStash.ts`**

`beginPracticeStash` 只读三个正式键并写入暂存，不修改正式键。`setItem` 抛错则返回 `{ ok: false }`。

`recoverPracticeStash` 没有暂存时返回 `{ ok: true, restored: false }`。JSON 无法解析，或 `version !== 1`，或三个字段不是 `string | null`：不写正式键，保留暂存，记下 `'corrupt'`。写回过程抛错：保留暂存，记下 `'write'`。成功则写回或删除三个键，再删除暂存。

`readDocumentDraft` 先调用 `recoverPracticeStash`，再返回正式正文键，缺失时返回 `''`。

`consumePracticeRecoverNotice` 返回并清掉最近一次失败原因。成功恢复不设置通知。

- [ ] **Step 4: Run the script to verify it passes**

Run: `node --experimental-strip-types scripts/check-document-guide.ts`  
Expected: 打印 `document guide checks passed`。

- [ ] **Step 5: Commit**

```bash
git add src/utils/documentPracticeStash.ts scripts/check-document-guide.ts
git commit -m "Restore the real document draft after practice."
```

---

### Task 3: 引导界面与聚光灯目标

**Files:**
- Create: `src/components/DocumentGuide.tsx`
- Modify: `src/components/DocumentWorkflowBar.tsx`
- Modify: `src/components/DocumentEmptyState.tsx`
- Modify: `src/components/DocumentStructurePanel.tsx`
- Modify: `src/components/DocumentIssuePanel.tsx`
- Modify: `src/components/DocumentFormatPanel.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: Task 1 的 `DocumentGuideMode`、`DocumentGuideChoice`、`DOCUMENT_GUIDE_STEPS`、`guideStepDone`、`resolveSpotlightTarget`
- Produces:

```tsx
export interface DocumentGuideProps {
  mode: DocumentGuideMode
  spotlightIndex: number
  workflowStep: DocumentWorkflowStep
  hasContent: boolean
  contentFingerprint: string
  structureFingerprint: string | null
  proofreadCompleted: boolean
  formatCompleted: boolean
  onSelect: (choice: DocumentGuideChoice) => void
  onClose: () => void
  onSpotlightIndexChange: (index: number) => void
  onExitPractice: () => void
}
export default function DocumentGuide(props: DocumentGuideProps): JSX.Element
```

- [ ] **Step 1: Mark spotlight targets**

在流程步骤的外层 `li` 上设置 `data-guide={`workflow-${step.id}`}`，可点击和不可点击的步骤都要有。

`DocumentEmptyState` 的 `.document-empty-state-grid` 设置 `data-guide="prepare-cards"`。

`DocumentStructurePanel` 的「开始梳理」按钮设置 `data-guide="action-structure"`。

`DocumentIssuePanel` 里两处启动校对的按钮（空状态「开始智能校对」和标题栏「开始校对」）都设置 `data-guide="action-proofread"`。

`DocumentFormatPanel` 的「开始排版」按钮设置 `data-guide="action-format"`。

- [ ] **Step 2: Implement `DocumentGuide`**

菜单按钮放在组件根上，文案 `使用引导`，`aria-expanded` 与 `aria-haspopup="menu"` 对齐现有导出菜单。菜单三项调用 `onSelect`。当前项再点由父组件按 `selectDocumentGuide` 关闭。

`mode === 'spotlight'` 时，用 `DOCUMENT_GUIDE_STEPS[spotlightIndex]` 和 `resolveSpotlightTarget`。`isPresent` 在 `.panel-document` 内用 `[data-guide="…"]` 判断。有 `highlightId` 时用 `getBoundingClientRect` 画框，并在 scroll 与 resize 时更新。说明卡片含该步 `title`、`action`，以及非空的 `extraHint`。按钮：非末步为 `下一步`，末步为 `完成`（`完成` 调用 `onClose`）。另有 `跳过` 和 `关闭`，两者都调用 `onClose`。遮罩 `pointer-events: none`，说明卡片 `pointer-events: auto`。

`mode === 'checklist'` 时在组件内渲染卡片，标题 `下一步`。正文用 `DOCUMENT_GUIDE_STEPS` 里 `id === workflowStep` 的 `action` 与 `doneWhen`。`guideStepDone` 为真时显示完成标记。导出步不显示完成标记。关闭按钮调用 `onClose`。

`mode === 'practice'` 时渲染顶栏，文案 `演练中`，按钮 `退出并恢复原稿` 调用 `onExitPractice`。该按钮不因外部 `busy` 而禁用。

- [ ] **Step 3: Add CSS**

在 `src/App.css` 的文档段落增加 `.document-guide-menu`、`.document-guide-spotlight`、`.document-guide-checklist`、`.document-guide-practice`。颜色沿用现有文档工具栏，不新引进一套主题。

- [ ] **Step 4: Typecheck the new component**

Run: `npx tsc -b --pretty false`  
Expected: 退出码 0。`DocumentGuide` 此步尚未挂到页面，能通过类型检查即可。

- [ ] **Step 5: Commit**

```bash
git add src/components/DocumentGuide.tsx src/components/DocumentWorkflowBar.tsx src/components/DocumentEmptyState.tsx src/components/DocumentStructurePanel.tsx src/components/DocumentIssuePanel.tsx src/components/DocumentFormatPanel.tsx src/App.css
git commit -m "Add the document guide menu, spotlight, and checklist."
```

---

### Task 4: 把演练接进文档工作区

**Files:**
- Create: `src/utils/documentPracticeMemory.ts`
- Modify: `src/components/DocumentWorkspace.tsx`
- Modify: `src/components/DocumentGuide.tsx`（仅当导出按钮必须由工作区渲染时；优先把 `data-guide="action-export"` 放在现有「导出文件」按钮上，由本任务修改工作区）

**Interfaces:**
- Consumes: Task 1 的 `selectDocumentGuide`、`isStalePracticeResult`、`DOCUMENT_GUIDE_SAMPLE`；Task 2 的 `beginPracticeStash`、`recoverPracticeStash`、`readDocumentDraft`、`consumePracticeRecoverNotice`；Task 3 的 `DocumentGuide`
- Produces: `export interface DocumentPracticeMemory`，字段为进入演练时要原样收回的界面：`content`、`workflowStep`、`issues`、`proofreadGenreLabel`、`proofreadCompleted`、`contentOrigin`、`sidebarPanel`、`adoptedIssueIds`、`viewMode`、`docxBuffer`、`docxFileName`、`textDriftedFromDocx`、`importedText`、`importedRawText`、`activeTemplateId`、`structureReport`、`structureAppliedSuggestions`、`structureAppliedSnippets`、`structureAnalyzedAt`、`structureFingerprint`、`formatReport`、`formatCompleted`、`highlightRange`、`aiHighlightRanges`、`undoPast`（`{ content: string; adoptedIssueIds: string[] }[]`）

- [ ] **Step 1: Add the memory type and draft loader**

`documentPracticeMemory.ts` 只导出上面的接口，不 import React。

把 `DocumentWorkspace` 的 `loadDocumentDraft` 改为调用 `readDocumentDraft(localStorage)`。挂载后的 effect 调用 `consumePracticeRecoverNotice()`，非 `null` 时状态栏显示 `原稿尚未恢复`，并标为错误。

增加卸载 effect：cleanup 同步调用 `recoverPracticeStash(localStorage)`。这个 effect 不依赖引导状态。

- [ ] **Step 2: Hold guide state and the practice epoch**

工作区状态：`guideMode` 初始 `off`，`spotlightIndex` 初始 `0`。`practiceEpochRef` 初始 `0`。`practiceMemoryRef` 初始 `null`。

`handleSelectGuide(choice)`：

1. `const decision = selectDocumentGuide(guideMode, choice)`
2. `decision.restorePractice` 时先 `exitPractice()`
3. `decision.mode === 'practice'` 时调用 `enterPractice()`；返回 `false` 则停止，不改 `guideMode`
4. `decision.mode === 'spotlight'` 时把 `spotlightIndex` 设为 `0`
5. 设置 `guideMode` 为 `decision.mode`

`onClose` 走 `handleSelectGuide`，当当前是 `spotlight` 或 `checklist` 时传入该项自身，从而关成 `off`。当前是 `practice` 时不使用这条路径。

标题行 `.document-panel-title` 右侧、现有工具栏按钮左侧渲染 `DocumentGuide`。导出按钮加 `data-guide="action-export"`。清单卡片由 `DocumentGuide` 渲染；工作区把 `contentFingerprint` 设为 `fingerprintDocumentContent(content)`。

- [ ] **Step 3: Enter and exit practice**

`enterPractice` 顺序固定：

1. `beginPracticeStash(localStorage)`。失败则状态栏显示 `暂时无法开始演练`，返回 `false`。此时还不改正文，也不清结构键。
2. 把当前界面写入 `practiceMemoryRef`，包括 `undoPastRef`、`importedTextRef`、`importedRawTextRef` 和 `docxBuffer`。
3. `practiceEpochRef.current += 1`
4. 关闭写文书、模板、校对方案、导出菜单、排版确认弹窗。
5. 清空本轮内存中的校对、结构、排版、高亮和撤销；调用已有的 `clearStoredStructureAnalysis()` 与 `clearFormatCompleted()`。这两次清除发生在暂存成功之后。
6. `setContent(DOCUMENT_GUIDE_SAMPLE)`，`setWorkflowStep('structure')`，`setViewMode('text')`，`setSidebarPanel('structure')`，`setContentOrigin('none')`，清掉 Word 缓冲与文件名。
7. 返回 `true`。

保留现有 400ms 的 `saveDocumentDraft` effect。演练中的示例稿可以写入正式正文键，因为原稿还在暂存里。

`exitPractice`：

1. `practiceEpochRef.current += 1`
2. `recoverPracticeStash(localStorage)`
3. 用内存快照写回全部对应 state 与 ref，然后把 `practiceMemoryRef` 设为 `null`
4. 恢复失败时状态栏显示 `原稿尚未恢复`。没有快照时只依赖第 2 步写回的正式键，并把 `content` 设为 `readDocumentDraft(localStorage)`。

顶栏「退出并恢复原稿」调用 `exitPractice` 后把 `guideMode` 设为 `off`。

- [ ] **Step 4: Drop stale async writes**

在 `runReview`、`runStructureAnalysis`、`handleOptimizeStructureSuggestion`、`runFormatAnalysis`、`handleLocalRefine` 的 `await` 之前读取 `const epoch = practiceEpochRef.current`。每个会写入正文或结果状态的返回点，先判断 `isStalePracticeResult(practiceEpochRef.current, epoch)`，为真则直接返回，不 `setContent`、不 `setIssues`、不 `setStructureReport`、不 `setFormatReport`。

- [ ] **Step 5: Run the script and the build**

Run: `node --experimental-strip-types scripts/check-document-guide.ts`  
Expected: 打印 `document guide checks passed`。

Run: `npm run build`  
Expected: 退出码 0。

- [ ] **Step 6: Commit**

```bash
git add src/utils/documentPracticeMemory.ts src/components/DocumentWorkspace.tsx src/components/DocumentGuide.tsx
git commit -m "Open document practice without replacing the saved draft."
```

---

### Task 5: 浏览器里走通三条引导

**Files:**
- Modify: 仅当 Task 5 发现偏差时，改 Task 3 和 Task 4 已列出的文件

**Interfaces:**
- Consumes: Task 4 完成后的文档编辑页
- Produces: 无新接口

- [ ] **Step 1: Start the dev server and open 文档编辑**

Run: `npm run dev`  
在浏览器打开本地页面，进入「文档编辑」。确认没有自动弹出引导，工具栏有「使用引导」。

- [ ] **Step 2: Exercise spotlight and checklist**

打开分步引导。没有正文时，第一步框住三个入口。点到「导出 Word」，页面上没有「导出文件」时，说明里出现「有正文后，右上角会出现「导出文件」」，并且仍能点到流程条。`下一步`、末步 `完成`、`跳过`、`关闭` 都能离开或前进。再打开「下一步清单」，它只描述当前流程步骤；切换流程步骤时文案跟着变。再次点「下一步清单」后卡片关闭。打开一种引导时，另一种关掉。

- [ ] **Step 3: Exercise practice against a real draft**

先在编辑区输入一段能识别的正文，例如 `原稿保留句`。打开示例演练，编辑区变为含 `准是参加` 的通知，顶栏为「演练中」，当前步骤是「结构梳理」。在开发者工具确认 `chartcraft-document-practice-stash` 存在，且其中 `draft` 含 `原稿保留句`。点「退出并恢复原稿」后，编辑区回到 `原稿保留句`，暂存键删除。

再次进入演练，刷新页面。正文回到 `原稿保留句`，暂存键不存在。

再次进入演练，切换到其他工作区，再回到文档编辑。正文仍是 `原稿保留句`。

演练中点流程条「准备文档」。可以出现现有空状态。再点「退出并恢复原稿」，正文回到 `原稿保留句`。

- [ ] **Step 4: Re-run checks after any fix**

Run: `node --experimental-strip-types scripts/check-document-guide.ts`  
Expected: 打印 `document guide checks passed`。

Run: `npm run build`  
Expected: 退出码 0。

- [ ] **Step 5: Commit any fixes**

若本任务改了文件，单独提交：`Fix document guide behavior found in the browser.` 没有改动则不提交。
