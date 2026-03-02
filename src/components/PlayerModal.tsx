import { useState, useEffect } from "react";
import { getPlayer, type PlayerDetail } from "../api";
import type { Theme } from "../theme";

interface PlayerModalProps {
  playerId: number;
  colors: Theme;
  onClose: () => void;
}

export function PlayerModal({ playerId, colors: C, onClose }: PlayerModalProps) {
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPlayer(playerId)
      .then((d) => { if (!cancelled) setPlayer(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load"); });
    return () => { cancelled = true; };
  }, [playerId]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: C.bg,
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${C.border}` }}>
          {error ? (
            <p style={{ color: C.red, fontSize: 14, margin: 0 }}>{error}</p>
          ) : !player ? (
            <>
              <div style={{ background: C.card, borderRadius: 6, height: 22, width: "60%", marginBottom: 10 }} />
              <div style={{ background: C.card, borderRadius: 6, height: 14, width: "40%" }} />
            </>
          ) : (
            <>
              <p style={{ fontSize: 20, fontWeight: 700, color: C.txt, margin: 0 }}>{player.name}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: C.txt2 }}>#{player.ranking}</span>
                <span style={{ fontSize: 13, color: C.txt2 }}>{player.country}</span>
                {player.status === "cut" && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.red, background: C.redDim, padding: "2px 8px", borderRadius: 6 }}>CUT</span>
                )}
                {player.status === "wd" && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.red, background: C.redDim, padding: "2px 8px", borderRadius: 6 }}>WD</span>
                )}
                {player.status === "active" && player.rounds.length > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.green,
                      background: C.greenDim,
                      padding: "2px 8px",
                      borderRadius: 6,
                    }}
                  >
                    {player.toParDisplay}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Body — empty for now */}
        <div style={{ flex: 1, overflow: "auto" }} />

        {/* Footer */}
        <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: "12px 0",
              fontSize: 15,
              fontWeight: 600,
              color: C.txt,
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
