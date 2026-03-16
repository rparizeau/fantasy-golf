import { useState, useEffect, useCallback } from "react";
import { getFantasyLeaderboard, type FantasyTeamSummary, type TournamentListItem } from "../api";
import { StandingsList } from "../components/StandingsList";
import { ManagerIcon } from "../components/ManagerIcon";
import type { Theme } from "../theme";

interface HomeProps {
  leagueId: number;
  myTeamId: number;
  colors: Theme;
  tournaments: TournamentListItem[];
  currentTournamentId: number;
  viewingWeek: number;
  simTick: number;
}

export function Home({ leagueId, myTeamId, colors: C, tournaments, currentTournamentId, viewingWeek, simTick }: HomeProps) {
  const [teams, setTeams] = useState<FantasyTeamSummary[]>([]);
  const [managerCount, setManagerCount] = useState(0);
  const [activeSize, setActiveSize] = useState(2);
  const [phase, setPhase] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tid = tournaments[viewingWeek]?.id;
  const tColor = tournaments[viewingWeek]?.color;

  const refresh = useCallback(async () => {
    if (!tid) return;
    try {
      const lb = await getFantasyLeaderboard(leagueId, tid);
      setTeams(lb.teams);
      setManagerCount(lb.managerCount ?? lb.teams.length);
      if (lb.activeSize) setActiveSize(lb.activeSize);
      setPhase(lb.phase);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [leagueId, myTeamId, tid]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (simTick > 0) refresh();
  }, [simTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentWeekIdx = tournaments.findIndex((t) => t.id === currentTournamentId);
  const isFuture = viewingWeek > currentWeekIdx;

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }

  const colStyle: React.CSSProperties = { color: C.txt2, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 };

  // Derive round columns from phase (e.g., "round3" → [1,2,3], "cut" → [1,2], "final" → [1,2,3,4])
  const phaseRound = phase.startsWith("round") ? Number(phase.replace("round", "")) : phase === "cut" ? 2 : phase === "final" ? 4 : 0;
  const roundCols = phaseRound > 0 ? Array.from({ length: phaseRound }, (_, i) => i + 1) : [];

  return (
    <div>
      {/* Match section — all teams with tournament background */}
      <div style={{ background: `${tColor ?? "#003C80"}15` }}>
        <div style={{ padding: "12px 16px 16px" }}>
          {/* MATCH header */}
          <div style={{ display: "flex", alignItems: "center", padding: "0 14px 8px" }}>
            <div style={{ flex: 1 }}>
              <p style={{ ...colStyle, margin: 0 }}>Match</p>
            </div>
          </div>

          {error ? (
            <div style={{ background: C.redDim, color: C.red, padding: "12px 16px", borderRadius: 10, fontSize: 13 }}>
              {error}
            </div>
          ) : teams.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: C.txt3, fontSize: 13 }}>
              {isFuture ? "Tournament hasn't started yet." : "No match data yet."}
            </div>
          ) : (
            <>
              {teams.map((team) => {
                const isMe = team.teamId === myTeamId;
                const rank = teams.findIndex((t) => t.totalPoints === team.totalPoints) + 1;
                const tied = teams.filter((t) => t.totalPoints === team.totalPoints).length > 1;
                const rankLabel = `${tied ? "T" : ""}${rank}`;
                const activePlayers = team.players.filter((p) => p.isActive);
                const projTotal = team.projectedRoundPoints.reduce((a, b) => a + b, 0);
                return (
                  <div
                    key={team.teamId}
                    style={{
                      background: C.card,
                      borderRadius: 12,
                      border: `1px solid ${isMe ? (tColor ?? C.green) : C.border}`,
                      padding: "14px 14px",
                      marginBottom: 6,
                      overflow: "visible",
                      boxShadow: isMe ? `0 0 0 1px ${(tColor ?? C.green)}40` : undefined,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                        <div style={{ position: "relative", flexShrink: 0, overflow: "visible" }}>
                          <ManagerIcon size={34} bgColor={team.color ?? "#2D6B4A"} />
                          {rank > 0 && (
                            <span style={{
                              position: "absolute", top: -4, left: -6, zIndex: 2,
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              minWidth: 20, height: 18, borderRadius: 5,
                              background: `linear-gradient(${tColor ? `${tColor}20` : C.card2}, ${tColor ? `${tColor}20` : C.card2}), ${C.card}`,
                              color: tColor ?? C.txt2, fontSize: 11, fontWeight: 700, padding: "0 4px",
                              border: `1px solid ${tColor ?? C.border}`,
                            }}>{rankLabel}</span>
                          )}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <p style={{ fontSize: 16, fontWeight: 700, color: C.txt, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.teamName}</p>
                          <p style={{ fontSize: 11, color: C.txt3, margin: "2px 0 0" }}>{team.managerName}</p>
                        </div>
                      </div>
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          width: 36, height: 36, borderRadius: "50%",
                          background: `linear-gradient(${tColor ? `${tColor}20` : C.card2}, ${tColor ? `${tColor}20` : C.card2}), ${C.card}`,
                          color: tColor ?? C.txt2, fontSize: 14, fontWeight: 700,
                          border: `1px solid ${tColor ?? C.border}`,
                        }}>{team.totalPoints > 0 ? team.totalPoints : "-"}</span>
                        {projTotal > 0 && (
                          <span style={{
                            position: "absolute", bottom: -4, right: -6, zIndex: 2,
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            background: C.card, borderRadius: 3, padding: "0 1px",
                            color: C.txt2, fontSize: 9, fontWeight: 700,
                            boxShadow: `0 0 0 1px ${C.card}`,
                          }}>{projTotal}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", fontSize: 10, fontWeight: 600, color: C.txt3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>
                        <span style={{ width: 32, flexShrink: 0 }}>POS</span>
                        <span style={{ flex: 1 }} />
                        {roundCols.map((r) => (
                          <span key={r} style={{ width: 28, textAlign: "center", flexShrink: 0 }}>R{r}</span>
                        ))}
                        {roundCols.length === 0 && <span style={{ width: 28, textAlign: "center", flexShrink: 0 }}>RND</span>}
                        <span style={{ width: 28, textAlign: "center", flexShrink: 0 }}>THR</span>
                        <span style={{ width: 28, textAlign: "center", flexShrink: 0 }}>TOT</span>
                        <span style={{ width: 32, textAlign: "right", flexShrink: 0 }}>PTS</span>
                      </div>
                      {activePlayers.map((p) => {
                        const hasPos = p.status === "active" && p.position > 0;
                        const posLabel = p.status === "cut" ? "MC" : hasPos ? `${p.positionTied ? "T" : ""}${p.position}` : "-";
                        const tot = p.status === "active" ? p.toParDisplay : (p.totalScore > 0 ? `${p.totalScore}` : "-");
                        const thru = p.holesThru === 18 ? "F" : (p.holesThru > 0 ? p.holesThru : "-");
                        const statStyle: React.CSSProperties = { color: C.txt3, fontWeight: 600, flexShrink: 0, width: 28, textAlign: "center" as const };

                        const roundColValues = roundCols.map((r) => {
                          if (r < p.currentRound) {
                            return { val: `${p.rounds[r - 1] ?? "-"}`, color: C.txt };
                          } else if (r === p.currentRound) {
                            if (p.holesThru === 0) return { val: "-", color: C.txt3 };
                            if (p.holesThru === 18) return { val: `${p.currentRoundStrokes}`, color: C.txt };
                            const tp = p.currentRoundToPar;
                            return { val: tp === 0 ? "E" : tp > 0 ? `+${tp}` : `${tp}`, color: tp < 0 ? C.green : tp > 0 ? C.red : C.txt3 };
                          } else {
                            return { val: "-", color: C.txt3 };
                          }
                        });

                        // Abbreviate name: "Scottie Scheffler" → "S.Scheffler"
                        const nameParts = p.name.split(" ");
                        const shortName = nameParts.length > 1 ? `${nameParts[0][0]}.${nameParts.slice(1).join(" ")}` : p.name;

                        return (
                          <div key={p.playerId} style={{ display: "flex", alignItems: "center", fontSize: 13 }}>
                            <span style={{ color: p.status === "cut" ? C.red : C.txt3, fontWeight: 600, width: 32, flexShrink: 0 }}>{posLabel}</span>
                            <span style={{ color: C.txt2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
                              {shortName}
                            </span>
                            {roundColValues.map((rv, i) => (
                              <span key={i} style={{ ...statStyle, color: rv.color }}>{rv.val}</span>
                            ))}
                            {roundCols.length === 0 && <span style={statStyle}>-</span>}
                            <span style={statStyle}>{thru}</span>
                            <span style={{ ...statStyle, color: p.status === "active" ? (p.toPar < 0 ? C.green : p.toPar > 0 ? C.red : C.txt3) : C.txt3 }}>{tot}</span>
                            <span style={{ color: p.points > 0 ? C.txt : C.txt3, fontWeight: 600, flexShrink: 0, width: 32, textAlign: "right" }}>{p.points > 0 ? p.points : "-"}</span>
                          </div>
                        );
                      })}
                      {Array.from({ length: activeSize - activePlayers.length }).map((_, i) => (
                        <div key={`empty-${i}`} style={{ display: "flex", alignItems: "center", fontSize: 13 }}>
                          <span style={{ color: C.txt3, fontWeight: 600, width: 32, flexShrink: 0 }}>-</span>
                          <span style={{ color: C.txt3, fontStyle: "italic", flex: 1 }}>Empty slot</span>
                          {(roundCols.length > 0 ? roundCols : [0]).map((_, j) => (
                            <span key={j} style={{ color: C.txt3, fontWeight: 600, flexShrink: 0, width: 28, textAlign: "center" }}>-</span>
                          ))}
                          <span style={{ color: C.txt3, fontWeight: 600, flexShrink: 0, width: 28, textAlign: "center" }}>-</span>
                          <span style={{ color: C.txt3, fontWeight: 600, flexShrink: 0, width: 28, textAlign: "center" }}>-</span>
                          <span style={{ color: C.txt3, fontWeight: 600, flexShrink: 0, width: 32, textAlign: "right" }}>-</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Standings leaderboard */}
      <div style={{ padding: "12px 16px 100px" }}>
        <StandingsList
          title="Leaderboard"
          entries={teams}
          colors={C}
          myTeamId={myTeamId}
          showThru={false}
          badgeColor={tColor}
          emptyMessage={isFuture ? "Tournament hasn't started yet." : "No leaderboard data yet. Sim a round to see results."}
          emptySlots={Math.max(0, managerCount - teams.length)}
        />
      </div>
    </div>
  );
}
