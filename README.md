# CHATWEB

CHATWEB is a browser extension that allows users to chat with any website using AI. The extension extracts website content, stores embeddings in a vector database, retrieves relevant context, and generates answers using Gemini.

## Features

* Chat with any website
* Website content extraction
* Retrieval-Augmented Generation (RAG)
* Semantic search using ChromaDB
* Context-aware question answering
* User-provided Gemini API key (BYOK)

## Tech Stack

### Frontend

* HTML
* CSS
* JavaScript
* Chrome Extension API

### Backend

* FastAPI
* LangChain
* ChromaDB
* Sentence Transformers
* Gemini API

## Project Structure

```text
CHATWEB/
│
├── backend/
│   ├── main.py
│   ├── rag.py
│   ├── models.py
│   └── ...
│
├── extension/
│   ├── manifest.json
│   ├── content.js
│   ├── popup.html
│   ├── popup.js
│   └── ...
│
├── requirements.txt
└── README.md
```

## Setup

### 1. Clone Repository

```bash
git clone https://github.com/saurabhchaubey2007-jpg/CHATWEB.git
cd CHATWEB
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Start Backend

```bash
cd backend
uvicorn main:app --reload
```

Backend will run at:

```text
http://127.0.0.1:8000
```

### 4. Load Extension

#### Chrome

1. Open:

```text
chrome://extensions
```

2. Enable Developer Mode

3. Click:

```text
Load unpacked
```

4. Select the `extension` folder

#### Firefox

1. Open:

```text
about:debugging
```

2. Click:

```text
This Firefox
```

3. Click:

```text
Load Temporary Add-on
```

4. Select `manifest.json` from the extension folder

## Author

Saurabh Chaubey
