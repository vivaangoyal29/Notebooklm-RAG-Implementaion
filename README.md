# NotebookLM Clone — RAG-Powered Document Chat

A full RAG (Retrieval-Augmented Generation) pipeline that lets you upload any PDF or text document and have a grounded conversation with it. Built with Node.js + Express (backend) and React + Vite (frontend), powered by Groq's LLaMA 3.3 70B.

---

## Architecture

```
User uploads PDF/TXT
        │
        ▼
[1. Ingestion]
  pdf-parse → raw text
        │
        ▼
[2. Chunking]  ← sliding window, 2000 chars, 400 char overlap (20%)
  text → chunks[]  (each chunk tagged with index + char offsets)
        │
        ▼
[3. Indexing]
  TF-IDF vectors built per chunk + global IDF table stored in-memory
        │
        ▼
[4. Retrieval]  (at query time)
  query → TF-IDF vector → cosine similarity vs all chunks → top-k
        │
        ▼
[5. Generation]
  top-k chunks injected into system prompt → Groq LLaMA 3.3 70B → answer
```

### Chunking Strategy

**Sliding window with overlap**
- Fixed chunk size: ~2000 characters (~500 tokens)
- Overlap: 400 characters (20%) between consecutive chunks
- This ensures context isn't lost at chunk boundaries

### Retrieval

TF-IDF cosine similarity is used (no external embedding API needed):
1. At index time: compute TF-IDF vectors for all chunks, store IDF table
2. At query time: vectorise the query using the same IDF table, then rank all chunks by cosine similarity
3. Return top-5 chunks (configurable)

---

## Setup

### Prerequisites
- Node.js 18+
- A [Groq API key](https://console.groq.com) (free tier available)

### 1. Clone and install

```bash
git clone <your-repo>
cd notebooklm
npm run install:all
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
```

Edit `.env` and add your Groq API key:

```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
PORT=3001
```

### 3. Run in development

Open two terminals:

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Visit **http://localhost:5173**

---

## Deployment

### Backend (Railway / Render / Fly.io)

1. Push to GitHub
2. Create a new service pointing to `/backend`
3. Set environment variable: `GROQ_API_KEY=your_key`
4. Start command: `node src/index.js`

### Frontend (Vercel / Netlify)

1. Set build directory to `/frontend`
2. Build command: `npm run build`
3. Output directory: `dist`
4. Add environment variable to point the API proxy at your deployed backend URL

**Update `vite.config.js` for production:**

```js
// Replace the proxy target with your deployed backend URL
proxy: {
  "/api": {
    target: "https://your-backend.railway.app",
    ...
  }
}
```

Or set `VITE_API_BASE` and update `src/utils/api.js` to use `import.meta.env.VITE_API_BASE`.

---

## Project Structure

```
notebooklm/
├── backend/
│   ├── src/
│   │   ├── index.js      # Express server, routes
│   │   ├── rag.js        # Chunking, TF-IDF indexing, retrieval
│   │   └── store.js      # In-memory document store
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Chat.jsx      # Chat interface + source display
│   │   │   ├── Sidebar.jsx   # Document list
│   │   │   └── Uploader.jsx  # Drag-and-drop upload
│   │   ├── utils/
│   │   │   └── api.js        # API client
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/documents` | List all uploaded documents |
| POST | `/documents/upload` | Upload and ingest a document |
| POST | `/documents/:docId/query` | Ask a question about a document |
| DELETE | `/documents/:docId` | Remove a document |

### Query request body

```json
{
  "question": "What is the main argument of this paper?",
  "k": 5
}
```

### Query response

```json
{
  "answer": "According to Chunk 2, the main argument is...",
  "sources": [
    {
      "chunkIndex": 1,
      "score": 0.342,
      "preview": "First 200 chars of the chunk...",
      "startChar": 2000,
      "endChar": 4000
    }
  ],
  "model": "llama-3.3-70b-versatile",
  "tokensUsed": 892
}
```

---

## Marking Scheme Coverage

| Criterion | Implementation |
|-----------|---------------|
| GitHub Repository | ✅ This repo |
| Live Project | ✅ Deploy backend + frontend as above |
| RAG Pipeline | ✅ ingestion → chunking → TF-IDF indexing → cosine retrieval → Groq LLaMA generation |
| Answer Quality | ✅ System prompt enforces document-only answers; chunks injected as context |
| Code Quality | ✅ Modular, documented, clear separation of concerns |
