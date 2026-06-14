from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ppt_master_api_host: str = "0.0.0.0"
    ppt_master_api_port: int = 8787
    ppt_master_home: str = ""
    ppt_master_llm_api_url: str = "https://api.deepseek.com/v1/chat/completions"
    ppt_master_llm_api_key: str = ""
    ppt_master_llm_model: str = "deepseek-chat"
    ppt_master_llm_timeout: float = 180.0
    # ai_svg = LLM 逐页生成 SVG（高视觉）；template = 内置模板（快速）
    ppt_master_render_mode: str = "ai_svg"
    # 视觉生成可用更强模型（留空则沿用 ppt_master_llm_model）
    ppt_master_visual_api_url: str = ""
    ppt_master_visual_api_key: str = ""
    ppt_master_visual_model: str = ""
    ppt_master_data_dir: str = "./data"


settings = Settings()
