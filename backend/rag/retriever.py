from rag.vector_store import vector_store


def get_retriever(k: int = 5):
    return vector_store.as_retriever(search_kwargs={"k": k})