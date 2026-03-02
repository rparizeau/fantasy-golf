import { Router } from "express";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { loadState, loadTournaments, loadPayoutTable, loadPlayers, formatScore, getCurrentTournament } from "../sim/engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEAGUE_STATE_PATH = join(__dirname, "..", "state", "league-state.json");

interface Team {
  teamId: number;
  teamName: string;
  managerName: string;
  roster: number[];
  activeLineup: number[];
  reserve: number[];
  mulligansUsed: number;
  seasonEarnings: number;
}

interface League {
  id: number;
  name: string;
  settings: { rosterSize: number; activeSize: number; reserveSize: number; mulligansPerSeason: number };
  teams: Team[];
  waiverClaims: unknown[];
  activityFeed: unknown[];
  chatMessages: unknown[];
}

interface LeagueState {
  leagues: Record<string, League>;
  version: number;
}

function loadLeagueState(): LeagueState {
  return JSON.parse(readFileSync(LEAGUE_STATE_PATH, "utf-8"));
}

function saveLeagueState(state: LeagueState): void {
  writeFileSync(LEAGUE_STATE_PATH, JSON.stringify(state, null, 2));
}

const router = Router();

// GET /api/league/all — all leagues summary for lobby
router.get("/all", (_req, res) => {
  const leagueState = loadLeagueState();
  const simState = loadState();
  const tournament = getCurrentTournament();
  const payoutTable = loadPayoutTable();
  const simMatchesCurrent = simState.tournamentId === tournament.id;

  // Compute per-player this-week earnings
  const playerEarningsMap = new Map<number, number>();
  if (simMatchesCurrent) {
    for (const p of simState.players) {
      let earnings = 0;
      if (simState.phase === "final" && p.status === "active") {
        const payout = payoutTable.find((pt) => pt.position === p.position);
        if (payout) earnings = Math.round(tournament.purse * (payout.pct / 100));
      }
      playerEarningsMap.set(p.playerId, earnings);
    }
  }

  const phase = simMatchesCurrent ? simState.phase : "idle";
  const status = phase === "idle" ? "upcoming" : phase === "final" ? "done" : "live";
  const round = simMatchesCurrent ? simState.currentRound : 0;

  // Format cut line
  let cutDisplay = "—";
  if (simMatchesCurrent && simState.cutLine !== null) {
    const cl = simState.cutLine;
    const strokes = tournament.par * 2 + cl;
    cutDisplay = cl === 0 ? `E (${strokes})` : cl > 0 ? `+${cl} (${strokes})` : `${cl} (${strokes})`;
  }

  const summaries = Object.values(leagueState.leagues).map((league) => {
    // Compute this-week earnings per team
    const teamWeekEarnings = league.teams.map((team) => {
      const weekEarnings = team.activeLineup.reduce((sum, pid) => sum + (playerEarningsMap.get(pid) || 0), 0);
      return { teamId: team.teamId, weekEarnings };
    });

    // Sort by season earnings for rank
    const sorted = [...league.teams].sort((a, b) => b.seasonEarnings - a.seasonEarnings);
    const myTeam = league.teams.find((t) => t.teamId === 1);
    const myRank = sorted.findIndex((t) => t.teamId === 1) + 1;
    const myWeek = teamWeekEarnings.find((t) => t.teamId === 1)?.weekEarnings || 0;

    return {
      id: league.id,
      name: league.name,
      team: myTeam?.teamName || "",
      rank: myRank,
      of: league.teams.length,
      money: myTeam?.seasonEarnings || 0,
      weekMoney: myWeek,
      members: league.teams.length,
      tournament: tournament.name,
      course: tournament.course,
      loc: tournament.location,
      purse: tournament.purse,
      status,
      round,
      cut: cutDisplay,
      phase,
    };
  });

  res.json(summaries);
});

// GET /api/league/:id — league info
router.get("/:id", (req, res) => {
  const state = loadLeagueState();
  const league = state.leagues[req.params.id];
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  res.json({
    id: league.id,
    name: league.name,
    members: league.teams.map((t) => ({
      teamId: t.teamId,
      teamName: t.teamName,
      managerName: t.managerName,
    })),
    settings: league.settings,
  });
});

