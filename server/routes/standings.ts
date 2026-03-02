import { Router } from "express";
import { loadLeagueState } from "../lib/league-helpers.js";

const router = Router();

// GET /api/league/:id/standings — cumulative season money leaderboard
router.get("/:id/standings", (req, res) => {
  const leagueState = loadLeagueState();
  const league = leagueState.leagues[req.params.id];
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  // Build standings from season earnings
  const standings = league.teams.map((team) => ({
    teamId: team.teamId,
    teamName: team.teamName,
    managerName: team.managerName,
    totalEarnings: team.seasonEarnings,
    previousRank: 0,
    currentRank: 0,
    tournamentEarnings: [] as { tournamentId: number; tournamentName: string; earnings: number }[],
  }));

  // Sort by earnings descending
  standings.sort((a, b) => b.totalEarnings - a.totalEarnings);

  // Assign ranks
  standings.forEach((s, idx) => {
    s.currentRank = idx + 1;
    s.previousRank = s.currentRank; // No history yet
  });

  res.json(standings);
});

export default router;
