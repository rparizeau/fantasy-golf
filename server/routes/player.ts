import { Router } from "express";
import { loadState, loadPlayers, loadPayoutTable, getCurrentTournament, formatScore } from "../sim/engine.js";

const router = Router();

// GET /api/player/:id — single player detail (seed data + sim state)
router.get("/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id < 1) {
    res.status(400).json({ error: "Invalid player id" });
    return;
  }

  const players = loadPlayers();
  const seed = players.find((p) => p.id === id);
  if (!seed) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const state = loadState();
  const tournament = getCurrentTournament();
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
  });
});

export default router;
