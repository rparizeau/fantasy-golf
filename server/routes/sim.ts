import { Router } from "express";
import {
  loadActiveSimState, saveSimState, createFreshState,
  resetSimState, getActiveTournamentId, setActiveTournamentId,
  type SimState,
} from "../db/dal/sim.js";
import { loadPayoutTable, loadTournaments } from "../db/dal/seed-data.js";
import { getAllLeagues, getLineupsForTeams, autoCopyLineups } from "../db/dal/league.js";
import { advance, rewind, setOverride, updatePlayer, calculatePlayerPoints } from "../sim/engine.js";
import { writePointsForRound, writeTournamentResults, deleteTournamentResults } from "../db/dal/points.js";

function buildPlayerEarnings(simState: SimState, purse: number, payoutTable: { position: number; pct: number }[]): Map<number, number> {
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

async function computeTeamEarnings(simState: SimState): Promise<{ teamPk: number; weekEarnings: number }[]> {
  const [tournaments, allLeagues] = await Promise.all([
    loadTournaments(),
    getAllLeagues(),
  ]);
  const payoutTable = loadPayoutTable();
  const tournament = tournaments.find((t) => t.id === simState.tournamentId);
  if (!tournament) return [];

  const playerEarnings = buildPlayerEarnings(simState, tournament.purse, payoutTable);
  const allTeamPks = allLeagues.flatMap((l) => l.teams.map((t) => t.pk));
  const allLineups = await getLineupsForTeams(allTeamPks, simState.tournamentId);

  const results: { teamPk: number; weekEarnings: number }[] = [];
  for (const league of allLeagues) {
    for (const team of league.teams) {
      const lineup = allLineups.get(team.pk) ?? [];
      const weekEarnings = lineup.reduce((sum, pid) => sum + (playerEarnings.get(pid) || 0), 0);
      if (weekEarnings > 0) results.push({ teamPk: team.pk, weekEarnings });
    }
  }
  return results;
}

async function computeTeamPoints(simState: SimState): Promise<{ teamPk: number; weekPoints: number }[]> {
  const allLeagues = await getAllLeagues();
  const holePars = simState.holePars ?? [];
  const allTeamPks = allLeagues.flatMap((l) => l.teams.map((t) => t.pk));
  const allLineups = await getLineupsForTeams(allTeamPks, simState.tournamentId);

  const playerMap = new Map(simState.players.map((p) => [p.playerId, p]));
  const results: { teamPk: number; weekPoints: number }[] = [];

  for (const league of allLeagues) {
    const scoring = league.settings.scoringSettings;
    for (const team of league.teams) {
      const lineup = allLineups.get(team.pk) ?? [];
      let weekPoints = 0;
      for (const pid of lineup) {
        const player = playerMap.get(pid);
        if (player) {
          weekPoints += calculatePlayerPoints(player.holeScores, holePars, scoring);
        }
      }
      if (weekPoints !== 0) results.push({ teamPk: team.pk, weekPoints });
    }
  }
  return results;
}

const router = Router();

// GET /api/sim/state — current phase, round, player count, cut line
router.get("/state", async (_req, res) => {
  const state = await loadActiveSimState();
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
router.post("/advance", async (_req, res) => {
  let state = await loadActiveSimState();

  if (state.phase === "final") {
    res.status(400).json({ error: "Tournament is already final. Reset to start a new one." });
    return;
  }

  if (state.phase === "idle" && state.players.length === 0) {
    const freshState = await createFreshState(state.tournamentId);
    const allLeagues = await getAllLeagues();
    for (const league of allLeagues) {
      await autoCopyLineups(league.id, freshState.tournamentId, league.settings.activeSize);
    }
    const advanced = advance(freshState);
    await saveSimState(advanced);

    // Write points for round 1
    if (advanced.currentRound === 1) {
      const playerHoleScores = new Map<number, (number | null)[]>();
      for (const p of advanced.players) {
        if (p.holeScores && p.holeScores[0]) {
          playerHoleScores.set(p.playerId, p.holeScores[0]);
        }
      }
      const holePars = advanced.holePars ?? [];
      if (playerHoleScores.size > 0 && holePars.length > 0) {
        await writePointsForRound(advanced.tournamentId, 1, playerHoleScores, holePars).catch((e) => {
          console.error("Failed to write round points:", e);
        });
      }
    }

    res.json({ phase: advanced.phase, currentRound: advanced.currentRound });
    return;
  }

  if (state.phase === "idle") {
    const allLeagues = await getAllLeagues();
    for (const league of allLeagues) {
      await autoCopyLineups(league.id, state.tournamentId, league.settings.activeSize);
    }
  }

  const prevRound = state.currentRound;
  const updated = advance(state);
  await saveSimState(updated);

  // Write points if a new round was played
  if (updated.currentRound > prevRound) {
    const roundIdx = updated.currentRound - 1;
    const playerHoleScores = new Map<number, (number | null)[]>();
    for (const p of updated.players) {
      if (p.holeScores && p.holeScores[roundIdx]) {
        playerHoleScores.set(p.playerId, p.holeScores[roundIdx]);
      }
    }
    const holePars = updated.holePars ?? [];
    if (playerHoleScores.size > 0 && holePars.length > 0) {
      await writePointsForRound(updated.tournamentId, updated.currentRound, playerHoleScores, holePars).catch((e) => {
        console.error("Failed to write round points:", e);
      });
    }
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
router.post("/rewind", async (_req, res) => {
  const state = await loadActiveSimState();

  if (state.phase === "idle") {
    res.status(400).json({ error: "Already at idle." });
    return;
  }

  const updated = rewind(state);
  await saveSimState(updated);

  res.json({
    phase: updated.phase,
    currentRound: updated.currentRound,
  });
});

// POST /api/sim/override — set player outcome (score, WD)
router.post("/override", async (req, res) => {
  const { playerId, score, wd } = req.body;
  if (!playerId) {
    res.status(400).json({ error: "playerId is required" });
    return;
  }

  const state = await loadActiveSimState();
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) {
    res.status(404).json({ error: "Player not found in field" });
    return;
  }

  const override: { score?: number; wd?: boolean } = {};
  if (typeof score === "number") override.score = score;
  if (typeof wd === "boolean") override.wd = wd;

  const updated = setOverride(state, playerId, override);
  await saveSimState(updated);
  res.json({ overrides: updated.overrides });
});

// POST /api/sim/player/update — directly edit a player's rounds and status
router.post("/player/update", async (req, res) => {
  const { playerId, rounds, status, holeScores } = req.body;
  if (!playerId) {
    res.status(400).json({ error: "playerId is required" });
    return;
  }

  const state = await loadActiveSimState();
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
  await saveSimState(state);
  res.json({ ok: true });
});

// POST /api/sim/complete — finalize tournament and activate next week
router.post("/complete", async (_req, res) => {
  let state = await loadActiveSimState();

  if (state.phase === "final") {
    // Already final — just move to next tournament
  } else if (state.phase !== "round4") {
    res.status(400).json({ error: "All 4 rounds must be completed first." });
    return;
  } else {
    // Advance from round4 → final
    const updated = advance(state);
    await saveSimState(updated);
    state = updated;
  }

  // Write tournament results (idempotent — safe to call even if already final)
  await writeTournamentResults(state.tournamentId);

  // Find next tournament in schedule
  const tournaments = await loadTournaments();
  const currentIdx = tournaments.findIndex((t) => t.id === state.tournamentId);
  const nextTournament = tournaments[currentIdx + 1];

  if (!nextTournament) {
    res.json({ completed: true, nextTournamentId: null, nextTournamentName: null });
    return;
  }

  // Activate next tournament
  await setActiveTournamentId(nextTournament.id);

  // Create fresh state for next tournament
  await createFreshState(nextTournament.id);

  res.json({
    completed: true,
    nextTournamentId: nextTournament.id,
    nextTournamentName: nextTournament.name,
  });
});

// POST /api/sim/rollback — remove tournament_results but keep round data, revert phase to round4
router.post("/rollback", async (_req, res) => {
  const state = await loadActiveSimState();

  if (state.phase !== "final") {
    res.status(400).json({ error: "Can only rollback a finalized tournament." });
    return;
  }

  // Delete tournament_results rows
  await deleteTournamentResults(state.tournamentId);

  // Revert phase from final → round4 so rounds stay intact
  const reverted = rewind(state);
  await saveSimState(reverted);

  res.json({ phase: reverted.phase, tournamentId: reverted.tournamentId });
});

// POST /api/sim/reset — reset to idle with fresh field
router.post("/reset", async (req, res) => {
  const { tournamentId } = req.body || {};
  const state = await resetSimState(tournamentId);
  res.json({
    phase: state.phase,
    tournamentId: state.tournamentId,
    fieldSize: state.players.length,
  });
});

export default router;
