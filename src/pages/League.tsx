import { useState, useEffect, useCallback } from "react";
import { getSeasonStandings, type SeasonStanding } from "../api";
import type { Theme } from "../theme";

interface LeagueStandingsProps {
  leagueId: number;
  colors: Theme;
}

export function LeagueStandings({ leagueId, colors: C }: LeagueStandingsProps) {
  const [standings, setStandings] = useState<SeasonStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getSeasonStandings(leagueId);
      setStandings(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div style={{ padding: "12px 16px 100px" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              background: C.card,
              borderRadius: 10,
              height: 64,
              marginBottom: 6,
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
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 16px 100px" }}>
      <p style={{ color: C.txt2, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, margin: "0 0 10px" }}>
        Season Standings
      </p>

      {standings.map((team, idx) => {
        const isExpanded = expandedTeam === team.teamId;
        const movement = team.previousRank - team.currentRank;

        return (
          <div
            key={team.teamId}
            style={{
              background: C.card,
              borderRadius: 12,
              marginBottom: 8,
              border: `1px solid ${C.border}`,
              overflow: "hidden",
            }}
          >
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

              {/* Team */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: C.txt, fontSize: 14, fontWeight: 600, margin: 0 }}>{team.teamName}</p>
                <p style={{ color: C.txt3, fontSize: 11, margin: "1px 0 0" }}>{team.managerName}</p>
              </div>

              {/* Movement */}
              {movement !== 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: movement > 0 ? C.greenBright : C.red,
                  }}
                >
                  {movement > 0 ? `+${movement}` : movement}
                </span>
              )}

              {/* Total */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ color: C.greenBright, fontSize: 15, fontWeight: 700, margin: 0 }}>
                  ${team.totalEarnings.toLocaleString()}
                </p>
                <p style={{ color: C.txt3, fontSize: 10, margin: 0 }}>season</p>
              </div>

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

            {/* Tournament breakdown */}
            {isExpanded && team.tournamentEarnings.length > 0 && (
              <div style={{ borderTop: `1px solid ${C.border}`, padding: "8px 14px" }}>
                {team.tournamentEarnings.map((te) => (
                  <div
                    key={te.tournamentId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "4px 0",
                    }}
                  >
                    <span style={{ fontSize: 12, color: C.txt2 }}>{te.tournamentName}</span>
                    <span style={{ fontSize: 12, color: C.greenBright, fontWeight: 600 }}>
                      ${te.earnings.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {standings.length === 0 && (
        <div style={{ textAlign: "center", padding: 24, color: C.txt3, fontSize: 13 }}>
          No standings data yet. Complete a tournament to see results.
        </div>
      )}
    </div>
  );
}
