import { Router } from "express";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEAGUE_STATE_PATH = join(__dirname, "..", "state", "league-state.json");

function loadLeagueState() {
  return JSON.parse(readFileSync(LEAGUE_STATE_PATH, "utf-8"));
}

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
  const standings = league.teams.map((team: {
    teamId: number;
    teamName: string;
    managerName: string;
    seasonEarnings: number;
    tournamentHistory?: { tournamentId: number; tournamentName: string; earnings: number }[];
  }, _idx: number) => ({
    teamId: team.teamId,
    teamName: team.teamName,
    managerName: team.managerName,
    totalEarnings: team.seasonEarnings,
    previousRank: 0,
    currentRank: 0,
    tournamentEarnings: team.tournamentHistory || [],
  }));

  // Sort by earnings descending
  standings.sort((a: { totalEarnings: number }, b: { totalEarnings: number }) => b.totalEarnings - a.totalEarnings);

  // Assign ranks
  standings.forEach((s: { currentRank: number; previousRank: number }, idx: number) => {
    s.currentRank = idx + 1;
    s.previousRank = s.currentRank; // No history yet
  });

  res.json(standings);
});

export default router;
