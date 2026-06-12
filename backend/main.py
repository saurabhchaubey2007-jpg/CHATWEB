from html.parser import HTMLParser
from urllib.request import Request, urlopen

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from rag.chunking import create_chunks
from rag.vector_store import vector_store
from rag.retriever import get_retriever
from rag.chains import generate_answer, validate_gemini_api_key

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    message: str
    api_key: str = Field(..., min_length=1)


class IngestRequest(BaseModel):
    url: str
    title: str
    content: str


class QueryRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    question: str
    api_key: str = Field(..., min_length=1)


class ValidateApiKeyRequest(BaseModel):
    api_key: str = Field(..., min_length=1)


class ValidateApiKeyResponse(BaseModel):
    valid: bool
    message: str


class ExtractRequest(BaseModel):
    url: str


class ExtractResponse(BaseModel):
    url: str
    content: str


class SimpleTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript", "header", "footer", "nav", "aside", "form"}:
            self.skip_depth += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript", "header", "footer", "nav", "aside", "form"} and self.skip_depth > 0:
            self.skip_depth -= 1

    def handle_data(self, data):
        text = data.strip()
        if text and self.skip_depth == 0:
            self.parts.append(text)

    def get_text(self):
        return " ".join(self.parts)


def extract_text_from_url(url: str) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0"
        }
    )

    with urlopen(request, timeout=20) as response:
        html = response.read().decode("utf-8", errors="ignore")

    extractor = SimpleTextExtractor()
    extractor.feed(html)
    return extractor.get_text()


@app.get("/")
def home():
    return {
        "status": "Backend Running"
    }


@app.post("/ingest")
def ingest(req: IngestRequest):

    chunks = create_chunks(
        content=req.content,
        url=req.url,
        title=req.title
    )

    vector_store.add_documents(chunks)

    return {
        "status": "success",
        "chunks_stored": len(chunks)
    }


@app.post("/extract", response_model=ExtractResponse)
def extract(req: ExtractRequest):
    if not req.url.strip():
        raise HTTPException(status_code=400, detail="URL cannot be empty.")

    try:
        content = extract_text_from_url(req.url.strip())

        if not content:
            raise HTTPException(status_code=400, detail="No readable content found at the provided URL.")

        return ExtractResponse(url=req.url.strip(), content=content)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to extract content: {exc}") from exc


@app.post("/ask")
def ask(req: QueryRequest):

    docs = get_retriever().invoke(
        req.question
    )

    context = "\n\n".join(
        doc.page_content
        for doc in docs
    )

    answer = generate_answer(
        context,
        req.question,
        req.api_key,
    )

    return {
        "answer": answer
    }


@app.post("/chat")
def chat(req: ChatRequest):

    docs = get_retriever().invoke(
        req.message
    )

    context = "\n\n".join(
        doc.page_content
        for doc in docs
    )

    answer = generate_answer(
        context,
        req.message,
        req.api_key,
    )

    return {
        "reply": answer
    }


@app.post("/validate-api-key", response_model=ValidateApiKeyResponse)
def validate_api_key(req: ValidateApiKeyRequest):
    try:
        is_valid = validate_gemini_api_key(req.api_key.strip())

        if not is_valid:
            return ValidateApiKeyResponse(valid=False, message="Invalid API key.")

        return ValidateApiKeyResponse(valid=True, message="API key is valid.")
    except Exception:
        return ValidateApiKeyResponse(valid=False, message="Invalid API key or Gemini request failed.")