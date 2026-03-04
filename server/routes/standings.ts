import { Router } from "express";
import { getLeague } from "../db/dal/league.js";
import { loadTournaments } from "../db/dal/seed-data.js";
import { db } from "../db/index.js";
import { simTournaments } from "../db/schema/index.js";
import { eq, sql } from "drizzle-orm";

const router = Router();

// GET /api/league/:id/standings — cumulative season money leaderboard
router.get("/:id/standings", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const [completedCount, tournaments] = await Promise.all([
    db.select({ count: sql<number>`COUNT(*)` })
      .from(simTournaments)
      .where(eq(simTournaments.phase, "final")),
    loadTournaments(),
  ]);
  const completedWeeks = Number(completedCount[0]?.count ?? 0);
  const totalWeeks = tournaments.length;

  const standings = league.teams.map((team) => ({
    teamId: team.teamId,
    teamName: team.teamName,
    managerName: team.managerName,
    color: team.colorCode,
    secondaryColor: team.secondaryColorCode,
    totalEarnings: team.seasonEarnings,
    totalPoints: team.seasonPoints,
    previousRank: 0,
    currentRank: 0,
    completedWeeks,
    totalWeeks,
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
