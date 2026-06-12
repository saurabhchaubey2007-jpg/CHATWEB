from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    embedding_model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    chroma_persist_dir: str = "./chroma_db"
    chroma_collection_name: str = "chatweb_webpages"
    chunk_size: int = 1000
    chunk_overlap: int = 200
    retriever_k: int = 5
    temperature: float = 0.2
    model_name: str = "gemini-2.5-flash"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()