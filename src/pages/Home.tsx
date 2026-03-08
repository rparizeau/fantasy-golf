import { useState, useEffect, useCallback } from "react";
import { getFantasyLeaderboard, getRoster, type FantasyTeamSummary, type TournamentListItem, type RosterData } from "../api";
import { StandingsList } from "../components/StandingsList";
import { ManagerIcon } from "../components/ManagerIcon";
import type { Theme } from "../theme";

const COL = { p: 38 };

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
  const [myRoster, setMyRoster] = useState<RosterData | null>(null);
  const [managerCount, setManagerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tid = tournaments[viewingWeek]?.id;
  const tColor = tournaments[viewingWeek]?.color;

  const refresh = useCallback(async () => {
    if (!tid) return;
    try {
      const [lb, roster] = await Promise.all([
        getFantasyLeaderboard(leagueId, tid),
        getRoster(leagueId, myTeamId, tid),
      ]);
      setTeams(lb.teams);
      setManagerCount(lb.managerCount ?? lb.teams.length);
      setMyRoster(roster);
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

  // For my team, use the full roster data (has positionTied); for others, use leaderboard data
  const myTeamLb = teams.find((t) => t.teamId === myTeamId);
  const myActivePlayers = myRoster
    ? myRoster.roster.filter((p) => p.isActive).sort((a, b) => a.ranking - b.ranking)
    : [];
  const myPoints = myActivePlayers.reduce((sum, p) => sum + p.points, 0);
  const myRank = myTeamLb ? teams.findIndex((t) => t.totalPoints === myTeamLb.totalPoints) + 1 : 0;
  const myProjTotal = myTeamLb?.projectedRoundPoints.reduce((a, b) => a + b, 0) ?? 0;

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
            <div style={{ flexShrink: 0, marginRight: 1 }}>
              <div style={{ width: COL.p, textAlign: "right" }}><span style={colStyle}>PTS</span></div>
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
              {/* My team card */}
              {myRoster && (
                <div style={{
                  background: C.card,
                  borderRadius: 12,
                  border: `1px solid ${tColor ?? C.green}`,
                  padding: "14px 14px",
                  marginBottom: 6,
                  boxShadow: `0 0 0 1px ${(tColor ?? C.green)}40`,
                  overflow: "visible",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: myActivePlayers.length > 0 ? 10 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                      <div style={{ position: "relative", flexShrink: 0, overflow: "visible" }}>
                        <ManagerIcon size={34} bgColor={myRoster.color ?? "#2D6B4A"} />
                        {myRank > 0 && (
                          <span style={{
                            position: "absolute", top: -6, left: -6, zIndex: 2,
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            minWidth: 20, height: 18, borderRadius: 5,
                            background: `linear-gradient(${tColor ? `${tColor}20` : C.card2}, ${tColor ? `${tColor}20` : C.card2}), ${C.card}`,
                            color: tColor ?? C.txt2, fontSize: 11, fontWeight: 700, padding: "0 4px",
                            border: `1px solid ${tColor ?? C.border}`,
                          }}>{myRank}</span>
                        )}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: 16, fontWeight: 700, color: C.txt, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{myRoster.teamName}</p>
                        {myTeamLb && <p style={{ fontSize: 11, color: C.txt3, margin: "2px 0 0" }}>{myTeamLb.managerName}</p>}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, textAlign: "right" }}>
                      <p style={{ fontSize: 16, fontWeight: 700, color: myPoints > 0 ? C.txt : C.txt3, margin: 0 }}>{myPoints > 0 ? myPoints : "-"}</p>
                      <p style={{ fontSize: 11, color: C.txt3, margin: "2px 0 0" }}>{myProjTotal > 0 ? `${myProjTotal} proj` : "-"}</p>
                    </div>
                  </div>
                  {myActivePlayers.length > 0 && (
                    <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                      {myActivePlayers.map((p) => {
                        const hasPos = p.status === "active" && p.position > 0;
                        const posLabel = hasPos ? `${p.positionTied ? "T" : ""}${p.position}` : "";
                        return (
                          <div key={p.playerId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                            <span style={{ color: C.txt2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
                              {hasPos && <span style={{ color: C.txt3, marginRight: 6 }}>{posLabel}</span>}
                              {p.name}
                            </span>
                            <span style={{ color: p.points > 0 ? C.txt : C.txt3, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{p.points > 0 ? p.points : "-"}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Other teams */}
              {teams.filter((t) => t.teamId !== myTeamId).map((team) => {
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
                      border: `1px solid ${C.border}`,
                      padding: "14px 14px",
                      marginBottom: 6,
                      overflow: "visible",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: activePlayers.length > 0 ? 10 : 0 }}>
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
                          <p style={{ fontSize: 14, fontWeight: 600, color: C.txt, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.teamName}</p>
                          <p style={{ fontSize: 11, color: C.txt3, margin: "2px 0 0" }}>{team.managerName}</p>
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, textAlign: "right" }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: team.totalPoints > 0 ? C.txt : C.txt3, margin: 0 }}>{team.totalPoints > 0 ? team.totalPoints : "-"}</p>
                        <p style={{ fontSize: 11, color: C.txt3, margin: "2px 0 0" }}>{projTotal > 0 ? `${projTotal} proj` : "-"}</p>
                      </div>
                    </div>
                    {activePlayers.length > 0 && (
                      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                        {activePlayers.map((p) => {
                          const hasPos = p.status === "active" && p.position > 0;
                          const posLabel = hasPos ? `${p.positionTied ? "T" : ""}${p.position}` : "";
                          return (
                            <div key={p.playerId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                              <span style={{ color: C.txt2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
                                {hasPos && <span style={{ color: C.txt3, marginRight: 6 }}>{posLabel}</span>}
                                {p.name}
                              </span>
                              <span style={{ color: p.points > 0 ? C.txt : C.txt3, fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>{p.points > 0 ? p.points : "-"}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
