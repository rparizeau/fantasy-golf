import { Router } from "express";
import { loadActiveSimState, getActiveTournamentId } from "../db/dal/sim.js";
import { loadGolfers, loadPayoutTable, loadTournaments } from "../db/dal/seed-data.js";
import { formatScore, calculatePlayerPoints, calculateRoundPoints, holeToPoints, DEFAULT_SCORING } from "../sim/engine.js";
import { getLeague } from "../db/dal/league.js";

const router = Router();

// GET /api/player/:id — single player detail (seed data + sim state)
// Optional query: ?leagueId=X to use league-specific scoring
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    res.status(400).json({ error: "Invalid player id" });
    return;
  }

  const golfers = await loadGolfers();
  const seed = golfers.find((p) => p.id === id);
  if (!seed) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const state = await loadActiveSimState();
  const tournaments = await loadTournaments();
  const activeId = await getActiveTournamentId();
  const tournament = tournaments.find((t) => t.id === activeId) || tournaments[0];
  const simMatchesCurrent = state.tournamentId === tournament.id;
  const sim = simMatchesCurrent ? state.players.find((p) => p.playerId === id) : undefined;

  let earnings = 0;
  if (sim && state.phase === "final" && sim.status === "active") {
    const payoutTable = loadPayoutTable();
    const payout = payoutTable.find((pt) => pt.position === sim.position);
    if (payout) {
      earnings = Math.round(tournament.purse * (payout.pct / 100));
    }
  }

  // Use league-specific scoring if leagueId provided, otherwise defaults
  let scoring = DEFAULT_SCORING;
  const leagueId = Number(req.query.leagueId);
  if (Number.isFinite(leagueId) && leagueId > 0) {
    const league = await getLeague(leagueId);
    if (league) scoring = league.settings.scoringSettings;
  }

  const holePars = state.holePars ?? [];
  const holeScores = sim?.holeScores ?? [];
  const points = sim ? calculatePlayerPoints(holeScores, holePars, scoring) : 0;
  const roundPoints = sim ? calculateRoundPoints(holeScores, holePars, scoring) : [];

  // 2D array of per-hole point values mirroring holeScores
  const holePoints: number[][] = holeScores.map((round) =>
    round.map((score, h) =>
      score != null ? holeToPoints(score, holePars[h] ?? 4, scoring) : 0
    )
  );

  res.json({
    playerId: seed.id,
    name: seed.name,
    country: seed.country,
    ranking: seed.ranking,
    toPar: sim?.toPar ?? 0,
    toParDisplay: sim && sim.rounds.length > 0 ? formatScore(sim.toPar) : "-",
    position: sim?.position ?? 0,
    status: sim?.status ?? "active",
    rounds: sim?.rounds ?? [],
    earnings,
    points,
    holeScores,
    holePars,
    roundPoints,
    holePoints,
  });
});

export default router;
