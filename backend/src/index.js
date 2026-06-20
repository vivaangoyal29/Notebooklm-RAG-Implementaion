import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import Groq from "groq-sdk";

import { chunkText, buildIndex, retrieve } from "./rag.js";
import { saveDocument, getDocument, listDocuments, deleteDocument } from "./store.js";

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_, file, cb) => {
    const allowed = ["application/pdf", "text/plain"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get("/health", (_, res) => res.json({ status: "ok" }));

// List all documents
app.get("/documents", (_, res) => {
  res.json(listDocuments());
});

// Upload & ingest a document
app.post("/documents/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded or unsupported type. Only PDF and .txt are accepted." });
    }

    const { originalname, mimetype, buffer, size } = req.file;
    let rawText = "";
    let pages = 1;

    if (mimetype === "application/pdf") {
      const parsed = await pdfParse(buffer);
      rawText = parsed.text;
      pages = parsed.numpages;
    } else {
      rawText = buffer.toString("utf-8");
    }

    if (!rawText.trim()) {
      return res.status(422).json({ error: "Document appears to be empty or could not be parsed." });
    }

    // RAG pipeline: chunk → index
    const chunks = chunkText(rawText);
    const index = buildIndex(chunks);

    const docId = uuidv4();
    saveDocument(docId, {
      metadata: {
        name: originalname,
        size,
        pages,
        mimetype,
        uploadedAt: new Date().toISOString(),
      },
      rawText,
      index,
    });

    res.json({
      docId,
      name: originalname,
      pages,
      chunkCount: chunks.length,
      charCount: rawText.length,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Failed to process document." });
  }
});

// Delete a document
app.delete("/documents/:docId", (req, res) => {
  const deleted = deleteDocument(req.params.docId);
  if (!deleted) return res.status(404).json({ error: "Document not found." });
  res.json({ success: true });
});

// Query a document
app.post("/documents/:docId/query", async (req, res) => {
  const { docId } = req.params;
  const { question, k = 5 } = req.body;

  if (!question?.trim()) {
    return res.status(400).json({ error: "Question is required." });
  }

  const doc = getDocument(docId);
  if (!doc) return res.status(404).json({ error: "Document not found." });

  // Retrieve relevant chunks
  const results = retrieve(question, doc.index, k);

  if (results.length === 0) {
    return res.json({
      answer: "I couldn't find any relevant information in the document to answer your question.",
      sources: [],
    });
  }

  // Build context from top chunks
  const context = results
    .map((r, i) => `[Chunk ${r.chunk.index + 1}]\n${r.chunk.text}`)
    .join("\n\n---\n\n");

  const systemPrompt = `You are a document assistant. You answer questions strictly based on the provided document context.

RULES:
- Only use information from the provided context chunks.
- If the context does not contain enough information to answer, say so clearly.
- Do not use your general knowledge or make things up.
- When referencing information, mention which chunk it came from (e.g., "According to Chunk 3...").
- Be concise but thorough.

DOCUMENT: "${doc.metadata.name}"

CONTEXT:
${context}`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      temperature: 0.2,
      max_tokens: 1024,
    });

    const answer = completion.choices[0].message.content;

    res.json({
      answer,
      sources: results.map(r => ({
        chunkIndex: r.chunk.index,
        score: Math.round(r.score * 1000) / 1000,
        preview: r.chunk.text.slice(0, 200) + (r.chunk.text.length > 200 ? "…" : ""),
        startChar: r.chunk.startChar,
        endChar: r.chunk.endChar,
      })),
      model: completion.model,
      tokensUsed: completion.usage?.total_tokens,
    });
  } catch (err) {
    console.error("Groq error:", err);
    const msg = err?.error?.message || err?.message || "LLM request failed.";
    res.status(502).json({ error: msg });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ NotebookLM backend running on http://localhost:${PORT}`);
});
