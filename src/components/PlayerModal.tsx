import { useState, useEffect } from "react";
import { getPlayer, type PlayerDetail } from "../api";
import type { Theme } from "../theme";

interface PlayerModalProps {
  playerId: number;
  leagueId?: number;
  colors: Theme;
  onClose: () => void;
}

function scoreName(score: number, par: number): string {
  const diff = score - par;
  if (score === 1) return "Ace";
  if (diff <= -3) return "Albatross";
  if (diff === -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Double";
  return "Triple+";
}

function scoreColor(score: number, par: number, C: Theme): string {
  const diff = score - par;
  if (diff <= -2) return C.green;
  if (diff === -1) return C.green;
  if (diff === 0) return C.txt2;
  if (diff === 1) return C.red;
  return C.red;
}

function scoreBg(score: number, par: number, C: Theme): string {
  const diff = score - par;
  if (diff <= -2) return C.greenDim;
  if (diff === -1) return C.greenDim;
  if (diff === 0) return "transparent";
  if (diff === 1) return C.redDim;
  return C.redDim;
}

export function PlayerModal({ playerId, leagueId, colors: C, onClose }: PlayerModalProps) {
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"scores" | "points">("scores");

  useEffect(() => {
    let cancelled = false;
    getPlayer(playerId, leagueId)
      .then((d) => { if (!cancelled) setPlayer(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load"); });
    return () => { cancelled = true; };
  }, [playerId, leagueId]);

  const hasData = player && player.holeScores && player.holeScores.length > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: C.bg,
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${C.border}` }}>
          {error ? (
            <p style={{ color: C.red, fontSize: 14, margin: 0 }}>{error}</p>
          ) : !player ? (
            <>
              <div style={{ background: C.card, borderRadius: 6, height: 22, width: "60%", marginBottom: 10 }} />
              <div style={{ background: C.card, borderRadius: 6, height: 14, width: "40%" }} />
            </>
          ) : (
            <>
              <p style={{ fontSize: 20, fontWeight: 700, color: C.txt, margin: 0 }}>{player.name}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: C.txt2 }}>#{player.ranking}</span>
                <span style={{ fontSize: 13, color: C.txt2 }}>{player.country}</span>
                {player.status === "cut" && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.red, background: C.redDim, padding: "2px 8px", borderRadius: 6 }}>CUT</span>
                )}
                {player.status === "wd" && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.red, background: C.redDim, padding: "2px 8px", borderRadius: 6 }}>WD</span>
                )}
                {player.status === "active" && player.rounds.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.green, background: C.greenDim, padding: "2px 8px", borderRadius: 6 }}>
                    {player.toParDisplay}
                  </span>
                )}
                {player.rounds.length > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.txt2, background: C.card, padding: "2px 8px", borderRadius: 6 }}>
                    {player.points} pts
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Tab Bar */}
        {player && (
          <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
            {(["scores", "points"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  fontSize: 13,
                  fontWeight: 600,
                  color: tab === t ? C.green : C.txt3,
                  background: "transparent",
                  border: "none",
                  borderBottom: tab === t ? `2px solid ${C.green}` : "2px solid transparent",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: hasData ? "12px 16px" : "0" }}>
          {player && !hasData && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 120 }}>
              <p style={{ color: C.txt3, fontSize: 13 }}>No tournament scores available</p>
            </div>
          )}
          {player && hasData && tab === "scores" && (
            <ScoresTab player={player} C={C} />
          )}
          {player && hasData && tab === "points" && (
            <PointsTab player={player} C={C} />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px 16px", borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: "12px 0",
              fontSize: 15,
              fontWeight: 600,
              color: C.txt,
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoresTab({ player, C }: { player: PlayerDetail; C: Theme }) {
  const { holeScores, holePars, roundPoints } = player;
  const CELL = 26;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {holeScores.map((round, ri) => {
        const front = round.slice(0, 9);
        const back = round.slice(9, 18);
        const frontPar = holePars.slice(0, 9);
        const backPar = holePars.slice(9, 18);
        const frontSum: number = front.reduce<number>((s, v) => s + (v ?? 0), 0);
        const backSum: number = back.reduce<number>((s, v) => s + (v ?? 0), 0);
        const frontParSum = frontPar.reduce((s, v) => s + v, 0);
        const backParSum = backPar.reduce((s, v) => s + v, 0);
        const rPts = roundPoints[ri] ?? 0;

        const renderNine = (holes: (number | null)[], pars: number[], parSum: number, startHole: number) => (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 280 }}>
              <thead>
                <tr>
                  <td style={{ ...cellStyle(C), fontWeight: 600, color: C.txt3, width: 38, fontSize: 10 }}>Hole</td>
                  {holes.map((_, h) => (
                    <td key={h} style={{ ...cellStyle(C), color: C.txt3, fontSize: 10 }}>{startHole + h + 1}</td>
                  ))}
                  <td style={{ ...cellStyle(C), fontWeight: 600, color: C.txt3, fontSize: 10 }}>{startHole === 0 ? "Out" : "In"}</td>
                </tr>
                <tr>
                  <td style={{ ...cellStyle(C), fontWeight: 600, color: C.txt3, fontSize: 10 }}>Par</td>
                  {pars.map((p, h) => (
                    <td key={h} style={{ ...cellStyle(C), color: C.txt3, fontSize: 10 }}>{p}</td>
                  ))}
                  <td style={{ ...cellStyle(C), fontWeight: 600, color: C.txt3, fontSize: 10 }}>{parSum}</td>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...cellStyle(C), fontWeight: 600, color: C.txt3, fontSize: 10 }}></td>
                  {holes.map((score, h) => {
                    if (score == null) {
                      return <td key={h} style={{ ...cellStyle(C), color: C.txt3, fontSize: 11 }}>-</td>;
                    }
                    const par = pars[h];
                    const color = scoreColor(score, par, C);
                    const bg = scoreBg(score, par, C);
                    const diff = score - par;
                    return (
                      <td key={h} style={{ ...cellStyle(C), padding: 0 }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: CELL - 2,
                          height: CELL - 2,
                          margin: "0 auto",
                          borderRadius: diff <= -2 ? "50%" : diff === -1 ? "50%" : diff >= 2 ? 4 : diff === 1 ? 4 : 0,
                          background: diff !== 0 ? bg : "transparent",
                          border: diff <= -2 ? `1.5px solid ${color}` : "none",
                          fontSize: 11,
                          fontWeight: 600,
                          color,
                        }}>
                          {score}
                        </div>
                      </td>
                    );
                  })}
                  <td style={{ ...cellStyle(C), fontWeight: 700, color: C.txt, fontSize: 11 }}>
                    {holes.some((s) => s != null) ? holes.reduce<number>((s, v) => s + (v ?? 0), 0) : "-"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );

        return (
          <div key={ri}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.txt, margin: 0 }}>
                Round {ri + 1} — {player.rounds[ri]}
              </p>
              <span style={{ fontSize: 12, fontWeight: 600, color: rPts >= 0 ? C.green : C.red }}>
                {rPts >= 0 ? "+" : ""}{rPts} pts
              </span>
            </div>
            {renderNine(front, frontPar, frontParSum, 0)}
            <div style={{ height: 4 }} />
            {renderNine(back, backPar, backParSum, 9)}
            {/* Total row */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, padding: "4px 0", marginTop: 2 }}>
              <span style={{ fontSize: 11, color: C.txt3 }}>Total: {frontSum + backSum} ({frontParSum + backParSum} par)</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function cellStyle(C: Theme): React.CSSProperties {
  return {
    textAlign: "center" as const,
    padding: "3px 1px",
    borderBottom: `1px solid ${C.border}`,
    whiteSpace: "nowrap" as const,
  };
}

function PointsTab({ player, C }: { player: PlayerDetail; C: Theme }) {
  const { holeScores, holePars, holePoints, roundPoints } = player;
  let runningTotal = 0;

  // Aggregate counts
  const counts: Record<string, number> = {};
  for (const round of holeScores) {
    for (let h = 0; h < round.length; h++) {
      const score = round[h];
      if (score != null) {
        const name = scoreName(score, holePars[h] ?? 4);
        counts[name] = (counts[name] ?? 0) + 1;
      }
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {holeScores.map((round, ri) => {
        const rPts = roundPoints[ri] ?? 0;
        const holes = holePoints[ri] ?? [];

        return (
          <div key={ri}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.txt, margin: 0 }}>Round {ri + 1}</p>
              <span style={{ fontSize: 12, fontWeight: 600, color: rPts >= 0 ? C.green : C.red }}>
                {rPts >= 0 ? "+" : ""}{rPts} pts
              </span>
            </div>
            <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              {round.map((score, h) => {
                if (score == null) return null;
                const par = holePars[h] ?? 4;
                const pts = holes[h] ?? 0;
                runningTotal += pts;
                const name = scoreName(score, par);
                const diff = score - par;
                const color = diff < 0 ? C.green : diff > 0 ? C.red : C.txt3;

                return (
                  <div
                    key={h}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "6px 12px",
                      borderBottom: h < round.length - 1 ? `1px solid ${C.border}` : "none",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ width: 58, color: C.txt2, flexShrink: 0 }}>Hole {h + 1}</span>
                    <span style={{ width: 44, color: C.txt3, flexShrink: 0 }}>Par {par}</span>
                    <span style={{ flex: 1, fontWeight: 600, color }}>{name}</span>
                    <span style={{ width: 40, textAlign: "right", fontWeight: 600, color: pts > 0 ? C.green : pts < 0 ? C.red : C.txt3, flexShrink: 0 }}>
                      {pts > 0 ? "+" : ""}{pts}
                    </span>
                    <span style={{ width: 40, textAlign: "right", color: C.txt3, flexShrink: 0, fontSize: 11 }}>
                      {runningTotal}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Summary */}
      <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "12px 14px" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.txt, margin: "0 0 8px" }}>Summary</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {["Ace", "Albatross", "Eagle", "Birdie", "Par", "Bogey", "Double", "Triple+"].map((name) => {
            const count = counts[name] ?? 0;
            if (count === 0) return null;
            const isGood = ["Ace", "Albatross", "Eagle", "Birdie"].includes(name);
            const isBad = ["Bogey", "Double", "Triple+"].includes(name);
            return (
              <div
                key={name}
                style={{
                  background: isGood ? C.greenDim : isBad ? C.redDim : C.card2,
                  color: isGood ? C.green : isBad ? C.red : C.txt2,
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {count} {name}{count !== 1 && name !== "Par" ? "s" : ""}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
          <span style={{ fontSize: 13, color: C.txt2 }}>Total Points</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: player.points >= 0 ? C.green : C.red }}>
            {player.points >= 0 ? "+" : ""}{player.points}
          </span>
        </div>
      </div>
    </div>
  );
}