// GET /api/league/:id/leaderboard — fantasy team leaderboard for current tournament
router.get("/:id/leaderboard", (req, res) => {
  const leagueState = loadLeagueState();
  const league = leagueState.leagues[req.params.id];
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const simState = loadState();
  const tournaments = loadTournaments();
  const tournament = tournaments.find((t) => t.id === simState.tournamentId) || tournaments[0];
  const payoutTable = loadPayoutTable();

  // Calculate earnings for each player in the sim
  const playerEarningsMap = new Map<number, { earnings: number; position: number; toPar: number; toParDisplay: string; status: string }>();
  for (const p of simState.players) {
    let earnings = 0;
    if (simState.phase === "final" && p.status === "active") {
      const payout = payoutTable.find((pt) => pt.position === p.position);
      if (payout) {
        earnings = Math.round(tournament.purse * (payout.pct / 100));
      }
    }
    playerEarningsMap.set(p.playerId, {
      earnings,
      position: p.position,
      toPar: p.toPar,
      toParDisplay: p.rounds.length > 0 ? formatScore(p.toPar) : "-",
      status: p.status,
    });
  }

  // Build team summaries
  const teams = league.teams.map((team) => {
    const players = team.roster.map((playerId) => {
      const simPlayer = simState.players.find((p) => p.playerId === playerId);
      const earningsData = playerEarningsMap.get(playerId);
      const isActive = team.activeLineup.includes(playerId);

      return {
        playerId,
        name: simPlayer?.name || `Player ${playerId}`,
        position: earningsData?.position ?? 0,
        toPar: earningsData?.toPar ?? 0,
        toParDisplay: earningsData?.toParDisplay ?? "-",
        status: (earningsData?.status ?? "active") as "active" | "cut" | "wd",
        earnings: isActive ? (earningsData?.earnings ?? 0) : 0,
        isActive,
      };
    });

    const totalEarnings = players.reduce((sum, p) => sum + p.earnings, 0);

    return {
      teamId: team.teamId,
      teamName: team.teamName,
      managerName: team.managerName,
      totalEarnings,
      players,
    };
  });

  // Sort by total earnings (descending)
  teams.sort((a, b) => b.totalEarnings - a.totalEarnings);

  res.json({
    leagueId: league.id,
    leagueName: league.name,
    tournamentName: tournament.name,
    phase: simState.phase,
    teams,
  });
});

// GET /api/league/:id/team/:teamId — team detail
router.get("/:id/team/:teamId", (req, res) => {
  const state = loadLeagueState();
  const league = state.leagues[req.params.id];
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const team = league.teams.find((t) => t.teamId === Number(req.params.teamId));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  res.json(team);
});

