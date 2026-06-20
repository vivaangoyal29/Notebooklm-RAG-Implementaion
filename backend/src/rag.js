/**
 * RAG Engine
 * 
 * Chunking strategy: Sliding window with overlap
 *   - Fixed-size chunks of ~500 tokens (≈2000 chars)
 *   - 20% overlap between chunks to preserve context across boundaries
 *   - Each chunk tagged with its page number and position index
 *
 * Retrieval: TF-IDF cosine similarity (no external embedding API needed)
 *   - Build term frequency vectors for each chunk at index time
 *   - At query time, score all chunks and return top-k
 */

// ── Chunking ──────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 2000;   // characters (~500 tokens)
const CHUNK_OVERLAP = 400; // 20% overlap

/**
 * Split raw text into overlapping chunks.
 * Returns array of { text, index, startChar, endChar }
 */
export function chunkText(text) {
  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const chunkText = text.slice(start, end).trim();

    if (chunkText.length > 50) { // skip tiny trailing fragments
      chunks.push({
        text: chunkText,
        index,
        startChar: start,
        endChar: end,
      });
      index++;
    }

    if (end === text.length) break;
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }

  return chunks;
}

// ── TF-IDF Vectoriser ─────────────────────────────────────────────────────────

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function termFrequency(tokens) {
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  const total = tokens.length || 1;
  for (const t in tf) tf[t] /= total;
  return tf;
}

function buildIDF(chunks) {
  const df = {};
  const N = chunks.length;

  for (const chunk of chunks) {
    const unique = new Set(tokenize(chunk.text));
    for (const t of unique) df[t] = (df[t] || 0) + 1;
  }

  const idf = {};
  for (const t in df) idf[t] = Math.log((N + 1) / (df[t] + 1)) + 1;
  return idf;
}

function tfidfVector(tokens, idf) {
  const tf = termFrequency(tokens);
  const vec = {};
  for (const t in tf) {
    if (idf[t]) vec[t] = tf[t] * idf[t];
  }
  return vec;
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of allKeys) {
    const va = a[k] || 0;
    const vb = b[k] || 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ── Index ─────────────────────────────────────────────────────────────────────

/**
 * Build a searchable index from chunks.
 * Returns { chunks, idf, vectors }
 */
export function buildIndex(chunks) {
  const idf = buildIDF(chunks);
  const vectors = chunks.map(chunk => {
    const tokens = tokenize(chunk.text);
    return tfidfVector(tokens, idf);
  });
  return { chunks, idf, vectors };
}

// ── Retrieval ─────────────────────────────────────────────────────────────────

/**
 * Retrieve the top-k most relevant chunks for a query.
 * Returns array of { chunk, score }
 */
export function retrieve(query, index, k = 5) {
  const { chunks, idf, vectors } = index;
  const queryTokens = tokenize(query);
  const queryVec = tfidfVector(queryTokens, idf);

  const scored = chunks.map((chunk, i) => ({
    chunk,
    score: cosineSimilarity(queryVec, vectors[i]),
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .filter(r => r.score > 0);
}
