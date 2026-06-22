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
const MODEL = "llama-3.3-70b-versatile";

// Enhanced-RAG toggles — set either to "false" in the environment to fall back
// to plain TF-IDF retrieval (useful for A/B comparison).
const USE_HYDE = process.env.USE_HYDE !== "false";
const USE_JUDGE = process.env.USE_JUDGE !== "false";

// ── Enhanced retrieval helpers ──────────────────────────────────────────────────

/**
 * HyDE (Hypothetical Document Embeddings).
 * Generate a short hypothetical answer to the question and use THAT as the
 * retrieval query. An answer-style passage shares far more vocabulary with the
 * source text than a bare question does, which directly compensates for
 * TF-IDF's keyword-matching weakness. The text is never shown to the user.
 */
async function generateHypothetical(question) {
  const r = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "Write a brief, plausible passage (2-4 sentences) that could answer the user's question, " +
          "in the style of an excerpt from a document. Invent specific details if needed — this text " +
          "is used only to improve search matching and is never shown to the user.",
      },
      { role: "user", content: question },
    ],
    temperature: 0.5,
    max_tokens: 200,
  });
  return r.choices[0]?.message?.content?.trim() || "";
}

/**
 * LLM judge (CRAG-style relevance evaluator).
 * Grade candidate chunks and keep only those genuinely useful for the question.
 * Returns the filtered subset; fails open (keeps all) on malformed output.
 */
async function judgeChunks(question, candidates) {
  const list = candidates
    .map((c, i) => `[${i + 1}] ${c.chunk.text.slice(0, 600)}`)
    .join("\n\n");

  const r = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a retrieval relevance judge. You are given a QUESTION and candidate PASSAGES, each " +
          "prefixed with a bracketed number like [1], [2]. Identify which passages contain information " +
          "useful for answering the question. Use ONLY those bracketed passage numbers — ignore any " +
          "numbering or section labels (e.g. 'Section B', '2.') that appear inside the passage text. " +
          'Respond with ONLY JSON of the form {"relevant":[<passage numbers>]}. ' +
          'Return {"relevant":[]} only if no passage is useful.',
      },
      { role: "user", content: `QUESTION: ${question}\n\nPASSAGES:\n${list}` },
    ],
    temperature: 0,
    max_tokens: 150,
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(r.choices[0].message.content);
    const raw = Array.isArray(parsed.relevant) ? parsed.relevant : [];
    // Keep only in-range passage numbers — the model sometimes invents indices
    // (e.g. echoing an internal "Section 2" label).
    const valid = raw.map(n => candidates[Number(n) - 1]).filter(Boolean);
    // If it named passages but none were valid, its output is unreliable —
    // fail open to the top candidates rather than dropping everything.
    if (raw.length > 0 && valid.length === 0) return candidates;
    return valid;
  } catch {
    return candidates; // fail open — don't break the query on malformed JSON
  }
}

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

  try {
    // 1. HyDE — retrieve using a hypothetical answer rather than the bare question
    let retrievalQuery = question;
    let hypothetical = null;
    if (USE_HYDE) {
      hypothetical = await generateHypothetical(question);
      if (hypothetical) retrievalQuery = `${question}\n\n${hypothetical}`;
    }

    // Pull extra candidates when judging, since the judge will prune them down to k
    const candidateK = USE_JUDGE ? Math.max(k * 2, k + 3) : k;
    let results = retrieve(retrievalQuery, doc.index, candidateK);
    const candidateCount = results.length;

    const retrievalMeta = () => ({
      hyde: USE_HYDE,
      judge: USE_JUDGE,
      candidates: candidateCount,
      kept: results.length,
    });

    if (results.length === 0) {
      return res.json({
        answer: "I couldn't find any relevant information in the document to answer your question.",
        sources: [],
        retrieval: { hyde: USE_HYDE, judge: USE_JUDGE, candidates: 0, kept: 0 },
      });
    }

    // 2. LLM judge — keep only genuinely relevant chunks
    if (USE_JUDGE) {
      const kept = await judgeChunks(question, results);
      // If the judge rejects everything, trust it: the answer isn't in the document
      if (kept.length === 0) {
        return res.json({
          answer: "I couldn't find information in the document relevant to your question.",
          sources: [],
          retrieval: { hyde: USE_HYDE, judge: USE_JUDGE, candidates: candidateCount, kept: 0 },
        });
      }
      results = kept;
    }

    results = results.slice(0, k);

    // Build context from the surviving chunks
    const context = results
      .map(r => `[Chunk ${r.chunk.index + 1}]\n${r.chunk.text}`)
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

    const completion = await groq.chat.completions.create({
      model: MODEL,
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
      retrieval: retrievalMeta(),
    });
  } catch (err) {
    console.error("Query error:", err);
    const msg = err?.error?.message || err?.message || "LLM request failed.";
    res.status(502).json({ error: msg });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ NotebookLM backend running on http://localhost:${PORT}`);
});