// GET /api/league/:id/team/:teamId/roster — full roster with player details
router.get("/:id/team/:teamId/roster", (req, res) => {
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
  const tournaments = loadTournaments();
  const currentTournament = getCurrentTournament();
  const reqTournamentId = req.query.tournamentId ? Number(req.query.tournamentId) : undefined;
  const isLiveTournament = (!reqTournamentId || reqTournamentId === currentTournament.id) && simState.tournamentId === currentTournament.id;

  // Validate requested tournament exists
  if (reqTournamentId && !tournaments.find((t) => t.id === reqTournamentId)) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  if (isLiveTournament) {
    // Live tournament — full sim data
    const tournament = tournaments.find((t) => t.id === simState.tournamentId) || tournaments[0];
    const payoutTable = loadPayoutTable();
    const locked = simState.phase !== "idle";

    const roster = team.roster.map((playerId) => {
      const simPlayer = simState.players.find((p) => p.playerId === playerId);
      let earnings = 0;
      if (simState.phase === "final" && simPlayer?.status === "active") {
        const payout = payoutTable.find((pt) => pt.position === simPlayer.position);
        if (payout) {
          earnings = Math.round(tournament.purse * (payout.pct / 100));
        }
      }

      return {
        playerId,
        name: simPlayer?.name || `Player ${playerId}`,
        country: simPlayer?.country || "",
        ranking: simPlayer?.ranking || 0,
        isActive: team.activeLineup.includes(playerId),
        inField: !!simPlayer,
        toPar: simPlayer?.toPar ?? 0,
        toParDisplay: simPlayer && simPlayer.rounds.length > 0 ? formatScore(simPlayer.toPar) : "-",
        position: simPlayer?.position ?? 0,
        status: (simPlayer?.status ?? "active") as "active" | "cut" | "wd",
        rounds: simPlayer?.rounds ?? [],
        earnings: team.activeLineup.includes(playerId) ? earnings : 0,
      };
    });

    const reserve = (team.reserve || []).map((playerId) => {
      const simPlayer = simState.players.find((p) => p.playerId === playerId);
      let earnings = 0;
      if (simState.phase === "final" && simPlayer?.status === "active") {
        const payout = payoutTable.find((pt) => pt.position === simPlayer.position);
        if (payout) {
          earnings = Math.round(tournament.purse * (payout.pct / 100));
        }
      }

      return {
        playerId,
        name: simPlayer?.name || `Player ${playerId}`,
        country: simPlayer?.country || "",
        ranking: simPlayer?.ranking || 0,
        isActive: false,
        inField: !!simPlayer,
        toPar: simPlayer?.toPar ?? 0,
        toParDisplay: simPlayer && simPlayer.rounds.length > 0 ? formatScore(simPlayer.toPar) : "-",
        position: simPlayer?.position ?? 0,
        status: (simPlayer?.status ?? "active") as "active" | "cut" | "wd",
        rounds: simPlayer?.rounds ?? [],
        earnings: 0,
      };
    });

    res.json({
      teamId: team.teamId,
      teamName: team.teamName,
      leagueId: league.id,
      locked,
      phase: simState.phase,
      settings: league.settings,
      roster,
      reserve,
    });
  } else {
    // Non-live tournament — base player info only
    const seedPlayers = loadPlayers();
    const seedMap = new Map(seedPlayers.map((p) => [p.id, p]));

    const buildStatic = (playerId: number, isActive: boolean) => {
      const seed = seedMap.get(playerId);
      return {
        playerId,
        name: seed?.name || `Player ${playerId}`,
        country: seed?.country || "",
        ranking: seed?.ranking || 0,
        isActive,
        inField: true,
        toPar: 0,
        toParDisplay: "-",
        position: 0,
        status: "active" as const,
        rounds: [] as number[],
        earnings: 0,
      };
    };

    const roster = team.roster.map((pid) => buildStatic(pid, team.activeLineup.includes(pid)));
    const reserve = (team.reserve || []).map((pid) => buildStatic(pid, false));

    res.json({
      teamId: team.teamId,
      teamName: team.teamName,
      leagueId: league.id,
      locked: true,
      phase: "idle",
      settings: league.settings,
      roster,
      reserve,
    });
  }
});

// POST /api/league/:id/team/:teamId/lineup — set active lineup
router.post("/:id/team/:teamId/lineup", (req, res) => {
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
  if (simState.phase !== "idle") {
    res.status(403).json({ error: "Lineup is locked — tournament is in progress" });
    return;
  }

  const { activePlayerIds } = req.body;
  if (!Array.isArray(activePlayerIds)) {
    res.status(400).json({ error: "activePlayerIds must be an array" });
    return;
  }

  if (activePlayerIds.length !== league.settings.activeSize) {
    res.status(400).json({ error: `Active lineup must have exactly ${league.settings.activeSize} players` });
    return;
  }

  // Verify all players are on the roster
  for (const pid of activePlayerIds) {
    if (!team.roster.includes(pid)) {
      res.status(400).json({ error: `Player ${pid} is not on your roster` });
      return;
    }
  }

  team.activeLineup = activePlayerIds;
  saveLeagueState(leagueState);

  res.json({ ok: true });
});

export default router;
