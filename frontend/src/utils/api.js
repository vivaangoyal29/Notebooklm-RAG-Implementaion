// In dev, "/api" is proxied to the backend by Vite (see vite.config.js).
// In production, talk to the deployed Render backend directly.
// Hardcoded (not via VITE_API_BASE) so a stale Vercel dashboard env var
// can't override it.
const BASE = import.meta.env.DEV
  ? "/api"
  : "https://notebooklm-rag-implementaion.onrender.com";

export async function uploadDocument(file, onProgress) {
  const form = new FormData();
  form.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}/documents/upload`);

    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      let data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // Non-JSON response — usually a cold-start/timeout HTML page or a CORS
        // failure. Surface it instead of hanging the upload promise.
        return reject(new Error(
          `Server returned an unexpected response (HTTP ${xhr.status}). ` +
          `The backend may be starting up — wait a moment and try again.`
        ));
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || `Upload failed (HTTP ${xhr.status})`));
    };

    xhr.onerror = () => reject(new Error(
      "Network error during upload. Check that the backend URL (VITE_API_BASE) is correct and reachable."
    ));
    xhr.ontimeout = () => reject(new Error("Upload timed out. The backend may be waking from sleep — try again."));
    xhr.timeout = 120000; // 2 min — generous for free-tier cold starts
    xhr.send(form);
  });
}

export async function queryDocument(docId, question, k = 5) {
  const res = await fetch(`${BASE}/documents/${docId}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, k }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Query failed");
  return data;
}

export async function listDocuments() {
  const res = await fetch(`${BASE}/documents`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to list documents");
  return data;
}

export async function deleteDocument(docId) {
  const res = await fetch(`${BASE}/documents/${docId}`, { method: "DELETE" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Delete failed");
  return data;
}
