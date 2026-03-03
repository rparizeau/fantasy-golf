import React, { useState, useEffect, useCallback } from "react";
import {
  getSimState,
  advanceSim,
  rewindSim,
  updatePlayer,
  resetSim,
  getLeaderboard,
  getTournamentList,
  type SimStatus,
  type LeaderboardPlayer,
  type TournamentListItem,
  type Leaderboard as _Leaderboard,
} from "../api";

const PHASE_LABELS: Record<string, string> = {
  idle: "Idle — Waiting to Start",
  round1: "Round 1 Complete",
  round2: "Round 2 Complete",
  cut: "Cut Applied",
  round3: "Round 3 Complete",
  round4: "Round 4 Complete",
  final: "Tournament Final",
};


function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// --- Player Edit Modal ---

interface ModalProps {
  player: LeaderboardPlayer;
  par: number;
  holePars?: number[];
  onSave: (playerId: number, updates: { rounds?: (number | null)[]; status: string; holeScores?: ((number | null)[] | null)[] }) => void;
  onClose: () => void;
}

function PlayerEditModal({ player, par, holePars, onSave, onClose }: ModalProps) {
  const roundCount = player.rounds.length;
  const hasHoleData = player.holeScores && player.holeScores.length > 0;

  // Determine which round to open to
  const initialRound = (() => {
    for (let i = 0; i < 4; i++) {
      const hs = player.holeScores?.[i];
      if (!hs || hs.length === 0 || hs.every((s) => s == null)) return i;
    }
    return Math.max(0, roundCount - 1);
  })();

  // Initialize hole scores state: deep copy from player data, auto-init the active round
  const [holeData, setHoleData] = useState<((number | null)[] | null)[]>(() => {
    const data: ((number | null)[] | null)[] = [];
    for (let i = 0; i < 4; i++) {
      const hs = player.holeScores?.[i];
      if (hs && hs.length > 0) {
        data.push([...hs]);
      } else if (i === initialRound) {
        data.push(new Array(18).fill(null));
      } else {
        data.push(null);
      }
    }
    return data;
  });

  // Fallback round totals for old state without hole-level data
  const [fallbackRounds, setFallbackRounds] = useState<(number | null)[]>(() => {
    return [player.rounds[0] ?? null, player.rounds[1] ?? null, player.rounds[2] ?? null, player.rounds[3] ?? null];
  });

  const [activeRound, setActiveRound] = useState(initialRound);
  const [status, setStatus] = useState(player.status === "active" ? "Active" : player.status === "wd" ? "WD" : "Cut");

  const pars = holePars ?? Array(18).fill(4);

  // Compute totals — only sum non-null holes
  const computedRounds: (number | null)[] = [];
  let overallTotal = 0;
  let overallParForScored = 0;
  for (let i = 0; i < 4; i++) {
    const holes = holeData[i];
    if (holes) {
      const scored = holes.filter((s): s is number => s != null);
      if (scored.length > 0) {
        const roundSum = scored.reduce((sum, s) => sum + s, 0);
        computedRounds.push(roundSum);
        overallTotal += roundSum;
        // Add par only for scored holes
        holes.forEach((s, h) => { if (s != null) overallParForScored += pars[h] ?? 4; });
      } else {
        computedRounds.push(null);
      }
    } else if (fallbackRounds[i] != null) {
      computedRounds.push(fallbackRounds[i]);
      overallTotal += fallbackRounds[i]!;
      overallParForScored += par; // full round par for fallback totals
    } else {
      computedRounds.push(null);
    }
  }
  const hasAnyScore = computedRounds.some((r) => r != null);
  const toPar = hasAnyScore ? overallTotal - overallParForScored : 0;
  const toParDisplay = !hasAnyScore ? "-" : toPar === 0 ? "E" : toPar > 0 ? `+${toPar}` : `${toPar}`;

  // Active round hole data
  const activeHoles = holeData[activeRound];
  const canEditHoles = activeHoles != null;

  // Front/back 9 totals for active round — only scored holes
  const sumScored = (holes: (number | null)[]) => {
    const scored = holes.filter((s): s is number => s != null);
    return scored.length > 0 ? scored.reduce((a, b) => a + b, 0) : null;
  };
  const front9 = activeHoles ? sumScored(activeHoles.slice(0, 9)) : null;
  const back9 = activeHoles ? sumScored(activeHoles.slice(9, 18)) : null;
  const roundTotal = activeHoles ? sumScored(activeHoles) : null;
  // Round to-par based on scored holes only
  let roundParForScored = 0;
  if (activeHoles) {
    activeHoles.forEach((s, h) => { if (s != null) roundParForScored += pars[h] ?? 4; });
  }
  const roundToPar = roundTotal != null ? roundTotal - roundParForScored : null;

  const updateHole = (holeIdx: number, value: number | null) => {
    setHoleData((prev) => {
      const next = [...prev];
      if (next[activeRound]) {
        const holes = [...next[activeRound]!];
        holes[holeIdx] = value;
        next[activeRound] = holes;
      }
      return next;
    });
  };

  /** Initialize a round with all nulls (blank scorecard). */
  const addRound = (roundIdx: number) => {
    setHoleData((prev) => {
      const next = [...prev];
      next[roundIdx] = new Array(18).fill(null);
      return next;
    });
    setActiveRound(roundIdx);
  };


  const handleSave = () => {
    if (hasHoleData || holeData.some((h) => h != null)) {
      onSave(player.playerId, { status, holeScores: holeData });
    } else {
      onSave(player.playerId, { rounds: fallbackRounds, status });
    }
  };

  const formatToPar = (v: number) => (v === 0 ? "E" : v > 0 ? `+${v}` : `${v}`);

  const scoreColor = (score: number, holePar: number) => {
    const diff = score - holePar;
    if (diff <= -2) return "#1565C0"; // eagle+
    if (diff === -1) return "#2D8B52"; // birdie
    if (diff === 0) return "#1A1D21";  // par
    if (diff === 1) return "#D94438";  // bogey
    return "#B71C1C";                  // double+
  };

  const scoreBg = (score: number, holePar: number) => {
    const diff = score - holePar;
    if (diff <= -2) return "#E3F2FD";
    if (diff === -1) return "#E8F5EE";
    if (diff === 1) return "#FDECEB";
    if (diff >= 2) return "#FFCDD2";
    return "transparent";
  };

  return (
    <div style={modal.overlay} onClick={onClose}>
      <div style={{ ...modal.dialog, width: 620 }} onClick={(e) => e.stopPropagation()}>
        {/* Title bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #E2E5EA" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#8E95A0", textTransform: "uppercase", letterSpacing: 0.5 }}>Player Scores</div>
          <button style={modal.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {/* Player header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #E2E5EA" }}>
          <div>
            <div style={modal.playerName}>{player.name}</div>
            <div style={{ fontSize: 12, color: "#8E95A0", marginTop: 2 }}>{ordinal(player.ranking)} &middot; {player.country}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={modal.metaLabel}>Status</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)} style={modal.select}>
                <option value="Active">Active</option>
                <option value="Cut">Cut</option>
                <option value="WD">WD</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={modal.metaLabel}>Total</span>
              <span style={{ ...modal.metaValue, fontSize: 20, color: toPar < 0 ? "#2D8B52" : toPar > 0 ? "#D94438" : "#1A1D21" }}>{toParDisplay}</span>
            </div>
          </div>
        </div>

        {/* Round tabs */}
        <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #E2E5EA", padding: "0 20px" }}>
          {[0, 1, 2, 3].map((i) => {
            const roundExists = holeData[i] != null || fallbackRounds[i] != null;
            const isActive = i === activeRound && roundExists;
            return (
              <button
                key={i}
                onClick={() => roundExists ? setActiveRound(i) : addRound(i)}
                style={{
                  padding: "10px 16px",
                  border: "none",
                  borderBottom: isActive ? "2px solid #2D8B52" : "2px solid transparent",
                  marginBottom: -1,
                  background: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  color: !roundExists ? "#8E95A0" : isActive ? "#1A1D21" : "#8E95A0",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                R{i + 1}
                {computedRounds[i] != null && (
                  <span style={{ fontSize: 11, color: "#8E95A0", fontWeight: 400 }}>
                    ({computedRounds[i]})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Hole grid */}
        <div style={{ padding: "16px 20px", overflowX: "auto" }}>
          {canEditHoles ? (
            <>
              {/* Front 9 */}
              <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: "#8E95A0", textTransform: "uppercase", letterSpacing: 0.3 }}>Front 9</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4, marginBottom: 12 }}>
                {pars.slice(0, 9).map((holePar, idx) => {
                  const score = activeHoles![idx];
                  return (
                    <div key={idx} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#8E95A0", marginBottom: 2 }}>
                        {idx + 1} <span style={{ fontSize: 9 }}>P{holePar}</span>
                      </div>
                      <input
                        type="number"
                        value={score ?? ""}
                        placeholder="-"
                        onChange={(e) => {
                          if (e.target.value === "") { updateHole(idx, null); return; }
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v >= 1 && v <= 12) updateHole(idx, v);
                        }}
                        style={{
                          width: "100%",
                          padding: "6px 2px",
                          borderRadius: 6,
                          border: "1px solid #E2E5EA",
                          fontSize: 14,
                          fontWeight: 600,
                          textAlign: "center",
                          outline: "none",
                          boxSizing: "border-box",
                          color: score != null ? scoreColor(score, holePar) : "#CCC",
                          background: score != null ? scoreBg(score, holePar) : "transparent",
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Back 9 */}
              <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: "#8E95A0", textTransform: "uppercase", letterSpacing: 0.3 }}>Back 9</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 4, marginBottom: 16 }}>
                {pars.slice(9, 18).map((holePar, idx) => {
                  const realIdx = idx + 9;
                  const score = activeHoles![realIdx];
                  return (
                    <div key={realIdx} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: "#8E95A0", marginBottom: 2 }}>
                        {realIdx + 1} <span style={{ fontSize: 9 }}>P{holePar}</span>
                      </div>
                      <input
                        type="number"
                        value={score ?? ""}
                        placeholder="-"
                        onChange={(e) => {
                          if (e.target.value === "") { updateHole(realIdx, null); return; }
                          const v = parseInt(e.target.value);
                          if (!isNaN(v) && v >= 1 && v <= 12) updateHole(realIdx, v);
                        }}
                        style={{
                          width: "100%",
                          padding: "6px 2px",
                          borderRadius: 6,
                          border: "1px solid #E2E5EA",
                          fontSize: 14,
                          fontWeight: 600,
                          textAlign: "center",
                          outline: "none",
                          boxSizing: "border-box",
                          color: score != null ? scoreColor(score, holePar) : "#CCC",
                          background: score != null ? scoreBg(score, holePar) : "transparent",
                        }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Summary row */}
              <div style={{
                display: "flex",
                gap: 16,
                justifyContent: "center",
                padding: "10px 0",
                borderTop: "1px solid #E2E5EA",
                fontSize: 13,
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#8E95A0", fontWeight: 600, textTransform: "uppercase" }}>Out</div>
                  <div style={{ fontWeight: 600, color: "#1A1D21" }}>{front9}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#8E95A0", fontWeight: 600, textTransform: "uppercase" }}>In</div>
                  <div style={{ fontWeight: 600, color: "#1A1D21" }}>{back9}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#8E95A0", fontWeight: 600, textTransform: "uppercase" }}>Score</div>
                  <div style={{ fontWeight: 600, color: "#1A1D21" }}>{roundTotal}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#8E95A0", fontWeight: 600, textTransform: "uppercase" }}>Total</div>
                  <div style={{
                    fontWeight: 600,
                    color: roundToPar != null && roundToPar < 0 ? "#2D8B52" : roundToPar != null && roundToPar > 0 ? "#D94438" : "#1A1D21",
                  }}>
                    {roundToPar != null ? formatToPar(roundToPar) : "-"}
                  </div>
                </div>
              </div>
            </>
          ) : roundCount > 0 ? (
            /* Fallback: editable round totals when no hole-level data */
            <div>
              <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: "#8E95A0", textTransform: "uppercase", letterSpacing: 0.3 }}>
                Round totals (no hole-level data)
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {[0, 1, 2, 3].map((i) => {
                  if (player.rounds[i] == null) return null;
                  return (
                    <div key={i} style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#8E95A0", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>
                        R{i + 1}
                      </label>
                      <input
                        type="number"
                        value={fallbackRounds[i] ?? ""}
                        onChange={(e) => {
                          const v = e.target.value === "" ? null : Number(e.target.value);
                          setFallbackRounds((prev) => {
                            const next = [...prev];
                            next[i] = v;
                            return next;
                          });
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #E2E5EA",
                          fontSize: 14,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0", color: "#8E95A0", fontSize: 13 }}>
              Click <strong>+ R1</strong> above to enter scores
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={modal.footer}>
          <button style={modal.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={modal.saveBtn} onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

// --- SimPanel ---

export function SimPanel() {
  const [sim, setSim] = useState<SimStatus | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [holePars, setHolePars] = useState<number[] | undefined>(undefined);
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const [editingPlayer, setEditingPlayer] = useState<LeaderboardPlayer | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [simData, lbData] = await Promise.all([getSimState(), getLeaderboard()]);
      setSim(simData);
      setLeaderboard(lbData.players);
      setHolePars(lbData.holePars);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    }
  }, []);

  useEffect(() => {
    refresh();
    getTournamentList().then(setTournaments).catch(() => {});
  }, [refresh]);

  const handleSelectTournament = async (tournamentId: number) => {
    if (sim && tournamentId === sim.tournamentId) return;
    setLoading(true);
    setSearchQuery("");
    setPage(0);
    try {
      await resetSim(tournamentId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Switch failed");
    }
    setLoading(false);
  };

  // Which rounds are "on" based on current phase
  const PHASE_ROUND: Record<string, number> = { idle: 0, round1: 1, round2: 2, cut: 2, round3: 3, round4: 4, final: 4 };
  const completedRound = sim ? PHASE_ROUND[sim.phase] ?? 0 : 0;

  /** Advance sim forward until we reach the target round. */
  const handleAdvanceToRound = async (targetRound: number) => {
    if (!sim) return;
    setLoading(true);
    try {
      // Keep advancing until currentRound reaches target
      let phase = sim.phase;
      let round = sim.currentRound;
      while (round < targetRound || (phase === "cut" && targetRound > 2)) {
        const result = await advanceSim();
        phase = result.phase;
        round = result.currentRound;
        if (phase === "final") break;
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Advance failed");
    }
    setLoading(false);
  };

  /** Rewind sim backward until we're before the target round. */
  const handleRewindToRound = async (targetRound: number) => {
    if (!sim) return;
    setLoading(true);
    try {
      let phase = sim.phase;
      let round = PHASE_ROUND[phase] ?? 0;
      while (round >= targetRound && phase !== "idle") {
        const result = await rewindSim();
        phase = result.phase;
        round = PHASE_ROUND[phase] ?? 0;
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rewind failed");
    }
    setLoading(false);
  };

  const handleToggleRound = async (round: number) => {
    const isOn = completedRound >= round;
    if (isOn) {
      await handleRewindToRound(round);
    } else {
      await handleAdvanceToRound(round);
    }
  };


  const handleReset = async () => {
    setLoading(true);
    try {
      await resetSim(sim?.tournamentId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    }
    setLoading(false);
  };

  const handlePlayerSave = async (playerId: number, updates: { rounds?: (number | null)[]; status: string; holeScores?: ((number | null)[] | null)[] }) => {
    try {
      const apiUpdates: { rounds?: (number | null)[]; status?: string; holeScores?: ((number | null)[] | null)[] } = {
        status: updates.status === "Active" ? "active" : updates.status === "WD" ? "wd" : "cut",
      };
      if (updates.holeScores) apiUpdates.holeScores = updates.holeScores;
      else if (updates.rounds) apiUpdates.rounds = updates.rounds;
      await updatePlayer(playerId, apiUpdates);
      setEditingPlayer(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  };

  // Compute cumulative to-par for a player (used for sorting + TOT column)
  const calcToPar = (p: LeaderboardPlayer) => {
    const pars = holePars ?? Array(18).fill(4);
    let total = 0;
    let hasRound = false;
    for (let i = 0; i < 4; i++) {
      const hs = p.holeScores?.[i];
      if (hs && hs.some((s) => s != null)) {
        hasRound = true;
        hs.forEach((s, h) => { if (s != null) total += s - (pars[h] ?? 4); });
      } else if (p.rounds[i] != null) {
        hasRound = true;
        total += p.rounds[i] - (sim?.par ?? 72);
      }
    }
    return { toPar: total, hasScore: hasRound };
  };

  // Sort: players with scores first (by to-par), then unscored by world rank
  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    const aCalc = calcToPar(a);
    const bCalc = calcToPar(b);
    if (aCalc.hasScore && !bCalc.hasScore) return -1;
    if (!aCalc.hasScore && bCalc.hasScore) return 1;
    if (aCalc.hasScore && bCalc.hasScore) return aCalc.toPar - bCalc.toPar || a.ranking - b.ranking;
    return a.ranking - b.ranking;
  });

  // Compute positions from sorted order (with ties)
  const positionMap = new Map<number, { pos: number; tied: boolean }>();
  let pos = 1;
  for (let i = 0; i < sortedLeaderboard.length; i++) {
    const p = sortedLeaderboard[i];
    const { toPar, hasScore } = calcToPar(p);
    if (!hasScore) { positionMap.set(p.playerId, { pos: 0, tied: false }); continue; }
    if (i > 0) {
      const prev = sortedLeaderboard[i - 1];
      const prevCalc = calcToPar(prev);
      if (prevCalc.hasScore && toPar === prevCalc.toPar) {
        // Same score as previous — same position (tied)
      } else {
        pos = i + 1;
      }
    }
    positionMap.set(p.playerId, { pos, tied: false });
  }
  // Mark ties
  for (const [, val] of positionMap) {
    if (val.pos === 0) continue;
    const count = [...positionMap.values()].filter((v) => v.pos === val.pos).length;
    if (count > 1) val.tied = true;
  }

  const filteredPlayers = searchQuery
    ? sortedLeaderboard.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : sortedLeaderboard;

  const totalPages = Math.ceil(filteredPlayers.length / pageSize);
  const displayedPlayers = filteredPlayers.slice(page * pageSize, (page + 1) * pageSize);

  const activeTournament = tournaments.find((t) => t.id === sim?.tournamentId);

  if (!sim) {
    return <div style={styles.container}><p style={styles.loading}>Loading sim state...</p></div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Sim Panel</h1>

      {/* Tournament Tabs */}
      <div style={styles.tabBar}>
        {tournaments.map((t) => {
          const isActive = t.id === sim.tournamentId;
          return (
            <button
              key={t.id}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
              }}
              onClick={() => handleSelectTournament(t.id)}
              disabled={loading}
            >
              <span>{t.name}</span>
              {t.isMajor && <span style={styles.majorBadge}>M</span>}
            </button>
          );
        })}
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* Tournament Info + Status */}
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          {activeTournament && (
            <div>
              <div style={styles.tournamentName}>{activeTournament.name}</div>
              <div style={styles.tournamentMeta}>
                {activeTournament.course} &middot; Par {activeTournament.par} &middot; ${(activeTournament.purse / 1_000_000).toFixed(1)}M purse
              </div>
            </div>
          )}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={styles.phasePill}>
              <span style={{
                ...styles.phaseDot,
                background: sim.phase === "final" ? "#8E95A0" : sim.phase === "idle" ? "#E2A03F" : "#2D8B52",
              }} />
              {PHASE_LABELS[sim.phase] || sim.phase}
            </div>
            <div style={styles.statusGrid}>
              <StatusItem label="Round" value={sim.currentRound || "-"} />
              <StatusItem label="Field" value={sim.fieldSize} />
              <StatusItem label="Active" value={sim.activePlayers} />
              <StatusItem label="Cut" value={sim.cutPlayers} />
              <StatusItem label="WD" value={sim.wdPlayers} />
              {sim.cutLine !== null && <StatusItem label="Cut Line" value={sim.cutLine} />}
            </div>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div style={styles.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <input
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              style={{ ...styles.input, flex: 1 }}
            />
            <button style={styles.dangerBtn} onClick={handleReset} disabled={loading}>
              Reset
            </button>
        </div>
            <div style={{ position: "relative" }}>
            {loading && (
              <div style={styles.tableOverlay}>
                <div style={styles.spinner} />
              </div>
            )}
            <table style={styles.table}>
              <colgroup>
                <col style={{ width: 40 }} />
                <col />
                <col style={{ width: 80 }} />
                <col style={{ width: 36 }} />
                <col style={{ width: 36 }} />
                <col style={{ width: 36 }} />
                <col style={{ width: 36 }} />
                <col style={{ width: 36 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 55 }} />
                <col style={{ width: 55 }} />
                <col style={{ width: 55 }} />
                <col style={{ width: 55 }} />
                <col style={{ width: 50 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...styles.th, textAlign: "left" }}>Pos</th>
                  <th style={{ ...styles.th, textAlign: "left" }}>Player</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>DBL</th>
                  <th style={styles.th}>BOG</th>
                  <th style={styles.th}>PAR</th>
                  <th style={styles.th}>BRD</th>
                  <th style={styles.th}>EGL</th>
                  <th style={styles.th}>Thru</th>
                  {[1, 2, 3, 4].map((r) => {
                    const isOn = completedRound >= r;
                    return (
                      <th key={r} style={styles.th}>
                        <button
                          onClick={() => handleToggleRound(r)}
                          disabled={loading}
                          style={{
                            padding: "4px 8px",
                            borderRadius: 6,
                            border: isOn ? "1px solid #2D8B52" : "1px solid #E2E5EA",
                            background: isOn ? "#2D8B52" : "#fff",
                            color: isOn ? "#fff" : "#8E95A0",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          R{r}
                        </button>
                      </th>
                    );
                  })}
                  <th style={{ ...styles.th, textAlign: "right" }}>Tot</th>
                </tr>
              </thead>
              <tbody>
                {displayedPlayers.map((p) => {
                  const posData = positionMap.get(p.playerId);
                  const posLabel = !posData || posData.pos === 0 ? "-"
                    : p.status === "cut" ? "MC"
                    : posData.tied ? `T${posData.pos}`
                    : `${posData.pos}`;
                  return (
                  <tr key={p.playerId} style={p.status === "cut" ? { opacity: 0.5 } : {}}>
                    <td style={{ ...styles.td, textAlign: "left" }}>{posLabel}</td>
                    <td style={{ ...styles.td, textAlign: "left", fontWeight: 500 }}>
                      <span style={{ color: "#B0B5BC", fontSize: 11, fontWeight: 400, marginRight: 6 }}>{p.ranking}</span>
                      <span style={{ cursor: "pointer" }} onClick={() => setEditingPlayer(p)}>{p.name}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.statusBadge}>Active</span>
                    </td>
                    {(() => {
                      const counts = { egl: 0, brd: 0, par: 0, bog: 0, dbog: 0 };
                      const pars = holePars ?? [];
                      if (p.holeScores) {
                        for (const round of p.holeScores) {
                          for (let h = 0; h < round.length; h++) {
                            const s = round[h];
                            if (s == null) continue;
                            const diff = s - (pars[h] ?? 4);
                            if (diff <= -2) counts.egl++;
                            else if (diff === -1) counts.brd++;
                            else if (diff === 0) counts.par++;
                            else if (diff === 1) counts.bog++;
                            else counts.dbog++;
                          }
                        }
                      }
                      return (
                        <>
                          <td style={styles.td}>{counts.dbog || "-"}</td>
                          <td style={styles.td}>{counts.bog || "-"}</td>
                          <td style={styles.td}>{counts.par || "-"}</td>
                          <td style={styles.td}>{counts.brd || "-"}</td>
                          <td style={styles.td}>{counts.egl || "-"}</td>
                        </>
                      );
                    })()}
                    <td style={styles.td}>
                      {(() => {
                        if (p.holeScores && p.holeScores.length > 0) {
                          for (let r = p.holeScores.length - 1; r >= 0; r--) {
                            const round = p.holeScores[r];
                            if (round && round.some((s) => s != null)) {
                              let lastHole = 0;
                              for (let h = round.length - 1; h >= 0; h--) {
                                if (round[h] != null) { lastHole = h + 1; break; }
                              }
                              return <>{lastHole}<span style={{ color: "#B0B5BC", fontSize: 10, fontWeight: 400, marginLeft: 2 }}>(R{r + 1})</span></>;
                            }
                          }
                        } else if (p.rounds.length > 0) {
                          return <>18<span style={{ color: "#B0B5BC", fontSize: 10, fontWeight: 400, marginLeft: 2 }}>(R{p.rounds.length})</span></>;
                        }
                        return "-";
                      })()}
                    </td>
                    {[0, 1, 2, 3].map((i) => {
                      const score = p.rounds[i];
                      if (score == null) return <td key={i} style={styles.td}>-</td>;
                      const hs = p.holeScores?.[i];
                      const holesPlayed = hs ? hs.filter((s) => s != null).length : 18;
                      const isComplete = holesPlayed === 18;
                      if (isComplete) {
                        return (
                          <td key={i} style={{ ...styles.td, fontWeight: 600 }}>{score}</td>
                        );
                      }
                      const rtp = score - (holePars ?? Array(18).fill(4)).slice(0, holesPlayed).reduce((a, b) => a + b, 0);
                      const rtpStr = rtp === 0 ? "E" : rtp > 0 ? `+${rtp}` : `${rtp}`;
                      return (
                        <td key={i} style={{ ...styles.td, color: rtp < 0 ? "#2D8B52" : rtp > 0 ? "#D94438" : "#1A1D21", fontWeight: 600 }}>
                          {rtpStr}
                        </td>
                      );
                    })}
                    {(() => {
                      const { toPar: cumToPar, hasScore } = calcToPar(p);
                      const display = !hasScore ? "-" : cumToPar === 0 ? "E" : cumToPar > 0 ? `+${cumToPar}` : `${cumToPar}`;
                      return (
                        <td style={{
                          ...styles.td,
                          textAlign: "right",
                          color: cumToPar < 0 ? "#2D8B52" : cumToPar > 0 ? "#D94438" : "#1A1D21",
                          fontWeight: 600,
                        }}>
                          {display}
                        </td>
                      );
                    })()}
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div style={styles.pagination}>
                <button
                  style={styles.pageBtn}
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                >
                  Prev
                </button>
                <span style={styles.pageInfo}>
                  {page + 1} of {totalPages}
                </span>
                <button
                  style={styles.pageBtn}
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Next
                </button>
              </div>
            )}
            </div>
      </div>

      {/* Player Edit Modal */}
      {editingPlayer && (
        <PlayerEditModal
          player={editingPlayer}
          par={sim.par}
          holePars={holePars}
          onSave={handlePlayerSave}
          onClose={() => setEditingPlayer(null)}
        />
      )}
    </div>
  );
}

function StatusItem({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#8E95A0", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: "#1A1D21", marginTop: 2 }}>{value}</div>
    </div>
  );
}

// --- Modal styles ---

const modal: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  dialog: {
    background: "#fff",
    borderRadius: 12,
    width: 480,
    maxWidth: "90vw",
    boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "20px 20px 16px",
    borderBottom: "1px solid #E2E5EA",
  },
  playerName: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1A1D21",
    marginBottom: 8,
  },
  headerMeta: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: 4,
    fontSize: 13,
    justifyContent: "space-between",
  },
  metaLabel: {
    color: "#8E95A0",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
  },
  metaValue: {
    color: "#1A1D21",
    fontWeight: 600,
    fontSize: 13,
    marginLeft: 4,
  },
  select: {
    padding: "3px 8px",
    borderRadius: 6,
    border: "1px solid #E2E5EA",
    fontSize: 13,
    color: "#1A1D21",
    background: "#fff",
    outline: "none",
    marginLeft: 4,
    cursor: "pointer",
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: 22,
    color: "#8E95A0",
    cursor: "pointer",
    padding: "0 4px",
    lineHeight: 1,
  },
  body: {
    padding: 20,
  },
  roundRow: {
    display: "flex",
    gap: 12,
  },
  roundField: {
    flex: 1,
  },
  fieldLabel: {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "#8E95A0",
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  fieldInput: {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #E2E5EA",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box" as const,
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    padding: "16px 20px",
    borderTop: "1px solid #E2E5EA",
    background: "#F9FAFB",
  },
  cancelBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid #E2E5EA",
    background: "#fff",
    color: "#1A1D21",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  saveBtn: {
    padding: "8px 20px",
    borderRadius: 8,
    border: "none",
    background: "#2D8B52",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};

// --- Page styles ---

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "20px 16px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: "#F4F5F7",
    minHeight: "100vh",
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "#1A1D21",
    marginBottom: 12,
  },
  loading: {
    color: "#8E95A0",
    textAlign: "center",
    padding: 40,
  },
  tabBar: {
    display: "flex",
    gap: 0,
    overflowX: "auto",
    marginBottom: 16,
    borderBottom: "2px solid #E2E5EA",
    WebkitOverflowScrolling: "touch",
  },
  tab: {
    padding: "10px 16px",
    border: "none",
    borderBottom: "2px solid transparent",
    marginBottom: -2,
    background: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontSize: 13,
    fontWeight: 500,
    color: "#8E95A0",
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "color 0.15s, border-color 0.15s",
  },
  tabActive: {
    color: "#1A1D21",
    fontWeight: 700,
    borderBottomColor: "#2D8B52",
  },
  majorBadge: {
    display: "inline-block",
    fontSize: 9,
    fontWeight: 700,
    background: "#E8D44D",
    color: "#5C4E00",
    borderRadius: 3,
    padding: "1px 4px",
    lineHeight: "14px",
  },
  tournamentHeader: {
    marginBottom: 12,
  },
  tournamentName: {
    fontSize: 18,
    fontWeight: 700,
    color: "#1A1D21",
  },
  tournamentMeta: {
    fontSize: 13,
    color: "#8E95A0",
    marginTop: 2,
  },
  phasePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: "#1A1D21",
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    display: "inline-block",
  },
  error: {
    background: "#FDECEB",
    color: "#D94438",
    padding: "10px 14px",
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 13,
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #E2E5EA",
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: 700,
    color: "#1A1D21",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusGrid: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
  },
  buttonRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  primaryBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: "#2D8B52",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  dangerBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: "#D94438",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  input: {
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid #E2E5EA",
    fontSize: 13,
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
  },
  editBtn: {
    background: "none",
    border: "1px solid #E2E5EA",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 11,
    color: "#8E95A0",
    cursor: "pointer",
    fontWeight: 500,
  },
  statusBadge: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 600,
    color: "#2D8B52",
    background: "#E8F5EE",
    borderRadius: 4,
    padding: "1px 5px",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  pageBtn: {
    padding: "6px 14px",
    borderRadius: 6,
    border: "1px solid #E2E5EA",
    background: "#fff",
    color: "#1A1D21",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  pageInfo: {
    fontSize: 12,
    color: "#8E95A0",
    fontWeight: 500,
  },
  tableOverlay: {
    position: "absolute",
    inset: 0,
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.6)",
    backdropFilter: "blur(2px)",
    borderRadius: 8,
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid #E2E5EA",
    borderTopColor: "#2D8B52",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    tableLayout: "fixed",
    fontSize: 13,
  },
  th: {
    padding: "6px 8px",
    textAlign: "center",
    fontSize: 11,
    fontWeight: 600,
    color: "#8E95A0",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    borderBottom: "1px solid #E2E5EA",
  },
  td: {
    padding: "6px 8px",
    textAlign: "center",
    borderBottom: "1px solid #F4F5F7",
    color: "#1A1D21",
  },
};
