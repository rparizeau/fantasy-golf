import { Router } from "express";
import { loadActiveSimState, getActiveTournamentId } from "../db/dal/sim.js";
import { loadTournaments, loadPayoutTable } from "../db/dal/seed-data.js";
import { getLeague, getLineup, incrementMulligansUsed, addActivityFeedEntry } from "../db/dal/league.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/league/:id/team/:teamId/mulligan — mulligan status
router.get("/:id/team/:teamId/mulligan", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const team = league.teams.find((t) => t.teamId === Number(req.params.teamId));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const simState = await loadActiveSimState();
  const tournaments = await loadTournaments();
  const activeId = await getActiveTournamentId();
  const tournament = tournaments.find((t) => t.id === activeId) || tournaments[0];
  const payoutTable = await loadPayoutTable();

  const windowOpen = simState.phase === "cut" && simState.tournamentId === tournament.id && !tournament.isMajor;
  const remaining = league.settings.mulligansPerSeason - team.mulligansUsed;

  const lineup = await getLineup(team.pk, simState.tournamentId);
  const eligiblePlayers = lineup
    .map((playerId) => {
      const simPlayer = simState.players.find((p) => p.playerId === playerId);
      if (!simPlayer || simPlayer.status !== "active") return null;
      const payout = payoutTable.find((pt) => pt.position === simPlayer.position);
      const projectedEarnings = payout ? Math.round(tournament.purse * (payout.pct / 100)) : 0;
      return { playerId, name: simPlayer.name, earnings: projectedEarnings };
    })
    .filter(Boolean);

  res.json({ windowOpen, remaining, eligiblePlayers, isMajor: tournament.isMajor });
});

// POST /api/league/:id/team/:teamId/mulligan — activate mulligan on a player
router.post("/:id/team/:teamId/mulligan", async (req: AuthenticatedRequest, res) => {
  const league = await getLeague(Number(req.params.id));
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const team = league.teams.find((t) => t.teamId === Number(req.params.teamId));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  if (team.managerId !== req.manager?.id) {
    res.status(403).json({ error: "You don't own this team" });
    return;
  }

  const simState = await loadActiveSimState();
  const tournaments = await loadTournaments();
  const activeId = await getActiveTournamentId();
  const tournament = tournaments.find((t) => t.id === activeId) || tournaments[0];

  if (tournament.isMajor) {
    res.status(403).json({ error: "Mulligans are disabled during major championships" });
    return;
  }
  if (simState.phase !== "cut") {
    res.status(403).json({ error: "Mulligan window is not open" });
    return;
  }

  const remaining = league.settings.mulligansPerSeason - team.mulligansUsed;
  if (remaining <= 0) {
    res.status(403).json({ error: "No mulligans remaining this season" });
    return;
  }

  const { playerId } = req.body;
  const lineup = await getLineup(team.pk, simState.tournamentId);
  if (!playerId || !lineup.includes(playerId)) {
    res.status(400).json({ error: "Player must be in your active lineup" });
    return;
  }

  await incrementMulligansUsed(team.pk);

  const simPlayer = simState.players.find((p) => p.playerId === playerId);
  await addActivityFeedEntry(
    league.id,
    "mulligan",
    `${team.teamName} used a Mulligan on ${simPlayer?.name || `Player ${playerId}`}`
  );

  res.json({ ok: true, remaining: remaining - 1 });
});

export default router;
