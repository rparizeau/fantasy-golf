import { useState, useEffect, useCallback } from "react";
import { getRoster, getFantasyLeaderboard, getLeagues, type RosterPlayer, type RosterData } from "../api";
import { PlayerModal } from "./PlayerModal";
import { ManagerIcon } from "./ManagerIcon";
import type { Theme } from "../theme";

const COL = { r: 26, p: 38, gap: 2 };

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

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
  const [totalTeams, setTotalTeams] = useState(0);
  const [projectedTotal, setProjectedTotal] = useState(0);
  const [rivalAbove, setRivalAbove] = useState<{ name: string; points: number; rank: number } | null>(null);
  const [rivalBelow, setRivalBelow] = useState<{ name: string; points: number; rank: number } | null>(null);
  const [, setSeasonRank] = useState(0);
  const [, setSeasonRankTied] = useState(false);
  const [managerName, setManagerName] = useState("");
  const [modalPlayerId, setModalPlayerId] = useState<number | null>(null);

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
            let above: typeof rivalAbove = null;
            for (let i = myIdx - 1; i >= 0; i--) {
              if (sorted[i].totalPoints !== myPts) {
                above = { name: sorted[i].teamName, points: sorted[i].totalPoints, rank: i + 1 };
                break;
              }
            }
            let below: typeof rivalBelow = null;
            for (let i = myIdx + 1; i < sorted.length; i++) {
              if (sorted[i].totalPoints !== myPts) {
                below = { name: sorted[i].teamName, points: sorted[i].totalPoints, rank: i + 1 };
                break;
              }
            }
            const projTotal = sorted[myIdx].projectedRoundPoints.reduce((a, b) => a + b, 0);
            const tied = sorted.filter((t) => t.totalPoints === myPts).length > 1;
            setMyRank(sorted.findIndex((t) => t.totalPoints === myPts) + 1);
            setTotalTeams(sorted.length);
            setProjectedTotal(projTotal);
            setRivalAbove(above);
            setRivalBelow(below);
            setManagerName(sorted[myIdx].managerName);
            void tied;
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

  const teamRoundPoints = [0, 1, 2, 3].map((ri) =>
    data.roster.filter((p) => p.isActive).reduce((sum, p) => sum + (p.roundPoints[ri] ?? 0), 0)
  );
  const teamProjRoundPoints = [0, 1, 2, 3].map((ri) =>
    data.roster.filter((p) => p.isActive).reduce((sum, p) => sum + (p.projectedRoundPoints?.[ri] ?? 0), 0)
  );

  return (
    <div style={{ background: `${tournamentColor ?? "#003C80"}15` }}>
      <div style={{ padding: "12px 16px 0" }}>
        {/* SQUAD header */}
        <div style={{ display: "flex", alignItems: "center", padding: "0 14px 8px" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <p style={{ ...colStyle, margin: 0, whiteSpace: "nowrap" }}>Squad</p>
          </div>
          <div style={{ display: "flex", gap: COL.gap, flexShrink: 0, marginRight: 1 }}>
            {["R1", "R2", "R3", "R4"].map((l) => (
              <div key={l} style={{ width: COL.r, textAlign: "center" }}><span style={colStyle}>{l}</span></div>
            ))}
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
                {managerName && <p style={{ fontSize: 11, color: C.txt3, margin: "2px 0 0" }}>{managerName}</p>}
              </div>
            </div>
            <div style={{ display: "flex", gap: COL.gap, flexShrink: 0, alignItems: "flex-start" }}>
              {[0, 1, 2, 3].map((ri) => {
                const pts = teamRoundPoints[ri];
                const proj = teamProjRoundPoints[ri];
                const played = pts != null && pts !== 0;
                return (
                  <div key={ri} style={{ width: COL.r, textAlign: "center" }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: played ? C.txt : C.txt3, margin: 0, height: 20, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                      {played ? pts : "-"}
                    </p>
                    <p style={{ fontSize: 10, color: C.txt3, margin: 0, lineHeight: 1.3 }}>
                      {played ? proj : proj ? `${proj}` : "-"}
                    </p>
                  </div>
                );
              })}
              <div style={{ width: COL.p, textAlign: "right" }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.txt, margin: 0, height: 20, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>{myPoints}</p>
                <p style={{ fontSize: 10, color: C.txt3, margin: 0, lineHeight: 1.3, textAlign: "right" }}>
                  {projectedTotal > 0 ? `${projectedTotal}` : "-"}
                </p>
              </div>
            </div>
          </div>
          {/* Rival rows */}
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {myRank > 0 ? (
              <>
                {rivalAbove ? (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: C.txt2 }}>▲ {ordinal(rivalAbove.rank)} · {rivalAbove.name}</span>
                    <span style={{ color: C.txt3 }}>+{rivalAbove.points - myPoints} pts · <span style={{ color: C.txt2 }}>{rivalAbove.points}</span></span>
                  </div>
                ) : myRank === 1 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <span style={{ color: C.txt2, fontSize: 10 }}>●</span>
                    <span style={{ color: C.txt2 }}>You are the current leader!</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, height: 18 }} />
                )}
                {rivalBelow ? (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: C.txt2 }}>▼ {ordinal(rivalBelow.rank)} · {rivalBelow.name}</span>
                    <span style={{ color: C.txt3 }}>-{myPoints - rivalBelow.points} pts · <span style={{ color: C.txt2 }}>{rivalBelow.points}</span></span>
                  </div>
                ) : myRank === totalTeams && totalTeams > 1 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <span style={{ color: C.txt3, fontSize: 10 }}>■</span>
                    <span style={{ color: C.txt3 }}>You are currently last place</span>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, height: 18 }} />
                )}
              </>
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: C.txt3 }}>No leaderboard yet</span>
                </div>
                <div style={{ fontSize: 13, height: 18 }} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Active player cards */}
      <div style={{ padding: "0 16px 6px" }}>
        {activePlayers.map((p) => (
          <SquadPlayerCard key={p.playerId} player={p} colors={C} onTap={() => setModalPlayerId(p.playerId)} />
        ))}
      </div>

      {modalPlayerId !== null && (
        <PlayerModal playerId={modalPlayerId} leagueId={leagueId} colors={C} onClose={() => setModalPlayerId(null)} />
      )}
    </div>
  );
}

