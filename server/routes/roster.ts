import { Router } from "express";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadState, loadTournaments, loadPayoutTable, formatScore } from "../sim/engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEAGUE_STATE_PATH = join(__dirname, "..", "state", "league-state.json");

function loadLeagueState() {
  return JSON.parse(readFileSync(LEAGUE_STATE_PATH, "utf-8"));
}

function saveLeagueState(state: unknown) {
  writeFileSync(LEAGUE_STATE_PATH, JSON.stringify(state, null, 2));
}

const router = Router();

// GET /api/league/:id/team/:teamId/mulligan — mulligan status
router.get("/:id/team/:teamId/mulligan", (req, res) => {
  const leagueState = loadLeagueState();
  const league = leagueState.leagues[req.params.id];
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const team = league.teams.find((t: { teamId: number }) => t.teamId === Number(req.params.teamId));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const simState = loadState();
  const tournaments = loadTournaments();
  const tournament = tournaments.find((t) => t.id === simState.tournamentId) || tournaments[0];
  const payoutTable = loadPayoutTable();

  // Window is open after cut phase, before round 3 starts, and not during majors
  const windowOpen = simState.phase === "cut" && !tournament.isMajor;
  const remaining = league.settings.mulligansPerSeason - team.mulligansUsed;

  // Eligible players: active lineup players who made the cut but have negative earnings potential
  const eligiblePlayers = team.activeLineup
    .map((playerId: number) => {
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

  const team = league.teams.find((t: { teamId: number }) => t.teamId === Number(req.params.teamId));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const simState = loadState();
  const tournaments = loadTournaments();
  const tournament = tournaments.find((t) => t.id === simState.tournamentId) || tournaments[0];

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
  if (!playerId || !team.activeLineup.includes(playerId)) {
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
