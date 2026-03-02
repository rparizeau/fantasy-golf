import { Router } from "express";
import { loadActiveSimState, getActiveTournamentId } from "../db/dal/sim.js";
import { loadTournaments, loadPayoutTable, loadPlayers } from "../db/dal/seed-data.js";
import { getLeague, getAllLeagues, getLineup, getLineupsForTeams, setLineup } from "../db/dal/league.js";
import { formatScore } from "../sim/engine.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/league/all — all leagues summary for lobby
router.get("/all", async (_req: AuthenticatedRequest, res) => {
  const [allLeagues, simState, tournaments, activeId, payoutTable] = await Promise.all([
    getAllLeagues(),
    loadActiveSimState(),
    loadTournaments(),
    getActiveTournamentId(),
    loadPayoutTable(),
  ]);
  const tournament = tournaments.find((t) => t.id === activeId) || tournaments[0];
  const simMatchesCurrent = simState.tournamentId === tournament.id;

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

  let cutDisplay = "—";
  if (simMatchesCurrent && simState.cutLine !== null) {
    const cl = simState.cutLine;
    const strokes = tournament.par * 2 + cl;
    cutDisplay = cl === 0 ? `E (${strokes})` : cl > 0 ? `+${cl} (${strokes})` : `${cl} (${strokes})`;
  }

  const managerId = (_req as AuthenticatedRequest).manager?.id;

  // Batch fetch all lineups in one query
  const allTeamPks = allLeagues.flatMap((l) => l.teams.map((t) => t.pk));
  const allLineups = await getLineupsForTeams(allTeamPks, tournament.id);

  const summaries = allLeagues.map((league) => {
    const teamWeekEarnings = league.teams.map((team) => {
      const lineup = allLineups.get(team.pk) ?? [];
      const weekEarnings = lineup.reduce((sum, pid) => sum + (playerEarningsMap.get(pid) || 0), 0);
      return { teamId: team.teamId, weekEarnings };
    });

    const sorted = [...league.teams].sort((a, b) => b.seasonEarnings - a.seasonEarnings);
    const myTeam = league.teams.find((t) => t.managerId === managerId);
    const myRank = myTeam ? sorted.findIndex((t) => t.teamId === myTeam.teamId) + 1 : 0;
    const myWeek = myTeam ? teamWeekEarnings.find((t) => t.teamId === myTeam.teamId)?.weekEarnings || 0 : 0;

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
      myTeamId: myTeam?.teamId ?? null,
    };
  });

  // Only return leagues where the manager has a team
  res.json(summaries.filter((s) => s.myTeamId !== null));
});

// GET /api/league/:id — league info
router.get("/:id", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
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
router.get("/:id/leaderboard", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const [simState, tournaments, payoutTable] = await Promise.all([
    loadActiveSimState(),
    loadTournaments(),
    loadPayoutTable(),
  ]);
  const tournament = tournaments.find((t) => t.id === simState.tournamentId) || tournaments[0];

  const playerEarningsMap = new Map<number, { earnings: number; position: number; toPar: number; toParDisplay: string; status: string }>();
  for (const p of simState.players) {
    let earnings = 0;
    if (simState.phase === "final" && p.status === "active") {
      const payout = payoutTable.find((pt) => pt.position === p.position);
      if (payout) earnings = Math.round(tournament.purse * (payout.pct / 100));
    }
    playerEarningsMap.set(p.playerId, {
      earnings,
      position: p.position,
      toPar: p.toPar,
      toParDisplay: p.rounds.length > 0 ? formatScore(p.toPar) : "-",
      status: p.status,
    });
  }

  const leagueTeamPks = league.teams.map((t) => t.pk);
  const leagueLineups = await getLineupsForTeams(leagueTeamPks, simState.tournamentId);

  const teams = league.teams.map((team) => {
    const lineup = leagueLineups.get(team.pk) ?? [];
    const players = team.roster.map((playerId) => {
      const simPlayer = simState.players.find((p) => p.playerId === playerId);
      const earningsData = playerEarningsMap.get(playerId);
      const isActive = lineup.includes(playerId);

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
router.get("/:id/team/:teamId", async (req, res) => {
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

  // Return in the existing shape with tournamentLineups reconstructed
  // (For backwards compat — routes that need lineup use getLineup directly)
  res.json({
    teamId: team.teamId,
    teamName: team.teamName,
    managerName: team.managerName,
    roster: team.roster,
    reserve: team.reserve,
    mulligansUsed: team.mulligansUsed,
    seasonEarnings: team.seasonEarnings,
    tournamentLineups: {},
  });
});

// GET /api/league/:id/team/:teamId/roster — full roster with player details
router.get("/:id/team/:teamId/roster", async (req, res) => {
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
  const currentTournament = tournaments.find((t) => t.id === activeId) || tournaments[0];
  const reqTournamentId = req.query.tournamentId ? Number(req.query.tournamentId) : undefined;
  const isLiveTournament = (!reqTournamentId || reqTournamentId === currentTournament.id) && simState.tournamentId === currentTournament.id;

  if (reqTournamentId && !tournaments.find((t) => t.id === reqTournamentId)) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  if (isLiveTournament) {
    const tournament = tournaments.find((t) => t.id === simState.tournamentId) || tournaments[0];
    const payoutTable = await loadPayoutTable();
    const locked = simState.phase !== "idle";
    const lineup = await getLineup(team.pk, simState.tournamentId);

    const roster = team.roster.map((playerId) => {
      const simPlayer = simState.players.find((p) => p.playerId === playerId);
      let earnings = 0;
      if (simState.phase === "final" && simPlayer?.status === "active") {
        const payout = payoutTable.find((pt) => pt.position === simPlayer.position);
        if (payout) earnings = Math.round(tournament.purse * (payout.pct / 100));
      }
      const isActive = lineup.includes(playerId);
      return {
        playerId,
        name: simPlayer?.name || `Player ${playerId}`,
        country: simPlayer?.country || "",
        ranking: simPlayer?.ranking || 0,
        isActive,
        inField: !!simPlayer,
        toPar: simPlayer?.toPar ?? 0,
        toParDisplay: simPlayer && simPlayer.rounds.length > 0 ? formatScore(simPlayer.toPar) : "-",
        position: simPlayer?.position ?? 0,
        status: (simPlayer?.status ?? "active") as "active" | "cut" | "wd",
        rounds: simPlayer?.rounds ?? [],
        earnings: isActive ? earnings : 0,
      };
    });

    const reserve = team.reserve.map((playerId) => {
      const simPlayer = simState.players.find((p) => p.playerId === playerId);
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
    const viewTournamentId = reqTournamentId || currentTournament.id;
    const lineup = await getLineup(team.pk, viewTournamentId);
    const seedPlayers = await loadPlayers();
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

    const roster = team.roster.map((pid) => buildStatic(pid, lineup.includes(pid)));
    const reserve = team.reserve.map((pid) => buildStatic(pid, false));

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
router.post("/:id/team/:teamId/lineup", async (req: AuthenticatedRequest, res) => {
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

  for (const pid of activePlayerIds) {
    if (!team.roster.includes(pid)) {
      res.status(400).json({ error: `Player ${pid} is not on your roster` });
      return;
    }
  }

  const tournaments = await loadTournaments();
  const activeId = await getActiveTournamentId();
  const currentTournament = tournaments.find((t) => t.id === activeId) || tournaments[0];
  await setLineup(team.pk, currentTournament.id, activePlayerIds);

  res.json({ ok: true });
});

export default router;
