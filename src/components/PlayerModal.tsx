import { useState, useEffect, useRef, useCallback } from "react";
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

const COUNTRY_TO_ISO: Record<string, string> = {
  ARG: "AR", AUS: "AU", AUT: "AT", BEL: "BE", CAN: "CA", CHI: "CL",
  COL: "CO", ENG: "GB", ESP: "ES", FRA: "FR", GER: "DE", IRL: "IE",
  JPN: "JP", KOR: "KR", NIR: "GB", NOR: "NO", NZL: "NZ", RSA: "ZA",
  SCO: "GB", SWE: "SE", TPE: "TW", USA: "US", VEN: "VE",
};

function countryFlag(code: string): string {
  const iso = COUNTRY_TO_ISO[code];
  if (!iso) return "";
  return String.fromCodePoint(...[...iso].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

export function PlayerModal({ playerId, leagueId, colors: C, onClose }: PlayerModalProps) {
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"scores" | "points">("scores");
  const [pullDisplay, setPullDisplay] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullStartY = useRef(0);
  const pullY = useRef(0);
  const pullActive = useRef(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const fetchPlayer = useCallback(() => {
    return getPlayer(playerId, leagueId);
  }, [playerId, leagueId]);

  useEffect(() => {
    let cancelled = false;
    fetchPlayer()
      .then((d) => { if (!cancelled) setPlayer(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load"); });
    return () => { cancelled = true; };
  }, [fetchPlayer]);

  const onBodyTouchStart = useCallback((e: React.TouchEvent) => {
    if (bodyRef.current && bodyRef.current.scrollTop <= 0 && !refreshing) {
      pullStartY.current = e.touches[0].clientY;
      pullActive.current = true;
    }
  }, [refreshing]);

  const onBodyTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullActive.current) return;
    const diff = e.touches[0].clientY - pullStartY.current;
    if (diff > 0) {
      pullY.current = Math.min(diff * 0.5, 100);
      setPullDisplay(pullY.current);
    } else {
      pullActive.current = false;
      pullY.current = 0;
      setPullDisplay(0);
    }
  }, []);

  const onBodyTouchEnd = useCallback(async () => {
    if (!pullActive.current) return;
    pullActive.current = false;
    if (pullY.current >= 60) {
      setRefreshing(true);
      setPullDisplay(60);
      try {
        const d = await fetchPlayer();
        setPlayer(d);
      } catch {
        // silent
      } finally {
        setRefreshing(false);
        setPullDisplay(0);
      }
    } else {
      setPullDisplay(0);
    }
    pullY.current = 0;
  }, [fetchPlayer]);

  const hasData = player && player.holeScores && player.holeScores.length > 0;

  return (
    <div
      onClick={onClose}
      onTouchMove={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: 16,
        overscrollBehavior: "contain",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onBodyTouchStart}
        onTouchMove={onBodyTouchMove}
        onTouchEnd={onBodyTouchEnd}
        ref={bodyRef}
        style={{
          width: "100%",
          background: C.bg,
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          overscrollBehavior: "contain",
        }}
      >
        {/* Pull to refresh indicator */}
        {(pullDisplay > 0 || refreshing) && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: pullDisplay, overflow: "hidden", flexShrink: 0 }}>
            <div style={{
              width: 20,
              height: 20,
              border: `3px solid ${C.border}`,
              borderTopColor: C.green,
              borderRadius: "50%",
              animation: refreshing ? "spin 0.7s linear infinite" : undefined,
              transform: !refreshing ? `rotate(${pullDisplay * 4}deg)` : undefined,
              opacity: Math.min(pullDisplay / 60, 1),
            }} />
          </div>
        )}
        {/* Header */}
        <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${C.border}`, flexShrink: 0, position: "relative" }}>
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              width: 28,
              height: 28,
              borderRadius: 14,
              border: "none",
              background: C.card2,
              color: C.txt3,
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
          {error ? (
            <p style={{ color: C.red, fontSize: 14, margin: 0 }}>{error}</p>
          ) : !player ? (
            <>
              <div style={{ background: C.card, borderRadius: 6, height: 22, width: "60%", marginBottom: 10 }} />
              <div style={{ background: C.card, borderRadius: 6, height: 14, width: "40%" }} />
            </>
          ) : (
            <>
              <p style={{ fontSize: 20, fontWeight: 700, color: C.txt, margin: 0, paddingRight: 32 }}>{player.name}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: C.txt2 }}>#{player.ranking}</span>
                <span style={{ fontSize: 13, color: C.txt2 }}><span style={{ fontSize: 18 }}>{countryFlag(player.country)}</span> {player.country}</span>
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

        {/* Stat bar */}
        {player && hasData && (() => {
          const currentRound = player.holeScores.length;
          const lastRoundHoles = player.holeScores[currentRound - 1] ?? [];
          const thru = lastRoundHoles.filter((s) => s != null).length;
          const totalStrokes = player.rounds.reduce((a, b) => a + b, 0);
          const tot = player.status === "active" ? player.toParDisplay : `${totalStrokes}`;
          const statStyle: React.CSSProperties = { flex: 1, textAlign: "center" };
          const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: C.txt3, textTransform: "uppercase", letterSpacing: 0.5, margin: 0 };
          const valStyle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: C.txt, margin: "2px 0 0" };
          return (
            <div style={{ display: "flex", margin: "12px 16px 0", background: C.card, borderRadius: 8, border: `1px solid ${C.border}`, padding: "8px 0" }}>
              <div style={statStyle}>
                <p style={labelStyle}>RND</p>
                <p style={valStyle}>{currentRound}</p>
              </div>
              <div style={{ width: 1, background: C.border }} />
              <div style={statStyle}>
                <p style={labelStyle}>THRU</p>
                <p style={valStyle}>{thru === 18 ? "F" : thru}</p>
              </div>
              <div style={{ width: 1, background: C.border }} />
              <div style={statStyle}>
                <p style={labelStyle}>TOT</p>
                <p style={{ ...valStyle, color: player.status === "active" ? (player.toPar < 0 ? C.green : player.toPar > 0 ? C.red : C.txt) : C.txt }}>{tot}</p>
              </div>
              <div style={{ width: 1, background: C.border }} />
              <div style={statStyle}>
                <p style={labelStyle}>PTS</p>
                <p style={{ ...valStyle, color: player.points > 0 ? C.green : player.points < 0 ? C.red : C.txt3 }}>{player.points}</p>
              </div>
            </div>
          );
        })()}

        {/* Body */}
        <div style={{ flex: 1, padding: hasData ? "12px 16px" : "0" }}>
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

      </div>
    </div>
  );
}

function ScoresTab({ player, C }: { player: PlayerDetail; C: Theme }) {
  const { holeScores, holePars } = player;
  const CELL = 26;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {holeScores.map((round, ri) => {
        const front = round.slice(0, 9);
        const back = round.slice(9, 18);
        const frontPar = holePars.slice(0, 9);
        const backPar = holePars.slice(9, 18);
        const frontParSum = frontPar.reduce((s, v) => s + v, 0);
        const backParSum = backPar.reduce((s, v) => s + v, 0);

        const renderNineRows = (holes: (number | null)[], pars: number[], parSum: number, startHole: number) => (
          <>
            <tr>
              <td style={{ ...cellStyle(C), fontWeight: 600, color: C.txt3, width: 38, fontSize: 10 }}>{startHole === 0 ? "Front" : "Back"}</td>
              {holes.map((_, h) => (
                <td key={h} style={{ ...cellStyle(C), color: C.txt3, fontSize: 10 }}>{startHole + h + 1}</td>
              ))}
              <td style={{ ...cellStyle(C), fontWeight: 600, color: C.txt3, fontSize: 10 }}>{startHole === 0 ? "Out" : "In"}</td>
            </tr>
            <tr style={{ opacity: 0.5 }}>
              <td style={{ ...cellStyle(C), fontWeight: 600, color: C.txt3, fontSize: 10 }}>Par</td>
              {pars.map((p, h) => (
                <td key={h} style={{ ...cellStyle(C), color: C.txt3, fontSize: 10 }}>{p}</td>
              ))}
              <td style={{ ...cellStyle(C), fontWeight: 600, color: C.txt3, fontSize: 10 }}>{parSum}</td>
            </tr>
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
          </>
        );

        return (
          <div key={ri}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.txt, margin: 0 }}>Round {ri + 1}</p>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.txt, margin: 0 }}>{player.rounds[ri]}</span>
            </div>
            <div style={{ background: C.card, borderRadius: 0, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 280 }}>
                  <tbody>
                    {renderNineRows(front, frontPar, frontParSum, 0)}
                  </tbody>
                </table>
              </div>
            </div>
            <div style={{ height: 8 }} />
            <div style={{ background: C.card, borderRadius: 0, border: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 280 }}>
                  <tbody>
                    {renderNineRows(back, backPar, backParSum, 9)}
                  </tbody>
                </table>
              </div>
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
      {/* Summary table */}
      <div style={{ background: C.card, borderRadius: 0, border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "center" }}>
          <thead>
            <tr style={{ background: C.card2 }}>
              {["Double", "Bogey", "Par", "Birdie", "Eagle"].map((name) => (
                <th key={name} style={{ padding: "6px 4px", fontWeight: 600, color: C.txt2, borderBottom: `1px solid ${C.border}` }}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {["Double", "Bogey", "Par", "Birdie", "Eagle"].map((name) => {
                const count = counts[name] ?? 0;
                const isGood = ["Eagle", "Birdie"].includes(name);
                const isBad = ["Bogey", "Double"].includes(name);
                return (
                  <td key={name} style={{ padding: "8px 4px", fontWeight: 600, color: count === 0 ? C.txt3 : isGood ? C.green : isBad ? C.red : C.txt, borderBottom: `1px solid ${C.border}` }}>
                    {count}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px" }}>
          <span style={{ fontSize: 13, color: C.txt2 }}>Total Points</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: player.points >= 0 ? C.green : C.red }}>
            {player.points >= 0 ? "+" : ""}{player.points}
          </span>
        </div>
      </div>

      {holeScores.map((round, ri) => {
        const rPts = roundPoints[ri] ?? 0;
        const holes = holePoints[ri] ?? [];

        return (
          <div key={ri}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.txt, margin: 0 }}>Round {ri + 1}</p>
              <span style={{ fontSize: 13, fontWeight: 700, color: rPts >= 0 ? C.green : C.red }}>
                {rPts >= 0 ? "+" : ""}{rPts} pts
              </span>
            </div>
            <div style={{ background: C.card, borderRadius: 0, border: `1px solid ${C.border}`, overflow: "hidden" }}>
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

    </div>
  );
}
