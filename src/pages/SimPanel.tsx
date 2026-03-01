import { useState, useEffect, useCallback } from "react";
import {
  getSimState,
  advanceSim,
  setOverride,
  resetSim,
  getLeaderboard,
  getTournamentList,
  type SimStatus,
  type LeaderboardPlayer,
  type TournamentListItem,
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

const NEXT_ACTION: Record<string, string> = {
  idle: "Start Round 1",
  round1: "Start Round 2",
  round2: "Apply Cut",
  cut: "Start Round 3",
  round3: "Start Round 4",
  round4: "Finalize Tournament",
};

export function SimPanel() {
  const [sim, setSim] = useState<SimStatus | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardPlayer[]>([]);
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [overridePlayerId, setOverridePlayerId] = useState<number | null>(null);
  const [overrideScore, setOverrideScore] = useState("");
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [lbCount, setLbCount] = useState(20);

  const refresh = useCallback(async () => {
    try {
      const [simData, lbData] = await Promise.all([getSimState(), getLeaderboard()]);
      setSim(simData);
      setLeaderboard(lbData.players);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    }
  }, []);

  useEffect(() => {
    refresh();
    getTournamentList().then(setTournaments).catch(() => {});
  }, [refresh]);

  const handleAdvance = async () => {
    setLoading(true);
    try {
      await advanceSim();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Advance failed");
    }
    setLoading(false);
  };

  const handleReset = async (tournamentId?: number) => {
    setLoading(true);
    try {
      await resetSim(tournamentId);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    }
    setLoading(false);
  };

  const handleOverride = async (playerId: number, score?: number, wd?: boolean) => {
    try {
      await setOverride(playerId, { score, wd: wd || undefined });
      await refresh();
      setOverridePlayerId(null);
      setOverrideScore("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Override failed");
    }
  };

  const filteredPlayers = searchQuery
    ? leaderboard.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : leaderboard;

  const displayedPlayers = showLeaderboard ? filteredPlayers.slice(0, lbCount) : [];

  if (!sim) {
    return <div style={styles.container}><p style={styles.loading}>Loading sim state...</p></div>;
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Sim Panel</h1>

      {error && <div style={styles.error}>{error}</div>}

      {/* Tournament Status */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>Tournament Status</div>
        <div style={styles.statusGrid}>
          <StatusItem label="Phase" value={PHASE_LABELS[sim.phase] || sim.phase} />
          <StatusItem label="Round" value={sim.currentRound || "-"} />
          <StatusItem label="Field" value={sim.fieldSize} />
          <StatusItem label="Active" value={sim.activePlayers} />
          <StatusItem label="Cut" value={sim.cutPlayers} />
          <StatusItem label="WD" value={sim.wdPlayers} />
          {sim.cutLine !== null && <StatusItem label="Cut Line" value={sim.cutLine} />}
        </div>

        {/* Pending Overrides */}
        {Object.keys(sim.overrides).length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p style={styles.smallLabel}>Pending Overrides (applied on next advance):</p>
            {Object.entries(sim.overrides).map(([id, ov]) => {
              const player = leaderboard.find((p) => p.playerId === Number(id));
              return (
                <span key={id} style={styles.overrideBadge}>
                  {player?.name || `#${id}`}: {ov.wd ? "WD" : `score ${ov.score}`}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>Controls</div>
        <div style={styles.buttonRow}>
          {sim.phase !== "final" && (
            <button style={styles.primaryBtn} onClick={handleAdvance} disabled={loading}>
              {loading ? "Processing..." : NEXT_ACTION[sim.phase] || "Advance"}
            </button>
          )}
          <button style={styles.dangerBtn} onClick={() => handleReset()} disabled={loading}>
            Reset Tournament
          </button>
        </div>

        {/* Tournament Selector */}
        {tournaments.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p style={styles.smallLabel}>Switch Tournament:</p>
            <div style={styles.buttonRow}>
              {tournaments.map((t) => (
                <button
                  key={t.id}
                  style={{
                    ...styles.secondaryBtn,
                    ...(t.id === sim.tournamentId ? { background: "#2D8B52", color: "#fff" } : {}),
                  }}
                  onClick={() => handleReset(t.id)}
                  disabled={loading}
                >
                  {t.name} {t.isMajor ? "(Major)" : ""}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scenario presets */}
        {sim.phase === "round1" && (
          <div style={{ marginTop: 12 }}>
            <p style={styles.smallLabel}>Scenario Presets:</p>
            <button
              style={styles.secondaryBtn}
              onClick={async () => {
                // "Tight cut" - cluster players around position 60-70 to have similar scores
                const nearCut = leaderboard.filter(
                  (p) => p.status === "active" && p.position >= 55 && p.position <= 75
                );
                for (const p of nearCut) {
                  await setOverride(p.playerId, { score: sim.par });
                }
                await refresh();
              }}
            >
              Tight Cut (cluster 55-75 at par)
            </button>
          </div>
        )}
      </div>

      {/* Player Override */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>Player Override</div>
        <input
          type="text"
          placeholder="Search player..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.input}
        />

        {searchQuery && filteredPlayers.length > 0 && (
          <div style={styles.searchResults}>
            {filteredPlayers.slice(0, 8).map((p) => (
              <div
                key={p.playerId}
                style={{
                  ...styles.searchItem,
                  ...(overridePlayerId === p.playerId ? { background: "#e8f5ee" } : {}),
                }}
                onClick={() => setOverridePlayerId(p.playerId)}
              >
                <span>#{p.ranking} {p.name}</span>
                <span style={styles.dim}>
                  {p.toParDisplay} ({p.status})
                </span>
              </div>
            ))}
          </div>
        )}

        {overridePlayerId && (
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="number"
              placeholder="Score (e.g. 68)"
              value={overrideScore}
              onChange={(e) => setOverrideScore(e.target.value)}
              style={{ ...styles.input, flex: 1, minWidth: 120 }}
            />
            <button
              style={styles.primaryBtn}
              onClick={() => handleOverride(overridePlayerId, Number(overrideScore))}
              disabled={!overrideScore}
            >
              Set Score
            </button>
            <button
              style={styles.dangerBtn}
              onClick={() => handleOverride(overridePlayerId, undefined, true)}
            >
              WD
            </button>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div style={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={styles.cardHeader}>Leaderboard</div>
          <button style={styles.linkBtn} onClick={() => setShowLeaderboard(!showLeaderboard)}>
            {showLeaderboard ? "Hide" : "Show"}
          </button>
        </div>

        {showLeaderboard && (
          <>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Pos</th>
                  <th style={{ ...styles.th, textAlign: "left" }}>Player</th>
                  <th style={styles.th}>To Par</th>
                  {sim.currentRound >= 1 && <th style={styles.th}>R1</th>}
                  {sim.currentRound >= 2 && <th style={styles.th}>R2</th>}
                  {sim.currentRound >= 3 && <th style={styles.th}>R3</th>}
                  {sim.currentRound >= 4 && <th style={styles.th}>R4</th>}
                  <th style={styles.th}>Total</th>
                  <th style={styles.th}>Status</th>
                  {sim.phase === "final" && <th style={styles.th}>Earnings</th>}
                </tr>
              </thead>
              <tbody>
                {displayedPlayers.map((p) => (
                  <tr key={p.playerId} style={p.status === "cut" ? { opacity: 0.5 } : {}}>
                    <td style={styles.td}>{p.status === "cut" ? "MC" : `T${p.position}`}</td>
                    <td style={{ ...styles.td, textAlign: "left", fontWeight: 500 }}>
                      {p.name}
                    </td>
                    <td style={{
                      ...styles.td,
                      color: p.toPar < 0 ? "#c41e1e" : p.toPar > 0 ? "#1e1e1e" : "#666",
                      fontWeight: 600,
                    }}>
                      {p.toParDisplay}
                    </td>
                    {sim.currentRound >= 1 && <td style={styles.td}>{p.rounds[0] ?? "-"}</td>}
                    {sim.currentRound >= 2 && <td style={styles.td}>{p.rounds[1] ?? "-"}</td>}
                    {sim.currentRound >= 3 && <td style={styles.td}>{p.rounds[2] ?? "-"}</td>}
                    {sim.currentRound >= 4 && <td style={styles.td}>{p.rounds[3] ?? "-"}</td>}
                    <td style={styles.td}>{p.total || "-"}</td>
                    <td style={{
                      ...styles.td,
                      color: p.status === "wd" ? "#d94438" : p.status === "cut" ? "#8E95A0" : "#2D8B52",
                    }}>
                      {p.status === "wd" ? "WD" : p.status === "cut" ? "CUT" : ""}
                    </td>
                    {sim.phase === "final" && (
                      <td style={styles.td}>
                        {p.earnings > 0 ? `$${p.earnings.toLocaleString()}` : "-"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPlayers.length > lbCount && (
              <button style={styles.linkBtn} onClick={() => setLbCount((c) => c + 20)}>
                Show more ({filteredPlayers.length - lbCount} remaining)
              </button>
            )}
          </>
        )}
      </div>
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
    marginBottom: 16,
  },
  loading: {
    color: "#8E95A0",
    textAlign: "center",
    padding: 40,
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
  secondaryBtn: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid #E2E5EA",
    background: "#fff",
    color: "#1A1D21",
    fontSize: 12,
    fontWeight: 500,
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
  linkBtn: {
    background: "none",
    border: "none",
    color: "#2D8B52",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    padding: 4,
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
  searchResults: {
    marginTop: 8,
    border: "1px solid #E2E5EA",
    borderRadius: 8,
    overflow: "hidden",
  },
  searchItem: {
    padding: "8px 12px",
    borderBottom: "1px solid #E2E5EA",
    display: "flex",
    justifyContent: "space-between",
    cursor: "pointer",
    fontSize: 13,
  },
  dim: {
    color: "#8E95A0",
    fontSize: 12,
  },
  smallLabel: {
    fontSize: 12,
    color: "#8E95A0",
    margin: "0 0 6px",
  },
  overrideBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 6,
    background: "#E8F0FA",
    color: "#3A85CC",
    fontSize: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
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
