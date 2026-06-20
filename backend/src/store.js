/**
 * In-memory document store.
 * Maps docId -> { metadata, rawText, index }
 * 
 * For production: swap this out for Redis or a DB.
 */

const store = new Map();

export function saveDocument(docId, data) {
  store.set(docId, data);
}

export function getDocument(docId) {
  return store.get(docId) || null;
}

export function listDocuments() {
  return [...store.entries()].map(([id, doc]) => ({
    id,
    name: doc.metadata.name,
    size: doc.metadata.size,
    pages: doc.metadata.pages,
    chunkCount: doc.index.chunks.length,
    uploadedAt: doc.metadata.uploadedAt,
  }));
}

export function deleteDocument(docId) {
  return store.delete(docId);
}
