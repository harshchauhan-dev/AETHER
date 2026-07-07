import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Trash2 } from "lucide-react";
import type { ChatMessage } from "../types";

interface ChatConsoleProps {
  chatHistory: ChatMessage[];
  onSendMessage: (msg: string) => Promise<void>;
  onClearHistory?: () => void;
  isSending: boolean;
}

export default function ChatConsole({ chatHistory, onSendMessage, onClearHistory, isSending }: ChatConsoleProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory, isSending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;
    onSendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="panel-card" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 12rem)", minHeight: "500px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <div>
          <h3 className="panel-title">AI Spatial Reasoning Agent</h3>
          <p className="panel-subtitle">Ask Gemini about the spatial state, risk decisions, or safety rationales</p>
        </div>
        {onClearHistory && (
          <button
            onClick={onClearHistory}
            className="btn"
            style={{ width: "auto", padding: "0.35rem 0.6rem", display: "flex", alignItems: "center", gap: "0.25rem" }}
            title="Clear Chat History"
          >
            <Trash2 size={13} />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {chatHistory.length === 0 ? (
            <div className="empty-state" style={{ margin: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
              <Bot size={28} style={{ color: "var(--text-dim)" }} />
              <span>Ask "Where is the patient fallen?" or "Which nurse is closest to ICU-1?" or "Show me safety actions"</span>
            </div>
          ) : (
            chatHistory.map((msg, index) => (
              <div
                key={index}
                className={`chat-bubble ${msg.role === "user" ? "bubble-user" : "bubble-agent"}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.68rem", opacity: 0.8 }}>
                  {msg.role === "user" ? <User size={10} /> : <Bot size={10} />}
                  <strong>{msg.role === "user" ? "You" : "AETHER AI"}</strong>
                  {msg.timestamp && (
                    <span style={{ fontSize: "0.6rem", opacity: 0.6 }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  )}
                </div>
                <div>{msg.content}</div>
              </div>
            ))
          )}
          {isSending && (
            <div className="chat-bubble bubble-agent" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Bot size={10} />
              <div style={{ display: "flex", gap: "3px" }}>
                <span className="dot-pulse" style={{ width: 4, height: 4, background: "var(--text)", borderRadius: "50%", display: "inline-block" }}></span>
                <span className="dot-pulse" style={{ width: 4, height: 4, background: "var(--text)", borderRadius: "50%", display: "inline-block", animationDelay: "0.2s" }}></span>
                <span className="dot-pulse" style={{ width: 4, height: 4, background: "var(--text)", borderRadius: "50%", display: "inline-block", animationDelay: "0.4s" }}></span>
              </div>
              <style>{`
                .dot-pulse {
                  animation: pulse 1s infinite alternate;
                }
                @keyframes pulse {
                  0% { opacity: 0.3; transform: scale(0.8); }
                  100% { opacity: 1; transform: scale(1.2); }
                }
              `}</style>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="chat-input-row">
          <input
            type="text"
            placeholder="Type a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSending}
          />
          <button type="submit" disabled={isSending || !input.trim()}>
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
