import { useState, useEffect } from "react";
import type { Theme } from "../theme";
import type { TournamentInfo } from "../api";
import { getTournament, getLeagueInfo } from "../api";
import { ThemeToggle } from "./ThemeToggle";

interface LeagueHeaderProps {
  leagueId: number;
  isDark: boolean;
  colors: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
}

function formatPurse(n: number): string {
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${n.toLocaleString()}`;
}

export function LeagueHeader({ leagueId, isDark: dk, colors: C, onToggleTheme, onBack }: LeagueHeaderProps) {
  const [tourney, setTourney] = useState<TournamentInfo | null>(null);
  const [leagueName, setLeagueName] = useState("");

  useEffect(() => {
    getTournament().then(setTourney);
    getLeagueInfo(leagueId).then((info) => setLeagueName(info.name));
  }, [leagueId]);

  const phase = tourney?.phase || "idle";
  const status = phase === "idle" ? "upcoming" : phase === "final" ? "done" : "live";
  const statusColor = status === "live" ? C.greenBright : status === "done" ? C.blue : C.txt3;
  const statusLabel = status === "live" ? `Live • R${tourney?.currentRound || 0}` : status === "done" ? "Final" : "Upcoming";

  // Format cut line
  let cutDisplay = "—";
  if (tourney && tourney.cutLine !== null) {
    const cl = tourney.cutLine;
    const strokes = tourney.par * 2 + cl;
    cutDisplay = cl === 0 ? `E (${strokes})` : cl > 0 ? `+${cl} (${strokes})` : `${cl} (${strokes})`;
  }

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: C.card,
        borderBottom: `1px solid ${C.border}`,
        padding: "0 16px 16px",
        boxShadow: dk ? "none" : "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      {/* Row 1: Back + League Name | Toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 64 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={onBack}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.card2,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.txt2,
              fontSize: 16,
              fontWeight: 500,
              padding: 0,
            }}
          >
            ‹
          </button>
          <p style={{ color: C.txt, fontSize: 14, fontWeight: 600, margin: 0 }}>{leagueName}</p>
        </div>
        <ThemeToggle isDark={dk} colors={C} onToggle={onToggleTheme} />
      </div>

      {!tourney ? (
        <div style={{ height: 52 }} />
      ) : (
        <>
          {/* Row 2: Tournament Name | Status */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, marginBottom: 4 }}>
            <p style={{ color: C.txt, fontSize: 17, fontWeight: 700, margin: 0 }}>{tourney.name}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  color: statusColor,
                  background: statusColor + (dk ? "20" : "15"),
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                {status === "live" && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: C.greenBright,
                      boxShadow: `0 0 6px ${C.green}`,
                      animation: "pulse 2s infinite",
                      flexShrink: 0,
                    }}
                  />
                )}
                {statusLabel}
              </span>
            </div>
          </div>

          {/* Row 3: Course | Purse */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
            <p style={{ color: C.txt2, fontSize: 13, margin: 0 }}>{tourney.course}</p>
            <p style={{ color: C.txt2, fontSize: 13, margin: 0 }}>Purse: {formatPurse(tourney.purse)}</p>
          </div>

          {/* Row 4: Location | Cut */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ color: C.txt3, fontSize: 12, margin: 0 }}>📍 {tourney.location}</p>
            <p style={{ color: C.txt3, fontSize: 12, margin: 0 }}>Cut: {cutDisplay}</p>
          </div>
        </>
      )}
    </div>
  );
}
