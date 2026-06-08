import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Multimodal AI Gateway API"
    API_V1_STR: str = "/api/v1"
    
    # Ollama settings
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2:latest")
    
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    
    class Config:
        case_sensitive = True

settings = Settings()
