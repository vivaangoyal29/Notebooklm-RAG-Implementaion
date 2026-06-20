import { useState, useRef } from "react";
import { uploadDocument } from "../utils/api";

export default function Uploader({ onUploaded }) {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    const allowed = ["application/pdf", "text/plain"];
    if (!allowed.includes(file.type)) {
      setError("Only PDF and .txt files are supported.");
      return;
    }
    setError(null);
    setProgress(0);
    try {
      const doc = await uploadDocument(file, setProgress);
      onUploaded(doc);
    } catch (e) {
      setError(e.message);
    } finally {
      setProgress(null);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div style={{ width: "100%", maxWidth: 560 }}>
      <div
        onClick={() => inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragging ? "#6366f1" : "#d1d5db"}`,
          borderRadius: 16,
          padding: "48px 32px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? "#eef2ff" : "#fafafa",
          transition: "all 0.15s ease",
          userSelect: "none",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt"
          style={{ display: "none" }}
          onChange={e => handleFile(e.target.files[0])}
        />
        <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
        <p style={{ fontWeight: 600, fontSize: 16, color: "#111", margin: "0 0 4px" }}>
          Drop a document here
        </p>
        <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
          PDF or plain text · up to 20 MB
        </p>
      </div>

      {progress !== null && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
            <span>Processing…</span>
            <span>{progress}%</span>
          </div>
          <div style={{ height: 4, background: "#e5e7eb", borderRadius: 99 }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "#6366f1", borderRadius: 99, transition: "width 0.2s" }} />
          </div>
        </div>
      )}

      {error && (
        <p style={{ marginTop: 12, fontSize: 13, color: "#dc2626", background: "#fef2f2", padding: "8px 12px", borderRadius: 8 }}>
          {error}
        </p>
      )}
    </div>
  );
}
