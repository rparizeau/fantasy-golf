import { Router } from "express";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadState, advance, setOverride, reset, createFreshState, loadPayoutTable, getCurrentTournament } from "../sim/engine.js";
import type { SimState } from "../sim/engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEAGUE_STATE_PATH = join(__dirname, "..", "state", "league-state.json");

function accumulateSeasonEarnings(simState: SimState): void {
  if (simState.phase !== "final") return;

  const tournament = getCurrentTournament();
  if (simState.tournamentId !== tournament.id) return;

  const payoutTable = loadPayoutTable();

  // Build player earnings map
  const playerEarnings = new Map<number, number>();
  for (const p of simState.players) {
    let earnings = 0;
    if (p.status === "active") {
      const payout = payoutTable.find((pt) => pt.position === p.position);
      if (payout) earnings = Math.round(tournament.purse * (payout.pct / 100));
    }
    playerEarnings.set(p.playerId, earnings);
  }

  // Update each team's seasonEarnings across all leagues
  const leagueState = JSON.parse(readFileSync(LEAGUE_STATE_PATH, "utf-8"));
  for (const league of Object.values(leagueState.leagues) as any[]) {
    for (const team of league.teams) {
      const weekEarnings = (team.activeLineup as number[]).reduce(
        (sum: number, pid: number) => sum + (playerEarnings.get(pid) || 0), 0
      );
      team.seasonEarnings += weekEarnings;
    }
  }
  writeFileSync(LEAGUE_STATE_PATH, JSON.stringify(leagueState, null, 2));
}

const router = Router();

// GET /api/sim/state — current phase, round, player count, cut line
router.get("/state", (_req, res) => {
  const state = loadState();
  const activePlayers = state.players.filter((p) => p.status === "active").length;
  const cutPlayers = state.players.filter((p) => p.status === "cut").length;
  const wdPlayers = state.players.filter((p) => p.status === "wd").length;

  res.json({
    phase: state.phase,
    tournamentId: state.tournamentId,
    currentRound: state.currentRound,
    par: state.par,
    fieldSize: state.fieldSize,
    activePlayers,
    cutPlayers,
    wdPlayers,
    cutLine: state.cutLine,
    overrides: state.overrides,
  });
});

// POST /api/sim/advance — generate next round of scores
router.post("/advance", (_req, res) => {
  const state = loadState();

  if (state.phase === "final") {
    res.status(400).json({ error: "Tournament is already final. Reset to start a new one." });
    return;
  }

  if (state.phase === "idle" && state.players.length === 0) {
    // Auto-initialize field on first advance
    const freshState = createFreshState(state.tournamentId);
    const advanced = advance(freshState);
    res.json({ phase: advanced.phase, currentRound: advanced.currentRound });
    return;
  }

  const updated = advance(state);
  if (updated.phase === "final") {
    accumulateSeasonEarnings(updated);
  }
  res.json({
    phase: updated.phase,
    currentRound: updated.currentRound,
    activePlayers: updated.players.filter((p) => p.status === "active").length,
    cutPlayers: updated.players.filter((p) => p.status === "cut").length,
    cutLine: updated.cutLine,
  });
});

// POST /api/sim/override — set player outcome (score, WD)
router.post("/override", (req, res) => {
  const { playerId, score, wd } = req.body;

  if (!playerId) {
    res.status(400).json({ error: "playerId is required" });
    return;
  }

  const state = loadState();
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) {
    res.status(404).json({ error: "Player not found in field" });
    return;
  }

  const override: { score?: number; wd?: boolean } = {};
  if (typeof score === "number") override.score = score;
  if (typeof wd === "boolean") override.wd = wd;

  const updated = setOverride(state, playerId, override);
  res.json({ overrides: updated.overrides });
});

// POST /api/sim/reset — reset to idle with fresh field
router.post("/reset", (req, res) => {
  const { tournamentId } = req.body || {};
  const state = reset(tournamentId);
  res.json({
    phase: state.phase,
    tournamentId: state.tournamentId,
    fieldSize: state.players.length,
  });
});

export default router;
