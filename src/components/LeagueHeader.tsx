import { useState, useEffect } from "react";
import type { Theme } from "../theme";
import type { TournamentListItem } from "../api";
import { getLeagueInfo } from "../api";
import { ThemeToggle } from "./ThemeToggle";
import { WeekNav } from "../pages/Roster";

interface LeagueHeaderProps {
  leagueId: number;
  isDark: boolean;
  colors: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
  viewedTournament: TournamentListItem | null;
  activePage: string;
  tournaments: TournamentListItem[];
  currentTournamentId: number;
  viewingWeek: number;
  onChangeWeek: (week: number) => void;
}

function formatPurse(n: number): string {
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${n.toLocaleString()}`;
}

export function LeagueHeader({ leagueId, isDark: dk, colors: C, onToggleTheme, onBack, viewedTournament: t, activePage, tournaments, currentTournamentId, viewingWeek, onChangeWeek }: LeagueHeaderProps) {
  const [leagueName, setLeagueName] = useState("");

  useEffect(() => {
    getLeagueInfo(leagueId).then((info) => setLeagueName(info.name));
  }, [leagueId]);

  const tournamentColor = t?.color ?? "#003C80";

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: C.card,
      }}
    >
      {/* Tournament info section */}
      <div style={{ padding: "0 16px 16px", borderBottom: `1px solid ${C.border}`, background: `linear-gradient(to bottom, transparent 0%, ${tournamentColor}20 100%)` }}>
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
            {/* Row 2: Tournament Name + Status */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, marginBottom: 4 }}>
              <p style={{ color: C.txt, fontSize: 17, fontWeight: 700, margin: 0 }}>
                {t.name}
                {t.isMajor && <span style={{ color: C.gold, marginLeft: 6 }}>★</span>}
              </p>
              {(() => {
                const currentIdx = tournaments.findIndex((t2) => t2.id === currentTournamentId);
                const viewedIdx = tournaments.findIndex((t2) => t2.id === t.id);
                const label = viewedIdx < currentIdx ? "Complete" : viewedIdx === currentIdx ? "Active" : "Upcoming";
                const isActive = viewedIdx === currentIdx;
                const color = isActive ? C.greenBright : C.txt3;
                const bg = isActive ? C.greenDim : `${C.txt3}15`;
                return (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color,
                    background: bg,
                    padding: "3px 10px",
                    borderRadius: 10,
                    whiteSpace: "nowrap",
                    marginLeft: 8,
                  }}>
                    {label}
                  </span>
                );
              })()}
            </div>

            {/* Row 3: Course | Par */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
              <p style={{ color: C.txt2, fontSize: 13, margin: 0 }}>{t.course}</p>
              <p style={{ color: C.txt2, fontSize: 13, margin: 0 }}>Par: {t.par}</p>
            </div>

            {/* Row 4: Location | Purse */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ color: C.txt3, fontSize: 12, margin: 0 }}>📍 {t.location}</p>
              <p style={{ color: C.txt3, fontSize: 12, margin: 0 }}>Purse: {formatPurse(t.purse)}</p>
            </div>
          </>
        )}
      </div>
      {activePage === "scorecard" && tournaments.length > 0 && (
        <div style={{ borderBottom: `1px solid ${C.border}`, background: `${tournamentColor}20` }}>
          <WeekNav
            tournaments={tournaments}
            viewingWeek={viewingWeek}
            currentWeekIndex={tournaments.findIndex((t2) => t2.id === currentTournamentId)}
            onChangeWeek={onChangeWeek}
            colors={C}
          />
        </div>
      )}
    </div>
  );
}
