import { useState, useEffect, useCallback, useRef } from "react";
import { getChatMessages, sendChatMessage, getActivityFeed, type ChatMessage, type FeedEvent } from "../api";
import type { Theme } from "../theme";

interface ChatProps {
  leagueId: number;
  teamId: number;
  colors: Theme;
}

type Tab = "chat" | "activity";

export function Chat({ leagueId, teamId: _teamId, colors: C }: ChatProps) {
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [chatData, feedData] = await Promise.all([
        getChatMessages(leagueId),
        getActivityFeed(leagueId),
      ]);
      setMessages(chatData);
      setFeed(feedData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    setSending(true);
    try {
      await sendChatMessage(leagueId, input.trim());
      setInput("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send");
    }
    setSending(false);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "0 0 100px" }}>
      {error && (
        <div style={{ margin: "8px 16px", background: C.redDim, color: C.red, padding: "8px 12px", borderRadius: 8, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", padding: "8px 16px", gap: 4 }}>
        {(["chat", "activity"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 8,
              border: "none",
              background: tab === t ? C.green : C.card2,
              color: tab === t ? "#fff" : C.txt2,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {t === "activity" ? "Activity" : "Chat"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "8px 16px" }}>
        {tab === "chat" ? (
          <>
            {messages.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: C.txt3, fontSize: 13 }}>
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.txt }}>{msg.teamName}</span>
                    <span style={{ fontSize: 10, color: C.txt3 }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p style={{ color: C.txt, fontSize: 14, margin: 0, lineHeight: 1.4 }}>{msg.message}</p>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <>
            {feed.length === 0 ? (
              <div style={{ textAlign: "center", padding: 24, color: C.txt3, fontSize: 13 }}>
                No activity yet.
              </div>
            ) : (
              feed.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    padding: "8px 12px",
                    background: C.card,
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    marginBottom: 6,
                  }}
                >
                  <p style={{ color: C.txt, fontSize: 13, margin: 0 }}>{ev.message}</p>
                  <p style={{ color: C.txt3, fontSize: 10, margin: "2px 0 0" }}>
                    {new Date(ev.timestamp).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* Input (chat tab only) */}
      {tab === "chat" && (
        <div style={{ padding: "8px 16px", display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.card,
              color: C.txt,
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: C.green,
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              opacity: !input.trim() ? 0.5 : 1,
            }}
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
