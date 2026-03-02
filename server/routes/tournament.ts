import { Router } from "express";
import { loadState, loadTournaments, loadPayoutTable, formatScore, getCurrentTournament } from "../sim/engine.js";

const router = Router();

// GET /api/tournament/current — tournament info + status
router.get("/current", (_req, res) => {
  const tournament = getCurrentTournament();
  const state = loadState();
  const simMatchesCurrent = state.tournamentId === tournament.id;

  res.json({
    id: tournament.id,
    name: tournament.name,
    course: tournament.course,
    location: tournament.location,
    purse: tournament.purse,
    par: tournament.par,
    isMajor: tournament.isMajor,
    dates: tournament.dates,
    phase: simMatchesCurrent ? state.phase : "idle",
    currentRound: simMatchesCurrent ? state.currentRound : 0,
    fieldSize: simMatchesCurrent ? state.fieldSize : 0,
    activePlayers: simMatchesCurrent ? state.players.filter((p) => p.status === "active").length : 0,
    cutLine: simMatchesCurrent ? state.cutLine : null,
  });
});

// GET /api/tournament/leaderboard — all players ranked by total score
router.get("/leaderboard", (_req, res) => {
  const state = loadState();
  const tournaments = loadTournaments();
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
    cutLine: state.cutLine,
    players: leaderboard,
  });
});

// GET /api/tournament/list — all available tournaments
router.get("/list", (_req, res) => {
  const tournaments = loadTournaments();
  res.json(tournaments);
});

export default router;
