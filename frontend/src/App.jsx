import { useState } from "react";
import Uploader from "./components/Uploader";
import Chat from "./components/Chat";
import Sidebar from "./components/Sidebar";

export default function App() {
  const [docs, setDocs] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [showUploader, setShowUploader] = useState(false);

  const handleUploaded = (doc) => {
    setDocs(prev => [...prev, doc]);
    setActiveDoc(doc);
    setShowUploader(false);
  };

  const handleDelete = (docId) => {
    setDocs(prev => prev.filter(d => d.docId !== docId));
    if (activeDoc?.docId === docId) setActiveDoc(null);
  };

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: "#f9fafb",
      overflow: "hidden",
    }}>
      <Sidebar
        docs={docs}
        activeDocId={activeDoc?.docId}
        onSelect={setActiveDoc}
        onDelete={handleDelete}
        onNew={() => { setShowUploader(true); setActiveDoc(null); }}
      />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%" }}>
        {showUploader || (!activeDoc && docs.length === 0) ? (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
            gap: 32,
          }}>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 700, color: "#111" }}>
                Chat with your documents
              </h2>
              <p style={{ margin: 0, fontSize: 15, color: "#6b7280" }}>
                Upload a PDF or text file and ask questions grounded in its content.
              </p>
            </div>
            <Uploader onUploaded={handleUploaded} />
            <div style={{
              display: "flex", gap: 24, padding: "20px 32px",
              background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
              maxWidth: 480, width: "100%",
            }}>
              {[
                { icon: "🔍", label: "Semantic search", desc: "TF-IDF cosine retrieval over your document" },
                { icon: "🧩", label: "Smart chunking", desc: "Sliding-window with 20% overlap" },
                { icon: "⚡", label: "Groq LLaMA 3.3 70B", desc: "Fast inference, grounded answers only" },
              ].map(f => (
                <div key={f.label} style={{ flex: 1 }}>
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{f.icon}</div>
                  <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: "#374151" }}>{f.label}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "#9ca3af", lineHeight: 1.4 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : activeDoc ? (
          <Chat key={activeDoc.docId} doc={activeDoc} />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#9ca3af", fontSize: 14 }}>Select a document from the sidebar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
