from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


def create_chunks(
    content: str,
    url: str,
    title: str,
):

    document = Document(
        page_content=content,
        metadata={
            "url": url,
            "title": title
        }
    )

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200
    )

    return splitter.split_documents([document])