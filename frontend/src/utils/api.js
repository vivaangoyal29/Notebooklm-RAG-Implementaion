// In dev, "/api" is proxied to the backend by Vite (see vite.config.js).
// In production, set VITE_API_BASE to your deployed backend URL, e.g.
//   VITE_API_BASE=https://your-backend.onrender.com
const BASE = import.meta.env.VITE_API_BASE || "/api";

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
      const data = JSON.parse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || "Upload failed"));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
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
