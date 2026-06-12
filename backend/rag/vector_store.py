from langchain_community.vectorstores import Chroma

from rag.embeddings import embeddings


vector_store = Chroma(
    collection_name="web_content",
    embedding_function=embeddings,
    persist_directory="./chroma_db"
)