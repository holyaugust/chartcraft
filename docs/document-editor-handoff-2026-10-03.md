# 文档编辑模块交接（2026-10-03）

> 供新聊天引用的短交接稿。不是完整聊天记录。  
> 仓库：`holyaugust/chartcraft` · 分支：`Doctemplate` · 提交：`a370dca`

## 1. 当前同步状态

- 本地与 `origin/Doctemplate` 在推送后已对齐（ahead/behind `0/0`）。
- 工作区在交接时点干净；若之后又有未提交改动，以 `git status` 为准。
- 本机 Git 对 GitHub 配了代理：`http.https://github.com.proxy=http://127.0.0.1:10090`。代理未开时 `fetch/push` 会失败。  
  推送可用临时绕过（**不要擅自改 git config**）：
  ```powershell
  git -c "http.https://github.com.proxy=" -c "http.proxy=" -c "https.proxy=" push
  ```
  若仍失败，可用 `gh auth token` 做 Basic 认证头再推。

## 2. 产品形态（现状）

文档主路径由**流程条**驱动，右侧显示对应内容：

| 步骤 | 作用 |
|------|------|
| 准备文档 | AI 写文书 / 上传 Word / 套用模板；有稿时可重新上传 |
| 结构梳理 | 大纲·逻辑·缺口·建议；建议可「智能优化」确认后写入 |
| 智能校对 | 先确认文体与提示词；结果侧栏采纳后才写入 |
| 智能排版 | GB/T 9704 检查预览；确认后写入；导出可用排版 Word |
| 导出 Word | 导出文件下拉：排版 Word / 原版式 / TXT |

信息架构约定（本轮已改）：

- **去掉**顶部与流程条重复的步骤按钮。
- **去掉**侧栏与流程条同名的 Tab（校对结果 / 结构梳理 / 智能排版）。
- 步骤页右侧只显示该步面板；导出等非步骤页保留「文档信息 / 职场模板」（两者都有时才显示切换 Tab）。
- 侧栏「局部优化」贯穿有稿阶段，不完全绑定某一步。

相关 Canvas（可选打开）：

- `C:\Users\DELL\.cursor\projects\d-officetool\canvases\document-feature-review.canvas.tsx`（功能评价）
- `C:\Users\DELL\.cursor\projects\d-officetool\canvases\document-edit-methods.canvas.tsx`（编辑方式盘点）

## 3. 本轮已落地的主要改动

提交信息：`Expand document editing into a structure, proofread, format, and export workflow.`（38 files）

含但不限于：

- `DocumentWorkflowBar`：五步流程导航与提示。
- 结构 / 校对 / 排版面板与确认写入。
- 局部优化（`DocumentLocalRefineCard`）与提问分析分流。
- 公文版式预览、格式化导出、文体识别与校对方案弹窗等。
- **结构建议应用后**：左侧绿色高亮写入处；可再点「已应用」建议定位（片段存会话态 `structureAppliedSnippets`）。

## 4. 编辑文档的方式（速查）

**起稿/换稿：** AI 写文书（大纲/全文）、上传 Word、套用模板、重新上传、本地草稿恢复。  
**人工：** 文本编辑区键入/粘贴、Ctrl+Z（部分写入可撤）。  
**局部 AI：** 侧栏优化改写；提问分析默认不写，可再「应用为改写」。  
**流程写入：** 结构建议确认、校对采纳、排版确认应用。  
**只看不改：** 版式预览 / 公文版式；导出不算编辑。

易混点：局部优化 vs 结构「智能优化」都能改正文；校对/排版默认二次确认才写。

## 5. Superpowers 评价待办（未实现）

总评：骨架够用；短板是「做完后找不到、记不住、回不去」，优先可追溯与状态持久化，而不是再堆 AI 能力。

| 优先级 | 题目 | 建议方向 |
|--------|------|----------|
| P0 | 回「准备文档」会盖成空状态 | 有稿时显示当前稿 + 换稿操作，不藏编辑器 |
| P0 | 结构已应用改动易丢定位 | 持久化「建议→写入片段」；支持再定位 |
| P1 | 进度与完成态不一致 | 校对/排版/结构完成指纹统一持久化 |
| P1 | 【】占位无导航 | 待填占位列表，导出前可提示 |
| P1 | 局部优化与结构优化入口重叠 | 文案与入口分工：选区润色 vs 章节改写 |
| P1 | 导出前缺改动摘要 | 相对原稿/字数/是否已排版摘要 |
| P2 | 排版侧栏预览截断 | 完整预览引导到左侧「公文版式」 |
| P2 | 撤销隐蔽 | 可见「撤销上次写入」 |

建议落地顺序：先做两条 P0。开干前按 Superpowers：`brainstorming` 短设计 → 用户点头 → 再改代码。

## 6. 关键代码入口

- 工作区总控：`src/components/DocumentWorkspace.tsx`
- 流程条：`src/components/DocumentWorkflowBar.tsx`
- 结构 / 校对 / 排版：`DocumentStructurePanel.tsx` / `DocumentIssuePanel.tsx` / `DocumentFormatPanel.tsx`
- 局部优化：`DocumentLocalRefineCard.tsx`、`src/utils/documentLocalRefine.ts`
- 结构分析与补丁：`src/utils/documentStructureAnalysis.ts`
- 样式：`src/App.css`（文档相关大段）

## 7. 新聊天建议开场

可复制：

```text
请先阅读 docs/document-editor-handoff-2026-10-03.md。
当前在 Doctemplate（a370dca）。按交接文档继续；若改功能先走 Superpowers brainstorming，设计点头后再实现。
我想先做：P0「准备步骤有稿不盖空状态」或 P0「结构已应用持久定位」（二选一）。
```
