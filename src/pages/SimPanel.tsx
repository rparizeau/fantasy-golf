import React, { useState, useEffect, useCallback } from "react";
import {
  getSimState,
  advanceSim,
  rewindSim,
  updatePlayer,
  resetSim,
  completeSim,
  rollbackSim,
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

const COL = { r: 26, p: 46, gap: 2 };

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// --- Player Edit Modal (Bottom Sheet) ---

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

  const initialRound = (() => {
    for (let i = 0; i < 4; i++) {
      const hs = player.holeScores?.[i];
      if (!hs || hs.length === 0 || hs.every((s) => s == null)) return i;
    }
    return Math.max(0, roundCount - 1);
  })();

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

  const [fallbackRounds, setFallbackRounds] = useState<(number | null)[]>(() => {
    return [player.rounds[0] ?? null, player.rounds[1] ?? null, player.rounds[2] ?? null, player.rounds[3] ?? null];
  });

  const [activeRound, setActiveRound] = useState(initialRound);
  const [status, setStatus] = useState(player.status === "active" ? "Active" : player.status === "wd" ? "WD" : "Cut");

  const pars = holePars ?? Array(18).fill(4);

  // Compute totals
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
        holes.forEach((s, h) => { if (s != null) overallParForScored += pars[h] ?? 4; });
      } else {
        computedRounds.push(null);
      }
    } else if (fallbackRounds[i] != null) {
      computedRounds.push(fallbackRounds[i]);
      overallTotal += fallbackRounds[i]!;
      overallParForScored += par;
    } else {
      computedRounds.push(null);
    }
  }
  const hasAnyScore = computedRounds.some((r) => r != null);
  const toPar = hasAnyScore ? overallTotal - overallParForScored : 0;
  const toParDisplay = !hasAnyScore ? "-" : toPar === 0 ? "E" : toPar > 0 ? `+${toPar}` : `${toPar}`;

  const activeHoles = holeData[activeRound];
  const canEditHoles = activeHoles != null;

  const sumScored = (holes: (number | null)[]) => {
    const scored = holes.filter((s): s is number => s != null);
    return scored.length > 0 ? scored.reduce((a, b) => a + b, 0) : null;
  };
  const front9 = activeHoles ? sumScored(activeHoles.slice(0, 9)) : null;
  const back9 = activeHoles ? sumScored(activeHoles.slice(9, 18)) : null;
  const roundTotal = activeHoles ? sumScored(activeHoles) : null;
  let roundParForScored = 0;
  if (activeHoles) {
    activeHoles.forEach((s, h) => { if (s != null) roundParForScored += pars[h] ?? 4; });
  }
  const roundToPar = roundTotal != null ? roundTotal - roundParForScored : null;

  // Score type counts across all rounds
  const scoreCounts = { egl: 0, brd: 0, par: 0, bog: 0, dbog: 0, thru: 0 };
  if (player.holeScores) {
    for (const round of player.holeScores) {
      for (let h = 0; h < round.length; h++) {
        const s = round[h];
        if (s == null) continue;
        scoreCounts.thru++;
        const diff = s - (pars[h] ?? 4);
        if (diff <= -2) scoreCounts.egl++;
        else if (diff === -1) scoreCounts.brd++;
        else if (diff === 0) scoreCounts.par++;
        else if (diff === 1) scoreCounts.bog++;
        else scoreCounts.dbog++;
      }
    }
  }

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
    if (diff <= -2) return "#1565C0";
    if (diff === -1) return "#2D8B52";
    if (diff === 0) return "#1A1D21";
    if (diff === 1) return "#D94438";
    return "#B71C1C";
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
      <div style={modal.dialog} onClick={(e) => e.stopPropagation()}>
        {/* Title bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #E2E5EA" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#8E95A0", textTransform: "uppercase", letterSpacing: 0.5 }}>Player Scores</div>
          <button style={modal.closeBtn} onClick={onClose}>&times;</button>
        </div>

        {/* Player header — stacked */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #E2E5EA" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: 17, fontWeight: 700, color: "#1A1D21" }}>{player.name}</span>
              <span style={{ fontSize: 12, color: "#8E95A0", marginLeft: 8 }}>{ordinal(player.ranking)} &middot; {player.country}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
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
              <span style={{ fontWeight: 700, fontSize: 18, color: toPar < 0 ? "#2D8B52" : toPar > 0 ? "#D94438" : "#1A1D21" }}>{toParDisplay}</span>
            </div>
          </div>
        </div>

        {/* Score-type summary bar */}
        <div style={{ display: "flex", justifyContent: "space-around", padding: "10px 16px", borderBottom: "1px solid #E2E5EA", background: "#F9FAFB" }}>
          {([
            { label: "EGL", val: scoreCounts.egl, color: "#1565C0" },
            { label: "BRD", val: scoreCounts.brd, color: "#2D8B52" },
            { label: "PAR", val: scoreCounts.par, color: "#1A1D21" },
            { label: "BOG", val: scoreCounts.bog, color: "#D94438" },
            { label: "DBL", val: scoreCounts.dbog, color: "#B71C1C" },
            { label: "THRU", val: scoreCounts.thru, color: "#8E95A0" },
          ] as const).map(({ label, val, color }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#8E95A0", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color, marginTop: 2 }}>{val || "-"}</div>
            </div>
          ))}
        </div>

        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {/* Round tabs */}
          <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #E2E5EA", padding: "0 16px" }}>
            {[0, 1, 2, 3].map((i) => {
              const roundExists = holeData[i] != null || fallbackRounds[i] != null;
              const isActive = i === activeRound && roundExists;
              return (
                <button
                  key={i}
                  onClick={() => roundExists ? setActiveRound(i) : addRound(i)}
                  style={{
                    padding: "10px 14px",
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
          <div style={{ padding: "14px 16px" }}>
            {canEditHoles ? (
              <>
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
                            color: score != null ? scoreColor(score, realIdx < 18 ? holePar : 4) : "#CCC",
                            background: score != null ? scoreBg(score, realIdx < 18 ? holePar : 4) : "transparent",
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

  const PHASE_ROUND: Record<string, number> = { idle: 0, round1: 1, round2: 2, cut: 2, round3: 3, round4: 4, final: 4 };
  const completedRound = sim ? PHASE_ROUND[sim.phase] ?? 0 : 0;

  const handleAdvanceToRound = async (targetRound: number) => {
    if (!sim) return;
    setLoading(true);
    try {
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

  const handleComplete = async () => {
    setLoading(true);
    try {
      const result = await completeSim();
      if (result.nextTournamentName) {
        alert(`Tournament complete! Next up: ${result.nextTournamentName}`);
      } else {
        alert("Season complete! No more tournaments.");
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Complete failed");
    }
    setLoading(false);
  };

  const handleRollback = async () => {
    setLoading(true);
    try {
      await rollbackSim();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rollback failed");
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

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    const aCalc = calcToPar(a);
    const bCalc = calcToPar(b);
    if (aCalc.hasScore && !bCalc.hasScore) return -1;
    if (!aCalc.hasScore && bCalc.hasScore) return 1;
    if (aCalc.hasScore && bCalc.hasScore) return aCalc.toPar - bCalc.toPar || a.ranking - b.ranking;
    return a.ranking - b.ranking;
  });

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

      {/* Status Card — stacked vertically */}
      <div style={styles.card}>
        {activeTournament && (
          <div style={{ marginBottom: 10 }}>
            <div style={styles.tournamentName}>{activeTournament.name}</div>
            <div style={styles.tournamentMeta}>
              {activeTournament.course} &middot; Par {activeTournament.par} &middot; ${(activeTournament.purse / 1_000_000).toFixed(1)}M purse
            </div>
          </div>
        )}
        <div style={styles.phasePill}>
          <span style={{
            ...styles.phaseDot,
            background: sim.phase === "final" ? "#8E95A0" : sim.phase === "idle" ? "#E2A03F" : "#2D8B52",
          }} />
          {PHASE_LABELS[sim.phase] || sim.phase}
        </div>
        <div style={{ ...styles.statusGrid, marginTop: 10, paddingTop: 10, borderTop: "1px solid #E2E5EA" }}>
          <StatusItem label="Round" value={sim.currentRound || "-"} />
          <StatusItem label="Field" value={sim.fieldSize} />
          <StatusItem label="Active" value={sim.activePlayers} />
          <StatusItem label="Cut" value={sim.cutPlayers} />
          <StatusItem label="WD" value={sim.wdPlayers} />
          {sim.cutLine !== null && <StatusItem label="Cut Line" value={sim.cutLine} />}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {(() => {
          const canComplete = sim.phase === "round4" || sim.phase === "final";
          return (
            <button
              style={{
                ...styles.actionBtn,
                flex: 1,
                background: canComplete ? "#1A73E8" : "#E2E5EA",
                color: canComplete ? "#fff" : "#8E95A0",
                opacity: canComplete ? 1 : 0.6,
              }}
              onClick={handleComplete}
              disabled={loading || !canComplete}
            >
              Complete Week
            </button>
          );
        })()}
        <button
          style={{ ...styles.actionBtn, flex: 1, background: "#D94438", color: "#fff" }}
          onClick={handleReset}
          disabled={loading}
        >
          Reset
        </button>
      </div>

      {/* Round Controls — 4 equal buttons */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[1, 2, 3, 4].map((r) => {
          const isOn = completedRound >= r;
          return (
            <button
              key={r}
              onClick={() => handleToggleRound(r)}
              disabled={loading}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 8,
                border: isOn ? "1.5px solid #2D8B52" : "1.5px solid #E2E5EA",
                background: isOn ? "#2D8B52" : "#fff",
                color: isOn ? "#fff" : "#8E95A0",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              R{r}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search players..."
        value={searchQuery}
        onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
        style={{ ...styles.input, marginTop: 10, marginBottom: 10 }}
      />

      {/* Player Cards */}
      <div style={{ position: "relative" }}>
        {loading && (
          <div style={styles.tableOverlay}>
            <div style={styles.spinner} />
          </div>
        )}

        {/* Column header */}
        <div style={{ display: "flex", alignItems: "center", padding: "0 14px 6px" }}>
          <div style={{ width: 32, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
            <span style={styles.colLabel}>Player</span>
          </div>
          <div style={{ display: "flex", gap: COL.gap, flexShrink: 0 }}>
            {["R1", "R2", "R3", "R4"].map((label) => (
              <div key={label} style={{ width: COL.r, textAlign: "center" }}>
                <span style={styles.colLabel}>{label}</span>
              </div>
            ))}
            <div style={{ width: COL.p, textAlign: "right" }}>
              <span style={styles.colLabel}>TOT</span>
            </div>
          </div>
        </div>

        {/* Player list */}
        {displayedPlayers.map((p) => {
          const posData = positionMap.get(p.playerId);
          const posLabel = !posData || posData.pos === 0 ? "-"
            : p.status === "cut" ? "MC"
            : posData.tied ? `T${posData.pos}`
            : `${posData.pos}`;
          const isCut = p.status === "cut";
          const { toPar: cumToPar, hasScore } = calcToPar(p);
          const totDisplay = !hasScore ? "-" : cumToPar === 0 ? "E" : cumToPar > 0 ? `+${cumToPar}` : `${cumToPar}`;

          // Compute thru info
          let thruLabel = "";
          if (p.holeScores && p.holeScores.length > 0) {
            for (let r = p.holeScores.length - 1; r >= 0; r--) {
              const round = p.holeScores[r];
              if (round && round.some((s) => s != null)) {
                let lastHole = 0;
                for (let h = round.length - 1; h >= 0; h--) {
                  if (round[h] != null) { lastHole = h + 1; break; }
                }
                thruLabel = lastHole === 18 ? "" : `F${lastHole}`;
                break;
              }
            }
          }

          return (
            <div
              key={p.playerId}
              onClick={() => setEditingPlayer(p)}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 14px",
                minHeight: 58,
                boxSizing: "border-box",
                background: "#fff",
                borderRadius: 10,
                border: "1px solid #E2E5EA",
                marginBottom: 6,
                cursor: "pointer",
                opacity: isCut ? 0.5 : 1,
              }}
            >
              {/* Position badge */}
              <div style={{
                width: 32,
                height: 28,
                borderRadius: 8,
                background: "#F4F5F7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "#8E95A0",
                flexShrink: 0,
              }}>
                {posLabel}
              </div>

              {/* Player info */}
              <div style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                <div style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#1A1D21",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {p.name}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 2, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#B0B5BC" }}>#{p.ranking}</span>
                  <span style={{ fontSize: 11, color: "#B0B5BC" }}>{p.country}</span>
                  {isCut && <span style={{ fontSize: 10, color: "#D94438", fontWeight: 600 }}>CUT</span>}
                  {p.status === "wd" && <span style={{ fontSize: 10, color: "#D94438", fontWeight: 600 }}>WD</span>}
                  {thruLabel && <span style={{ fontSize: 10, color: "#8E95A0", fontWeight: 500 }}>{thruLabel}</span>}
                </div>
              </div>

              {/* Round scores + Total */}
              <div style={{ display: "flex", gap: COL.gap, flexShrink: 0, alignItems: "center" }}>
                {[0, 1, 2, 3].map((i) => {
                  const score = p.rounds[i];
                  if (score == null) {
                    return (
                      <div key={i} style={{ width: COL.r, textAlign: "center", fontSize: 12, color: "#B0B5BC" }}>-</div>
                    );
                  }
                  const hs = p.holeScores?.[i];
                  const holesPlayed = hs ? hs.filter((s) => s != null).length : 18;
                  const isComplete = holesPlayed === 18;
                  if (isComplete) {
                    return (
                      <div key={i} style={{ width: COL.r, textAlign: "center", fontSize: 12, fontWeight: 600, color: "#1A1D21" }}>{score}</div>
                    );
                  }
                  const rtp = score - (holePars ?? Array(18).fill(4)).slice(0, holesPlayed).reduce((a: number, b: number) => a + b, 0);
                  const rtpStr = rtp === 0 ? "E" : rtp > 0 ? `+${rtp}` : `${rtp}`;
                  return (
                    <div key={i} style={{
                      width: COL.r,
                      textAlign: "center",
                      fontSize: 12,
                      fontWeight: 600,
                      color: rtp < 0 ? "#2D8B52" : rtp > 0 ? "#D94438" : "#1A1D21",
                    }}>
                      {rtpStr}
                    </div>
                  );
                })}
                <div style={{
                  width: COL.p,
                  textAlign: "right",
                  fontSize: 15,
                  fontWeight: 700,
                  color: hasScore ? (cumToPar < 0 ? "#2D8B52" : cumToPar > 0 ? "#D94438" : "#1A1D21") : "#B0B5BC",
                }}>
                  {totDisplay}
                </div>
              </div>
            </div>
          );
        })}

        {/* Pagination */}
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

// --- Modal styles (Bottom Sheet) ---

const modal: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    zIndex: 1000,
  },
  dialog: {
    background: "#fff",
    borderRadius: "18px 18px 0 0",
    width: "100%",
    maxWidth: 430,
    maxHeight: "85vh",
    boxShadow: "0 -4px 30px rgba(0,0,0,0.2)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  metaLabel: {
    color: "#8E95A0",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: 0.3,
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
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    padding: "14px 16px",
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
    maxWidth: 430,
    margin: "0 auto",
    padding: "12px 16px 100px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: "#F4F5F7",
    minHeight: "100vh",
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: "#1A1D21",
    marginBottom: 10,
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
    marginBottom: 12,
    borderBottom: "2px solid #E2E5EA",
    WebkitOverflowScrolling: "touch",
  },
  tab: {
    padding: "10px 14px",
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
  tournamentName: {
    fontSize: 17,
    fontWeight: 700,
    color: "#1A1D21",
  },
  tournamentMeta: {
    fontSize: 12,
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
    padding: "14px 16px",
    marginBottom: 12,
  },
  statusGrid: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  input: {
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid #E2E5EA",
    fontSize: 13,
    width: "100%",
    outline: "none",
    boxSizing: "border-box",
  },
  actionBtn: {
    padding: "10px 16px",
    borderRadius: 8,
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  colLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: "#8E95A0",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  pageBtn: {
    padding: "8px 16px",
    borderRadius: 8,
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
};
