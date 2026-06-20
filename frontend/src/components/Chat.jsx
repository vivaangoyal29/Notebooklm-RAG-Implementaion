import { useState, useRef, useEffect } from "react";
import { queryDocument } from "../utils/api";

function SourceBadge({ source, index }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: "#f3f4f6",
          border: "none",
          borderRadius: 6,
          padding: "4px 10px",
          fontSize: 12,
          color: "#374151",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span>Chunk {source.chunkIndex + 1}</span>
        <span style={{ color: "#9ca3af" }}>·</span>
        <span style={{ color: "#6366f1" }}>score {source.score}</span>
        <span style={{ fontSize: 10, marginLeft: 2 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{
          marginTop: 4,
          padding: "10px 12px",
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          fontSize: 12,
          color: "#6b7280",
          lineHeight: 1.6,
          fontFamily: "Georgia, serif",
        }}>
          {source.preview}
        </div>
      )}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 20,
    }}>
      <div style={{ maxWidth: "80%" }}>
        {!isUser && (
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Assistant
          </div>
        )}
        <div style={{
          background: isUser ? "#6366f1" : "#fff",
          color: isUser ? "#fff" : "#111",
          border: isUser ? "none" : "1px solid #e5e7eb",
          borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
          padding: "12px 16px",
          fontSize: 14,
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {msg.content}
        </div>
        {msg.sources?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 4px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Sources ({msg.sources.length} chunks retrieved)
            </p>
            {msg.sources.map((s, i) => <SourceBadge key={i} source={s} index={i} />)}
          </div>
        )}
        {msg.error && (
          <p style={{ fontSize: 13, color: "#dc2626", marginTop: 6 }}>{msg.error}</p>
        )}
      </div>
    </div>
  );
}

export default function Chat({ doc }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `I've read "${doc.name}" — ${doc.chunkCount} chunks indexed across ${doc.pages} page${doc.pages > 1 ? "s" : ""}. Ask me anything about it.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: q }]);
    setLoading(true);

    try {
      const result = await queryDocument(doc.docId, q);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: result.answer,
        sources: result.sources,
        model: result.model,
        tokensUsed: result.tokensUsed,
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Something went wrong.",
        error: e.message,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Doc header */}
      <div style={{
        padding: "12px 20px",
        borderBottom: "1px solid #e5e7eb",
        background: "#fff",
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 20 }}>📄</span>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#111" }}>{doc.name}</p>
          <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
            {doc.chunkCount} chunks · {doc.pages} page{doc.pages > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px", background: "#f9fafb" }}>
        {messages.map((m, i) => <Message key={i} msg={m} />)}
        {loading && (
          <div style={{ display: "flex", gap: 6, padding: "8px 0" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: "50%", background: "#6366f1",
                animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
              }} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "16px 20px",
        borderTop: "1px solid #e5e7eb",
        background: "#fff",
        display: "flex",
        gap: 10,
        flexShrink: 0,
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Ask a question about this document…"
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            border: "1px solid #e5e7eb",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 14,
            fontFamily: "inherit",
            lineHeight: 1.5,
            outline: "none",
            color: "#111",
            background: "#fff",
          }}
          onInput={e => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          style={{
            background: "#6366f1",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            padding: "0 20px",
            fontSize: 14,
            fontWeight: 600,
            cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            opacity: input.trim() && !loading ? 1 : 0.4,
            flexShrink: 0,
            transition: "opacity 0.15s",
          }}
        >
          Send
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
