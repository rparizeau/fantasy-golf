import { useState, useEffect, useCallback } from "react";
import { getRoster, getFantasyLeaderboard, getLeagues, type RosterData } from "../api";
import { ManagerIcon } from "./ManagerIcon";
import type { Theme } from "../theme";

const COL = { r: 26, p: 38, gap: 2 };

interface MatchSquadProps {
  leagueId: number;
  teamId: number;
  colors: Theme;
  tournamentId: number;
  tournamentColor?: string;
  simTick: number;
  onLoaded?: () => void;
}

export function MatchSquad({ leagueId, teamId, colors: C, tournamentId, tournamentColor, simTick, onLoaded }: MatchSquadProps) {
  const [data, setData] = useState<RosterData | null>(null);
  const [myPoints, setMyPoints] = useState(0);
  const [myRank, setMyRank] = useState(0);
  const [projectedTotal, setProjectedTotal] = useState(0);
  const [, setSeasonRank] = useState(0);
  const [, setSeasonRankTied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [d, lb] = await Promise.all([
        getRoster(leagueId, teamId, tournamentId),
        getFantasyLeaderboard(leagueId, tournamentId),
      ]);
      setData(d);
      const weekPts = d.roster.filter((p) => p.isActive).reduce((sum, p) => sum + p.points, 0);
      setMyPoints(weekPts);

      if (lb) {
        const sorted = lb.teams;
        const hasScores = sorted.some(t => t.totalPoints !== 0);
        if (hasScores) {
          const myIdx = sorted.findIndex(t => t.teamId === teamId);
          if (myIdx >= 0) {
            const myPts = sorted[myIdx].totalPoints;
            const projTotal = sorted[myIdx].projectedRoundPoints.reduce((a, b) => a + b, 0);
            setMyRank(sorted.findIndex((t) => t.totalPoints === myPts) + 1);
            setProjectedTotal(projTotal);
          }
        }
      }
    } catch {
      // silent
    }
    onLoaded?.();
  }, [leagueId, teamId, tournamentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (simTick > 0) refresh(); }, [simTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getLeagues().then((leagues) => {
      const mine = leagues.find((l) => l.id === leagueId);
      if (mine) { setSeasonRank(mine.rank); setSeasonRankTied(mine.rankTied); }
    }).catch(() => {});
  }, [leagueId]);

  if (!data) return null;

  const activePlayers = data.roster.filter((p) => p.isActive).sort((a, b) => a.ranking - b.ranking);
  const colStyle: React.CSSProperties = { color: C.txt2, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 };

  return (
    <div style={{ background: `${tournamentColor ?? "#003C80"}15` }}>
      <div style={{ padding: "12px 16px 16px" }}>
        {/* MATCH header */}
        <div style={{ display: "flex", alignItems: "center", padding: "0 14px 8px" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <p style={{ ...colStyle, margin: 0, whiteSpace: "nowrap" }}>Match</p>
          </div>
          <div style={{ flexShrink: 0, marginRight: 1 }}>
            <div style={{ width: COL.p, textAlign: "right" }}><span style={colStyle}>PTS</span></div>
          </div>
        </div>

        {/* Summary card */}
        <div style={{
          background: C.card,
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          padding: "14px 14px",
          marginBottom: 6,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <ManagerIcon size={34} bgColor={data.color ?? "#2D6B4A"} />
                {myRank > 0 && (
                  <span style={{
                    position: "absolute",
                    top: -6,
                    left: -6,
                    zIndex: 2,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: 20,
                    height: 18,
                    borderRadius: 5,
                    background: `linear-gradient(${tournamentColor ? `${tournamentColor}20` : C.card2}, ${tournamentColor ? `${tournamentColor}20` : C.card2}), ${C.card}`,
                    color: tournamentColor ?? C.txt2,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "0 4px",
                    border: `1px solid ${tournamentColor ?? C.border}`,
                  }}>{myRank}</span>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: C.txt, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.teamName}</p>
              </div>
            </div>
            <div style={{ flexShrink: 0, textAlign: "right" }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: myPoints > 0 ? C.txt : C.txt3, margin: 0 }}>{myPoints > 0 ? myPoints : "-"}</p>
              <p style={{ fontSize: 11, color: C.txt3, margin: "2px 0 0" }}>{projectedTotal > 0 ? `${projectedTotal} proj` : "-"}</p>
            </div>
          </div>
          {/* Active golfers */}
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
        </div>
      </div>

    </div>
  );
}
