# ChartCraft · PPT Master Sidecar

为 ChartCraft 提供 **PPT Master 风格** 的可编辑 `.pptx` 生成 API（异步任务 + SVG → DrawingML 导出）。

基于 [hugohe3/ppt-master](https://github.com/hugohe3/ppt-master) 的 `finalize_svg.py` / `svg_to_pptx.py` 后处理链路，ChartCraft 前端通过 `/api/ppt-master` 代理调用。

## 快速启动（Docker，推荐）

```bash
cd services/ppt-master-api
cp .env.example .env
# 编辑 .env，填入 PPT_MASTER_LLM_API_KEY（DeepSeek / OpenAI 兼容）
docker compose up --build
```

健康检查：`http://localhost:8787/health`

## 本地开发（Windows）

1. 克隆 PPT Master 到任意目录，例如 `D:\officetool\vendor\ppt-master`
2. 安装依赖：

```powershell
cd D:\officetool\vendor\ppt-master
pip install -r requirements.txt

cd D:\officetool\services\ppt-master-api
pip install -r requirements.txt
copy .env.example .env
# 设置 PPT_MASTER_HOME=D:\officetool\vendor\ppt-master
# 设置 PPT_MASTER_LLM_API_KEY=...
```

3. 启动 API：

```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8787
```

4. 另开终端启动 ChartCraft：

```powershell
cd D:\officetool
npm run dev
```

## 渲染模式

| 模式 | 环境变量 | 说明 |
|------|----------|------|
| **ai_svg**（默认） | `PPT_MASTER_RENDER_MODE=ai_svg` | Strategist 设计规范 + LLM **逐页**生成 SVG，接近官方 PPT Master 视觉 |
| template | `PPT_MASTER_RENDER_MODE=template` | 内置 Python 模板 SVG，速度快、效果较平 |

**推荐配置（高视觉）：**

- **规划**：DeepSeek / 任意便宜模型（结构、页型）
- **视觉**：Claude Sonnet / Opus 或 GPT-4o（通过 OpenAI 兼容网关）

```env
PPT_MASTER_LLM_MODEL=deepseek-chat
PPT_MASTER_RENDER_MODE=ai_svg
PPT_MASTER_VISUAL_API_URL=https://your-gateway/v1/chat/completions
PPT_MASTER_VISUAL_API_KEY=sk-...
PPT_MASTER_VISUAL_MODEL=claude-sonnet-4-20250514
```

10 页 `ai_svg` 约 **5–15 分钟**（视视觉模型速度）；`template` 约 1–3 分钟。

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 服务与 PPT Master / LLM / 渲染模式状态 |
| GET | `/styles` | 可选视觉风格 |
| POST | `/jobs` | `multipart`: `file`, `prompt`, `style` |
| GET | `/jobs/{id}` | 任务进度 |
| GET | `/jobs/{id}/download` | 下载 `.pptx` |

## 流程（ai_svg）

```
上传 PDF/DOCX/MD/TXT
  → 解析为 Markdown
  → LLM 规划页型结构
  → Strategist 设计规范（palette / motif）
  → LLM 逐页生成 SVG（1280×720）
  → PPT Master finalize_svg + svg_to_pptx
  → 可编辑 .pptx
```

单页 SVG 解析失败时自动回退到内置模板页。

## 说明

- 任务串行执行（`max_workers=1`）。
- MIT 协议：使用 PPT Master 脚本时请保留上游署名。