function SquadPlayerCard({ player: p, colors: C, onTap }: { player: RosterPlayer; colors: Theme; onTap: () => void }) {
  const hasRounds = p.rounds.length > 0;

  return (
    <div
      onClick={onTap}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 14px",
        minHeight: 58,
        boxSizing: "border-box",
        background: C.card,
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        marginBottom: 6,
        cursor: "pointer",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: C.txt, fontSize: 14, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: C.txt3 }}>#{p.ranking}</span>
          <span style={{ fontSize: 11, color: C.txt3 }}>{p.country}</span>
          {!p.inField && <span style={{ fontSize: 10, color: C.red, fontWeight: 600 }}>NOT IN FIELD</span>}
          {p.status === "cut" && <span style={{ fontSize: 10, color: C.red, fontWeight: 600 }}>CUT</span>}
          {p.status === "wd" && <span style={{ fontSize: 10, color: C.red, fontWeight: 600 }}>WD</span>}
        </div>
      </div>

      <div style={{ display: "flex", gap: COL.gap, flexShrink: 0, alignItems: "flex-start" }}>
        {[0, 1, 2, 3].map((i) => {
          const rPts = p.roundPoints[i];
          const proj = p.projectedRoundPoints[i];
          const played = rPts != null && rPts !== 0;
          return (
            <div key={i} style={{ width: COL.r, textAlign: "center" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: played ? C.txt : C.txt3, margin: 0, height: 20, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                {played ? rPts : "-"}
              </p>
              <p style={{ fontSize: 10, color: C.txt3, margin: 0, lineHeight: 1.3 }}>
                {played ? proj : proj ? `${proj}` : "-"}
              </p>
            </div>
          );
        })}
        {(() => {
          const projTotal = p.projectedRoundPoints.length > 0
            ? p.projectedRoundPoints.reduce((a, b) => a + b, 0)
            : 0;
          return (
            <div style={{ width: COL.p, textAlign: "right" }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: hasRounds ? C.txt : C.txt3, margin: 0, height: 20, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
                {hasRounds ? p.points : "-"}
              </p>
              <p style={{ fontSize: 10, color: C.txt3, margin: 0, lineHeight: 1.3, textAlign: "right" }}>
                {projTotal > 0 ? `${projTotal}` : "-"}
              </p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
