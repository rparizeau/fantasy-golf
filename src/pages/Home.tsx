import { useState, useEffect, useCallback } from "react";
import { getFantasyLeaderboard, type FantasyTeamSummary } from "../api";
import type { Theme } from "../theme";

interface HomeProps {
  leagueId: number;
  myTeamId: number;
  colors: Theme;
}

export function Home({ leagueId, myTeamId, colors: C }: HomeProps) {
  const [teams, setTeams] = useState<FantasyTeamSummary[]>([]);
  const [phase, setPhase] = useState("");
  const [tournamentName, setTournamentName] = useState("");
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getFantasyLeaderboard(leagueId);
      setTeams(data.teams);
      setPhase(data.phase);
      setTournamentName(data.tournamentName);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  if (loading) {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              background: C.card,
              borderRadius: 12,
              height: 72,
              marginBottom: 8,
              border: `1px solid ${C.border}`,
              animation: "pulse 2s infinite",
            }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <div style={{ background: C.redDim, color: C.red, padding: "12px 16px", borderRadius: 10, fontSize: 13 }}>
          {error}
        </div>
        <button
          onClick={refresh}
          style={{
            marginTop: 12,
            padding: "8px 16px",
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            background: C.card,
            color: C.txt,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 16px 100px" }}>
      {/* Phase indicator */}
      {phase !== "idle" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
            padding: "8px 12px",
            background: C.card,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
          }}
        >
          <span style={{ fontSize: 12, color: C.txt2 }}>{tournamentName}</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: phase === "final" ? C.blue : C.greenBright,
              textTransform: "uppercase",
            }}
          >
            {phase === "final" ? "Final" : phase === "cut" ? "Cut Applied" : phase.replace("round", "R")}
          </span>
        </div>
      )}

      {/* Team leaderboard */}
      {teams.map((team, idx) => {
        const isMe = team.teamId === myTeamId;
        const isExpanded = expandedTeam === team.teamId;

        return (
          <div
            key={team.teamId}
            style={{
              background: C.card,
              borderRadius: 12,
              marginBottom: 8,
              border: `1px solid ${isMe ? C.green : C.border}`,
              overflow: "hidden",
              boxShadow: isMe ? `0 0 0 1px ${C.green}40` : undefined,
            }}
          >
            {/* Team row */}
            <div
              onClick={() => setExpandedTeam(isExpanded ? null : team.teamId)}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 14px",
                cursor: "pointer",
                gap: 12,
              }}
            >
              {/* Rank */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: idx === 0 ? C.goldDim : C.card2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  color: idx === 0 ? C.gold : C.txt2,
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </div>

              {/* Team info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <p
                    style={{
                      color: C.txt,
                      fontSize: 14,
                      fontWeight: 600,
                      margin: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {team.teamName}
                  </p>
                  {isMe && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: C.green,
                        background: C.greenDim,
                        padding: "1px 6px",
                        borderRadius: 6,
                        flexShrink: 0,
                      }}
                    >
                      YOU
                    </span>
                  )}
                </div>
                <p style={{ color: C.txt3, fontSize: 11, margin: "2px 0 0" }}>{team.managerName}</p>
              </div>

              {/* Points */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p
                  style={{
                    color: team.totalPoints > 0 ? C.greenBright : C.txt3,
                    fontSize: 15,
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  {team.totalPoints} pts
                </p>
                <p style={{ color: C.txt3, fontSize: 10, margin: "1px 0 0" }}>this week</p>
              </div>

              {/* Expand chevron */}
              <span
                style={{
                  color: C.txt3,
                  fontSize: 16,
                  transform: isExpanded ? "rotate(90deg)" : "none",
                  transition: "transform .15s",
                  flexShrink: 0,
                }}
              >
                ›
              </span>
            </div>

            {/* Expanded player detail */}
            {isExpanded && (
              <div style={{ borderTop: `1px solid ${C.border}` }}>
                {team.players
                  .slice()
                  .sort((a, b) => {
                    // Active first, then by position
                    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
                    return a.position - b.position;
                  })
                  .map((player) => (
                    <div
                      key={player.playerId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "8px 14px",
                        borderBottom: `1px solid ${C.border}`,
                        opacity: player.isActive ? 1 : 0.5,
                      }}
                    >
                      {/* Active indicator */}
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: player.isActive ? C.greenBright : C.txt3,
                          marginRight: 10,
                          flexShrink: 0,
                        }}
                      />

                      {/* Player name + status */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            color: C.txt,
                            fontSize: 13,
                            fontWeight: 500,
                            margin: 0,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {player.name}
                        </p>
                        <div style={{ display: "flex", gap: 6, marginTop: 1 }}>
                          {player.status === "cut" && (
                            <span style={{ fontSize: 10, color: C.red, fontWeight: 600 }}>CUT</span>
                          )}
                          {player.status === "wd" && (
                            <span style={{ fontSize: 10, color: C.red, fontWeight: 600 }}>WD</span>
                          )}
                          {!player.isActive && player.status === "active" && (
                            <span style={{ fontSize: 10, color: C.txt3 }}>BENCH</span>
                          )}
                        </div>
                      </div>

                      {/* Score */}
                      <div style={{ textAlign: "center", width: 40 }}>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            margin: 0,
                            color:
                              player.toPar < 0
                                ? C.red
                                : player.toPar > 0
                                  ? C.txt2
                                  : C.txt3,
                          }}
                        >
                          {player.toParDisplay}
                        </p>
                        <p style={{ fontSize: 9, color: C.txt3, margin: 0 }}>
                          {player.status === "cut" ? "MC" : player.position > 0 ? `T${player.position}` : "-"}
                        </p>
                      </div>

                      {/* Points */}
                      <div style={{ textAlign: "right", width: 60 }}>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            margin: 0,
                            color: player.points > 0 ? C.greenBright : C.txt3,
                          }}
                        >
                          {player.points} pts
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}

      {phase === "idle" && teams.length > 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "24px 16px",
            color: C.txt3,
            fontSize: 13,
          }}
        >
          Tournament hasn't started yet. Points will update as rounds are played.
        </div>
      )}
    </div>
  );
}
