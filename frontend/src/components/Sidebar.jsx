import { deleteDocument } from "../utils/api";

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function Sidebar({ docs, activeDocId, onSelect, onDelete, onNew }) {
  const handleDelete = async (e, docId) => {
    e.stopPropagation();
    try {
      await deleteDocument(docId);
      onDelete(docId);
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  };

  return (
    <div style={{
      width: 260,
      flexShrink: 0,
      borderRight: "1px solid #e5e7eb",
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      height: "100%",
    }}>
      <div style={{ padding: "20px 16px 12px", borderBottom: "1px solid #f3f4f6" }}>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111", display: "flex", alignItems: "center", gap: 8 }}>
          <span>📓</span> NotebookLM
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9ca3af" }}>Powered by Groq + LLaMA</p>
      </div>

      <div style={{ padding: "12px 10px" }}>
        <button
          onClick={onNew}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 16 }}>+</span> Upload document
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
        {docs.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af", textAlign: "center", marginTop: 32, padding: "0 16px" }}>
            No documents yet. Upload one to get started.
          </p>
        ) : (
          docs.map(doc => (
            <div
              key={doc.docId}
              onClick={() => onSelect(doc)}
              style={{
                padding: "10px 10px",
                borderRadius: 8,
                marginBottom: 2,
                cursor: "pointer",
                background: activeDocId === doc.docId ? "#eef2ff" : "transparent",
                border: activeDocId === doc.docId ? "1px solid #c7d2fe" : "1px solid transparent",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                transition: "background 0.1s",
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>📄</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  margin: 0, fontSize: 13, fontWeight: 500, color: "#111",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                }}>
                  {doc.name}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>
                  {doc.chunkCount} chunks · {formatSize(doc.size)}
                </p>
              </div>
              <button
                onClick={e => handleDelete(e, doc.docId)}
                title="Delete"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#9ca3af", fontSize: 15, padding: "2px 4px", flexShrink: 0,
                  borderRadius: 4, lineHeight: 1,
                }}
                onMouseOver={e => e.target.style.color = "#dc2626"}
                onMouseOut={e => e.target.style.color = "#9ca3af"}
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
