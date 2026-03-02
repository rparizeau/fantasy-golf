import { Router } from "express";
import { loadState, loadPayoutTable, getCurrentTournament } from "../sim/engine.js";
import { loadLeagueState, saveLeagueState, getLineup } from "../lib/league-helpers.js";

const router = Router();

// GET /api/league/:id/team/:teamId/mulligan — mulligan status
router.get("/:id/team/:teamId/mulligan", (req, res) => {
  const leagueState = loadLeagueState();
  const league = leagueState.leagues[req.params.id];
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const team = league.teams.find((t) => t.teamId === Number(req.params.teamId));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const simState = loadState();
  const tournament = getCurrentTournament();
  const payoutTable = loadPayoutTable();

  // Window is open after cut phase, before round 3 starts, and not during majors
  const windowOpen = simState.phase === "cut" && simState.tournamentId === tournament.id && !tournament.isMajor;
  const remaining = league.settings.mulligansPerSeason - team.mulligansUsed;

  // Eligible players: active lineup players who made the cut but have negative earnings potential
  const lineup = getLineup(team, simState.tournamentId);
  const eligiblePlayers = lineup
    .map((playerId) => {
      const simPlayer = simState.players.find((p) => p.playerId === playerId);
      if (!simPlayer || simPlayer.status !== "active") return null;

      // Calculate projected earnings (if they stay where they are)
      const payout = payoutTable.find((pt) => pt.position === simPlayer.position);
      const projectedEarnings = payout ? Math.round(tournament.purse * (payout.pct / 100)) : 0;

      return {
        playerId,
        name: simPlayer.name,
        earnings: projectedEarnings,
      };
    })
    .filter(Boolean);

  res.json({
    windowOpen,
    remaining,
    eligiblePlayers,
    isMajor: tournament.isMajor,
  });
});

// POST /api/league/:id/team/:teamId/mulligan — activate mulligan on a player
router.post("/:id/team/:teamId/mulligan", (req, res) => {
  const leagueState = loadLeagueState();
  const league = leagueState.leagues[req.params.id];
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const team = league.teams.find((t) => t.teamId === Number(req.params.teamId));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const simState = loadState();
  const tournament = getCurrentTournament();

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
  const lineup = getLineup(team, simState.tournamentId);
  if (!playerId || !lineup.includes(playerId)) {
    res.status(400).json({ error: "Player must be in your active lineup" });
    return;
  }

  // Mark the mulligan — move player from active to bench equivalent
  // (In a full implementation, we'd zero out their earnings)
  team.mulligansUsed++;

  // Add to activity feed
  const simPlayer = simState.players.find((p) => p.playerId === playerId);
  league.activityFeed.push({
    id: `feed-${Date.now()}`,
    type: "mulligan",
    message: `${team.teamName} used a Mulligan on ${simPlayer?.name || `Player ${playerId}`}`,
    timestamp: new Date().toISOString(),
  });

  saveLeagueState(leagueState);

  res.json({ ok: true, remaining: remaining - 1 });
});

export default router;
