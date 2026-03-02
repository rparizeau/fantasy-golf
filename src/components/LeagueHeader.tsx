import { useState, useEffect } from "react";
import type { Theme } from "../theme";
import type { TournamentListItem } from "../api";
import { getLeagueInfo } from "../api";
import { ThemeToggle } from "./ThemeToggle";

interface LeagueHeaderProps {
  leagueId: number;
  isDark: boolean;
  colors: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
  viewedTournament: TournamentListItem | null;
}

function formatPurse(n: number): string {
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${n.toLocaleString()}`;
}

export function LeagueHeader({ leagueId, isDark: dk, colors: C, onToggleTheme, onBack, viewedTournament: t }: LeagueHeaderProps) {
  const [leagueName, setLeagueName] = useState("");

  useEffect(() => {
    getLeagueInfo(leagueId).then((info) => setLeagueName(info.name));
  }, [leagueId]);

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

      {!t ? (
        <div style={{ height: 52 }} />
      ) : (
        <>
          {/* Row 2: Tournament Name + Major star */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, marginBottom: 4 }}>
            <p style={{ color: C.txt, fontSize: 17, fontWeight: 700, margin: 0 }}>
              {t.isMajor && <span style={{ color: C.gold, marginRight: 6 }}>★</span>}
              {t.name}
            </p>
          </div>

          {/* Row 3: Course | Purse */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
            <p style={{ color: C.txt2, fontSize: 13, margin: 0 }}>{t.course}</p>
            <p style={{ color: C.txt2, fontSize: 13, margin: 0 }}>Purse: {formatPurse(t.purse)}</p>
          </div>

          {/* Row 4: Location */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ color: C.txt3, fontSize: 12, margin: 0 }}>📍 {t.location}</p>
          </div>
        </>
      )}
    </div>
  );
}
