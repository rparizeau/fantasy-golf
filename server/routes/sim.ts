import { Router } from "express";
import { loadState, saveState, advance, rewind, setOverride, updatePlayer, reset, createFreshState, loadPayoutTable, loadTournaments, getCurrentTournament } from "../sim/engine.js";
import type { SimState } from "../sim/engine.js";
import { loadLeagueState, saveLeagueState, getLineup, setLineupForTournament } from "../lib/league-helpers.js";

function buildPlayerEarnings(simState: SimState, purse: number): Map<number, number> {
  const payoutTable = loadPayoutTable();
  const map = new Map<number, number>();
  for (const p of simState.players) {
    let earnings = 0;
    if (p.status === "active") {
      const payout = payoutTable.find((pt) => pt.position === p.position);
      if (payout) earnings = Math.round(purse * (payout.pct / 100));
    }
    map.set(p.playerId, earnings);
  }
  return map;
}

function accumulateSeasonEarnings(simState: SimState): void {
  if (simState.phase !== "final") return;
  if (simState.earningsAccumulated) return; // already done

  const tournament = getCurrentTournament();
  if (simState.tournamentId !== tournament.id) return;

  const playerEarnings = buildPlayerEarnings(simState, tournament.purse);

  const leagueState = loadLeagueState();
  for (const league of Object.values(leagueState.leagues)) {
    for (const team of league.teams) {
      const lineup = getLineup(team, simState.tournamentId);
      const weekEarnings = lineup.reduce(
        (sum, pid) => sum + (playerEarnings.get(pid) || 0), 0
      );
      team.seasonEarnings += weekEarnings;
    }
  }
  saveLeagueState(leagueState);

  simState.earningsAccumulated = true;
  saveState(simState);
}

function deaccumulateSeasonEarnings(simState: SimState): void {
  if (!simState.earningsAccumulated) return; // nothing to undo
  if (simState.players.length === 0) return;

  const tournaments = loadTournaments();
  const tournament = tournaments.find((t) => t.id === simState.tournamentId);
  if (!tournament) return;

  const playerEarnings = buildPlayerEarnings(simState, tournament.purse);

  const leagueState = loadLeagueState();
  for (const league of Object.values(leagueState.leagues)) {
    for (const team of league.teams) {
      const lineup = getLineup(team, simState.tournamentId);
      const weekEarnings = lineup.reduce(
        (sum, pid) => sum + (playerEarnings.get(pid) || 0), 0
      );
      team.seasonEarnings = Math.max(0, team.seasonEarnings - weekEarnings);
    }
  }
  saveLeagueState(leagueState);

  simState.earningsAccumulated = false;
  saveState(simState);
}

/** When advancing from idle → round1, ensure every team has a lineup for the current tournament. */
function autoCopyLineups(tournamentId: number): void {
  const leagueState = loadLeagueState();
  let changed = false;

  for (const league of Object.values(leagueState.leagues)) {
    for (const team of league.teams) {
      const existing = getLineup(team, tournamentId);
      if (existing.length > 0) continue;

      // Find the most recent previous tournament's lineup
      const tournamentKeys = Object.keys(team.tournamentLineups)
        .map(Number)
        .filter((id) => id < tournamentId)
        .sort((a, b) => b - a);

      let newLineup: number[] = [];
      for (const prevId of tournamentKeys) {
        const prevLineup = team.tournamentLineups[String(prevId)];
        if (prevLineup && prevLineup.length > 0) {
          // Filter to players still on the roster
          newLineup = prevLineup.filter((pid) => team.roster.includes(pid));
          break;
        }
      }

      // Fallback: take first activeSize players from roster
      if (newLineup.length === 0) {
        newLineup = team.roster.slice(0, league.settings.activeSize);
      }

      // Pad if we lost players from roster changes
      if (newLineup.length < league.settings.activeSize) {
        for (const pid of team.roster) {
          if (newLineup.length >= league.settings.activeSize) break;
          if (!newLineup.includes(pid)) newLineup.push(pid);
        }
      }

      setLineupForTournament(team, tournamentId, newLineup);
      changed = true;
    }
  }

  if (changed) saveLeagueState(leagueState);
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
    autoCopyLineups(freshState.tournamentId);
    const advanced = advance(freshState);
    res.json({ phase: advanced.phase, currentRound: advanced.currentRound });
    return;
  }

  if (state.phase === "idle") {
    // Transitioning from idle → round1: auto-copy lineups
    autoCopyLineups(state.tournamentId);
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

// POST /api/sim/rewind — undo the most recent phase transition
router.post("/rewind", (_req, res) => {
  const state = loadState();

  if (state.phase === "idle") {
    res.status(400).json({ error: "Already at idle." });
    return;
  }

  deaccumulateSeasonEarnings(state);
  const updated = rewind(state);
  res.json({
    phase: updated.phase,
    currentRound: updated.currentRound,
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

// POST /api/sim/player/update — directly edit a player's rounds and status
router.post("/player/update", (req, res) => {
  const { playerId, rounds, status, holeScores } = req.body;

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

  const updates: { rounds?: (number | null)[]; status?: "active" | "cut" | "wd"; holeScores?: ((number | null)[] | null)[] } = {};
  if (Array.isArray(rounds)) updates.rounds = rounds;
  if (Array.isArray(holeScores)) updates.holeScores = holeScores;
  if (status === "active" || status === "cut" || status === "wd") updates.status = status;

  updatePlayer(state, playerId, updates);
  res.json({ ok: true });
});

// POST /api/sim/reset — reset to idle with fresh field
router.post("/reset", (req, res) => {
  const { tournamentId } = req.body || {};
  const prevState = loadState();
  deaccumulateSeasonEarnings(prevState);
  const state = reset(tournamentId);
  res.json({
    phase: state.phase,
    tournamentId: state.tournamentId,
    fieldSize: state.players.length,
  });
});

export default router;
