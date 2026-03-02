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
  type Leaderboard,
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

  // Initialize hole scores state: deep copy from player data (nulls = unplayed holes)
  const [holeData, setHoleData] = useState<((number | null)[] | null)[]>(() => {
    const data: ((number | null)[] | null)[] = [];
    for (let i = 0; i < 4; i++) {
      const hs = player.holeScores?.[i];
      if (hs && hs.length > 0) {
        data.push([...hs]);
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

  const [activeRound, setActiveRound] = useState(() => Math.max(0, roundCount - 1));
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
        {/* Header */}
        <div style={modal.header}>
          <div style={{ flex: 1 }}>
            <div style={modal.playerName}>{player.name}</div>
            <div style={modal.headerMeta}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={modal.metaLabel}>Status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={modal.select}>
                  <option value="Active">Active</option>
                  <option value="Cut">Cut</option>
                  <option value="WD">WD</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={modal.metaLabel}>To Par</span>
                <span style={{ ...modal.metaValue, color: toPar < 0 ? "#2D8B52" : toPar > 0 ? "#D94438" : "#1A1D21" }}>{toParDisplay}</span>
                <span style={{ ...modal.metaLabel, marginLeft: 12 }}>Purse</span>
                <span style={modal.metaValue}>
                  {player.earnings > 0 ? `$${player.earnings.toLocaleString()}` : "-"}
                </span>
              </div>
            </div>
          </div>
          <button style={modal.closeBtn} onClick={onClose}>&times;</button>
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
                  <div style={{ fontSize: 10, color: "#8E95A0", fontWeight: 600, textTransform: "uppercase" }}>Total</div>
                  <div style={{ fontWeight: 600, color: "#1A1D21" }}>{roundTotal}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#8E95A0", fontWeight: 600, textTransform: "uppercase" }}>To Par</div>
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
  const isFinal = sim?.phase === "final";

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

  const handleToggleScore = async () => {
    if (isFinal) {
      await handleRewindToRound(5); // rewind from final → round4
    } else if (completedRound >= 4) {
      setLoading(true);
      try {
        await advanceSim(); // round4 → final
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Score failed");
      }
      setLoading(false);
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

  // Sort: players with rounds first (by position), then unscored players (by world rank)
  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    const aHasScore = a.rounds.length > 0;
    const bHasScore = b.rounds.length > 0;
    if (aHasScore && !bHasScore) return -1;
    if (!aHasScore && bHasScore) return 1;
    if (aHasScore && bHasScore) return a.position - b.position || a.ranking - b.ranking;
    return a.ranking - b.ranking;
  });

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
            <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
              {[1, 2, 3, 4].map((r) => {
                const isOn = completedRound >= r;
                return (
                  <button
                    key={r}
                    onClick={() => handleToggleRound(r)}
                    disabled={loading}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: isOn ? "1px solid #2D8B52" : "1px solid #E2E5EA",
                      background: isOn ? "#2D8B52" : "#fff",
                      color: isOn ? "#fff" : "#8E95A0",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    R{r}
                  </button>
                );
              })}
              <div style={{ width: 1, height: 20, background: "#E2E5EA", margin: "0 4px" }} />
              <button
                onClick={handleToggleScore}
                disabled={loading || (completedRound < 4 && !isFinal)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: isFinal ? "1px solid #2D8B52" : "1px solid #E2E5EA",
                  background: isFinal ? "#2D8B52" : "#fff",
                  color: isFinal ? "#fff" : completedRound >= 4 ? "#1A1D21" : "#CCC",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: completedRound >= 4 || isFinal ? "pointer" : "default",
                }}
              >
                Score
              </button>
              <button style={styles.dangerBtn} onClick={handleReset} disabled={loading}>
                Reset
              </button>
            </div>
        </div>
            <table style={styles.table}>
              <colgroup>
                <col style={{ width: 40 }} />
                <col />
                <col style={{ width: 80 }} />
                <col style={{ width: 40 }} />
                <col style={{ width: 40 }} />
                <col style={{ width: 40 }} />
                <col style={{ width: 40 }} />
                <col style={{ width: 50 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 50 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...styles.th, textAlign: "left" }}>Pos</th>
                  <th style={{ ...styles.th, textAlign: "left" }}>Player</th>
                  <th style={styles.th}>Status</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>R1</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>R2</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>R3</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>R4</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Tot</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>Purse</th>
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {displayedPlayers.map((p) => {
                  const hasScore = p.rounds.length > 0;
                  const posLabel = !hasScore ? "-"
                    : p.status === "cut" ? "MC"
                    : sortedLeaderboard.filter((o) => o.position === p.position && o.status === "active" && o.rounds.length > 0).length > 1 ? `T${p.position}`
                    : `${p.position}`;
                  return (
                  <tr key={p.playerId} style={p.status === "cut" ? { opacity: 0.5 } : {}}>
                    <td style={{ ...styles.td, textAlign: "left" }}>{posLabel}</td>
                    <td style={{ ...styles.td, textAlign: "left", fontWeight: 500 }}>
                      <span style={{ color: "#B0B5BC", fontSize: 11, fontWeight: 400, marginRight: 6 }}>{p.ranking}</span>
                      {p.name}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.statusBadge}>Active</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{p.rounds[0] ?? "-"}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{p.rounds[1] ?? "-"}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{p.rounds[2] ?? "-"}</td>
                    <td style={{ ...styles.td, textAlign: "right" }}>{p.rounds[3] ?? "-"}</td>
                    <td style={{
                      ...styles.td,
                      textAlign: "right",
                      color: p.toPar < 0 ? "#2D8B52" : p.toPar > 0 ? "#D94438" : "#1A1D21",
                      fontWeight: 600,
                    }}>
                      {p.toParDisplay}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      {p.earnings > 0 ? `$${p.earnings.toLocaleString()}` : "-"}
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <button style={styles.editBtn} onClick={() => setEditingPlayer(p)}>
                        Edit
                      </button>
                    </td>
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
