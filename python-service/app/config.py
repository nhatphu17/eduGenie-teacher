"""Configuration settings"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""
    
    # API Settings
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_PREFIX: str = "/api/v1"
    
    # OpenAI
    OPENAI_API_KEY: str
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-large"
    OPENAI_EMBEDDING_DIMENSIONS: int = 3072
    
    # Database (MySQL)
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    
    # File Processing
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
    UPLOAD_DIR: str = "./uploads"
    TEMP_DIR: str = "./temp"
    
    # Chunking
    CHUNK_SIZE: int = 1000  # tokens (~3000 chars)
    CHUNK_OVERLAP: int = 200  # tokens (~600 chars)
    MAX_CHUNKS_PER_DOCUMENT: int = 100
    
    # Processing
    PROCESSING_TIMEOUT: int = 300  # seconds
    MAX_RETRIES: int = 3
    
    # NestJS Backend
    NESTJS_API_URL: str = "http://localhost:3001/api"
    NESTJS_API_KEY: Optional[str] = None  # For authentication if needed
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

