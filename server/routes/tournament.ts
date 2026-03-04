import { Router } from "express";
import { loadActiveSimState } from "../db/dal/sim.js";
import { loadTournaments, loadPayoutTable } from "../db/dal/seed-data.js";
import { getActiveTournamentId } from "../db/dal/sim.js";
import { formatScore } from "../sim/engine.js";

const router = Router();

// GET /api/tournament/current — tournament info + status
router.get("/current", async (_req, res) => {
  const tournaments = await loadTournaments();
  const activeId = await getActiveTournamentId();
  const tournament = tournaments.find((t) => t.id === activeId) || tournaments[0];
  const state = await loadActiveSimState();
  const simMatchesCurrent = state.tournamentId === tournament.id;

  res.json({
    id: tournament.id,
    name: tournament.name,
    course: tournament.course,
    location: tournament.location,
    purse: tournament.purse,
    par: tournament.par,
    isMajor: tournament.isMajor,
    color: tournament.color,
    secondaryColor: tournament.secondaryColor,
    dates: tournament.dates,
    phase: simMatchesCurrent ? state.phase : "idle",
    currentRound: simMatchesCurrent ? state.currentRound : 0,
    fieldSize: simMatchesCurrent ? state.fieldSize : 0,
    activePlayers: simMatchesCurrent ? state.players.filter((p) => p.status === "active").length : 0,
    cutLine: simMatchesCurrent ? state.cutLine : null,
  });
});

// GET /api/tournament/leaderboard — all players ranked by total score
router.get("/leaderboard", async (_req, res) => {
  const state = await loadActiveSimState();
  const tournaments = await loadTournaments();
  const tournament = tournaments.find((t) => t.id === state.tournamentId) || tournaments[0];
  const payoutTable = loadPayoutTable();

  const leaderboard = state.players.map((p) => {
    let earnings = 0;
    if (state.phase === "final" && p.status === "active") {
      const payout = payoutTable.find((pt) => pt.position === p.position);
      if (payout) {
        earnings = Math.round(tournament.purse * (payout.pct / 100));
      }
    }

    return {
      playerId: p.playerId,
      name: p.name,
      country: p.country,
      ranking: p.ranking,
      rounds: p.rounds,
      holeScores: p.holeScores,
      total: p.total,
      toPar: p.toPar,
      toParDisplay: p.rounds.length > 0 ? formatScore(p.toPar) : "-",
      position: p.position,
      status: p.status,
      earnings,
    };
  });

  res.json({
    tournamentId: state.tournamentId,
    tournamentName: tournament.name,
    phase: state.phase,
    currentRound: state.currentRound,
    par: state.par,
    holePars: state.holePars,
    cutLine: state.cutLine,
    players: leaderboard,
  });
});

// GET /api/tournament/list — all available tournaments
router.get("/list", async (_req, res) => {
  const [tournaments, activeId] = await Promise.all([
    loadTournaments(),
    getActiveTournamentId(),
  ]);
  res.json(tournaments.map((t) => ({ ...t, current: t.id === activeId })));
});

export default router;
