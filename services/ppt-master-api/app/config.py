from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# 固定指向 services/ppt-master-api/.env，不依赖启动时的 cwd
_SIDECAR_ROOT = Path(__file__).resolve().parent.parent
_ENV_FILE = _SIDECAR_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ppt_master_api_host: str = "0.0.0.0"
    ppt_master_api_port: int = 8787
    ppt_master_home: str = ""
    ppt_master_llm_api_url: str = "https://api.deepseek.com/v1/chat/completions"
    ppt_master_llm_api_key: str = ""
    ppt_master_llm_model: str = "deepseek-chat"
    ppt_master_llm_timeout: float = 180.0
    # ai_svg = LLM 逐页生成 SVG（高视觉）；template = 内置模板（快速）
    ppt_master_render_mode: str = "ai_svg"
    # Executor 逐页 SVG（端点/Key 可单独配置；模型名固定走 PPT_MASTER_VISION_MODEL）
    ppt_master_executor_api_url: str = ""
    ppt_master_executor_api_key: str = ""
    ppt_master_executor_model: str = ""
    ppt_master_visual_api_url: str = ""
    ppt_master_visual_api_key: str = ""
    ppt_master_visual_model: str = ""
    ppt_master_data_dir: str = "./data"

    # DeepSeek 视觉版（多模态 design spec · 参考图分析）
    ppt_master_vision_enabled: bool = False
    ppt_master_vision_model: str = "deepseek-v4-flash"
    ppt_master_vision_api_url: str = ""
    ppt_master_vision_api_key: str = ""

    # 千帆 · 百度文库智能 PPT
    qianfan_api_key: str = ""
    qianfan_api_base: str = "https://qianfan.baidubce.com"
    qianfan_request_timeout: float = 900.0


settings = Settings()
