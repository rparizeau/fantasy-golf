import { Router } from "express";
import { getLeague } from "../db/dal/league.js";

const router = Router();

// GET /api/league/:id/standings — cumulative season money leaderboard
router.get("/:id/standings", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const standings = league.teams.map((team) => ({
    teamId: team.teamId,
    teamName: team.teamName,
    managerName: team.managerName,
    totalEarnings: team.seasonEarnings,
    totalPoints: team.seasonPoints,
    previousRank: 0,
    currentRank: 0,
    tournamentEarnings: [] as { tournamentId: number; tournamentName: string; earnings: number }[],
  }));

  standings.sort((a, b) => b.totalPoints - a.totalPoints || b.totalEarnings - a.totalEarnings);
  standings.forEach((s, idx) => {
    s.currentRank = idx + 1;
    s.previousRank = s.currentRank;
  });

  res.json(standings);
});

export default router;
