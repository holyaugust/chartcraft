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

**推荐配置（性价比 · DeepSeek 规划 + 阿里百炼 Executor）：**

```env
# 规划 + Strategist
PPT_MASTER_LLM_API_URL=https://api.deepseek.com/v1/chat/completions
PPT_MASTER_LLM_API_KEY=sk-你的DeepSeekKey
PPT_MASTER_LLM_MODEL=deepseek-chat

# Executor 逐页 SVG（阿里百炼官方 OpenAI 兼容）
PPT_MASTER_EXECUTOR_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
PPT_MASTER_EXECUTOR_API_KEY=sk-你的百炼Key
PPT_MASTER_EXECUTOR_MODEL=qwen-max
PPT_MASTER_RENDER_MODE=ai_svg
```

百炼 API Key：[控制台 → API-KEY 管理](https://help.aliyun.com/zh/model-studio/get-api-key)

**其它网关（七牛 / OpenRouter 等）：**

```env
PPT_MASTER_LLM_MODEL=deepseek-chat
PPT_MASTER_RENDER_MODE=ai_svg
PPT_MASTER_EXECUTOR_API_URL=https://your-gateway/v1/chat/completions
PPT_MASTER_EXECUTOR_API_KEY=sk-...
PPT_MASTER_EXECUTOR_MODEL=claude-sonnet-4-6
```

旧变量 `PPT_MASTER_VISUAL_*` 仍兼容，等同于 `EXECUTOR_*`。

### DeepSeek 视觉版（参考图风格）

当 `PPT_MASTER_VISION_ENABLED=true` 且任务传入 `reference_image_url`（公网图片 HTTPS 链接，如千帆模板封面）时，Strategist 使用 **多模态模型**（默认 `deepseek-v4-flash`）分析参考图并生成 `design_spec`，再交给 Executor 逐页画 SVG。

```env
PPT_MASTER_VISION_ENABLED=true
PPT_MASTER_VISION_MODEL=deepseek-v4-flash
# 留空则沿用 PPT_MASTER_LLM_API_URL / API_KEY
```

Strategist 与 Executor 逐页 SVG 均使用 `PPT_MASTER_VISION_MODEL`（默认 `deepseek-v4-flash`）；结构规划仍用 `PPT_MASTER_LLM_MODEL`（如 `deepseek-chat`）。

支持 `generation_mode=replica`：上传 PPT 页面截图逐页高保真还原为可编辑 SVG → PPTX。

10 页 `ai_svg` 约 **5–15 分钟**（视视觉模型速度）；`template` 约 1–3 分钟。

## 千帆 PPT 引擎（可选）

在 Sidecar `.env` 中配置 `QIANFAN_API_KEY` 后，前端 **PPT 美化 → 千帆 PPT** 将全流程调用百度文库智能 PPT API：

1. `get_ppt_theme` — 加载文库模板
2. `generate_outline` — 生成大纲（SSE）
3. `generate_ppt_by_outline` — 排版并导出 pptx
4. Sidecar 下载 pptx 至本地任务目录，前端从 `/qianfan/jobs/{id}/download` 取回

本地材料会先解析为文本并写入 `query`；若需「严格依从」模式，可后续配置公网 `resource_url`（如 BOS）。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/qianfan/health` | 千帆 Key 是否已配置 |
| GET | `/qianfan/themes` | 文库 PPT 模板列表 |
| POST | `/qianfan/jobs` | 创建千帆 PPT 任务 |
| GET | `/qianfan/jobs/{id}` | 任务进度 |
| GET | `/qianfan/jobs/{id}/download` | 下载 `.pptx` |

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 服务与 PPT Master / LLM / 渲染模式状态 |
| GET | `/styles` | 可选视觉风格 |
| POST | `/jobs` | `multipart`: `file`, `prompt`, `style`, 可选 `reference_image_url`、`reference_images[]`、`generation_mode` |
| GET | `/jobs/{id}` | 任务进度 |
| GET | `/jobs/{id}/download` | 下载 `.pptx` |

## 流程（ai_svg）

```
上传 PDF/DOCX/MD/TXT
  → 解析为 Markdown
  → LLM 规划页型结构（DeepSeek）
  → Strategist 设计规范（deepseek-v4-flash；有参考图时附带视觉分析）
  → Executor 逐页生成 SVG（deepseek-v4-flash）
  → 或 replica 模式：参照页截图 → 视觉逐页还原 SVG
  → PPT Master finalize_svg + svg_to_pptx
  → 可编辑 .pptx
```

单页 SVG 解析失败时自动回退到内置模板页。

## 说明

- 任务串行执行（`max_workers=1`）。
- MIT 协议：使用 PPT Master 脚本时请保留上游署名。
