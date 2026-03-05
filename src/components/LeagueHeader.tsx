import { useState, useEffect, useRef } from "react";
import type { Theme } from "../theme";
import type { TournamentListItem, LeagueSummary } from "../api";
import { ProfileMenu } from "./ProfileMenu";
import { CourseIcon } from "./CourseIcon";
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
  seasonPoints: number;
  leagues: LeagueSummary[];
  onChangeLeague: (id: number) => void;
}

export function LeagueHeader({ leagueId, isDark: dk, colors: C, onToggleTheme, onBack, viewedTournament: t, activePage: _activePage, tournaments, currentTournamentId, viewingWeek, onChangeWeek, seasonPoints, leagues, onChangeLeague }: LeagueHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLeague = leagues.find((l) => l.id === leagueId);
  const leagueName = currentLeague?.name ?? "";

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

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
          <div style={{ display: "flex", alignItems: "center", gap: 8, position: "relative" }} ref={dropdownRef}>
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            </button>
            <button
              onClick={() => leagues.length > 1 && setDropdownOpen(!dropdownOpen)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: leagues.length > 1 ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <p style={{ color: C.txt, fontSize: 14, fontWeight: 600, margin: 0 }}>{leagueName}</p>
              {leagues.length > 1 && (
                <span style={{ fontSize: 10, color: C.txt3 }}>{dropdownOpen ? "▲" : "▼"}</span>
              )}
            </button>

            {/* League dropdown */}
            {dropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  zIndex: 50,
                  background: C.card,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                  maxHeight: 300,
                  overflowY: "auto",
                  minWidth: 200,
                  marginTop: 4,
                }}
              >
                {leagues.map((l, i) => {
                  const isSelected = l.id === leagueId;
                  return (
                    <div
                      key={l.id}
                      onClick={() => {
                        onChangeLeague(l.id);
                        setDropdownOpen(false);
                      }}
                      style={{
                        padding: "10px 14px",
                        cursor: "pointer",
                        background: isSelected ? `${C.green}18` : "transparent",
                        borderBottom: i < leagues.length - 1 ? `1px solid ${C.border}` : "none",
                      }}
                    >
                      <p style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: C.txt, margin: 0 }}>
                        {l.name}
                      </p>
                      <p style={{ fontSize: 11, color: C.txt3, margin: "2px 0 0" }}>
                        {l.team}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <ProfileMenu isDark={dk} colors={C} onToggleTheme={onToggleTheme} />
        </div>

        {!t ? (
          <div style={{ height: 52 }} />
        ) : (
          <>
            {/* Tournament info: Icon spanning name + course + location */}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <CourseIcon size={52} bgColor={tournamentColor} flagColor={t.secondaryColor ?? "#FFFFFF"} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: 4 }}>
                  <p style={{ color: C.txt, fontSize: 17, fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.name}
                    {t.isMajor && <span style={{ color: C.gold, marginLeft: 6 }}>★</span>}
                  </p>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <p style={{ color: C.txt2, fontSize: 13, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.course}</p>
                  <p style={{ color: C.txt2, fontSize: 13, margin: 0, flexShrink: 0, marginLeft: 8 }}>Pts: {seasonPoints}</p>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ color: C.txt3, fontSize: 12, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.location}</p>
                  <p style={{ color: C.txt3, fontSize: 12, margin: 0, flexShrink: 0, marginLeft: 8 }}>Par {t.par}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      {tournaments.length > 0 && (
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
