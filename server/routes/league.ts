import { Router } from "express";
import { loadActiveSimState, getActiveTournamentId, loadTournamentState, type SimState } from "../db/dal/sim.js";
import { loadTournaments, loadPayoutTable, loadGolfers } from "../db/dal/seed-data.js";
import { getLeague, getAllLeagues, getLineup, getLineupsForTeams, setLineup } from "../db/dal/league.js";
import { formatScore, calculatePlayerPoints, calculateRoundPoints } from "../sim/engine.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/league/all — all leagues summary for lobby
router.get("/all", async (_req: AuthenticatedRequest, res) => {
  const [allLeagues, simState, tournaments, activeId] = await Promise.all([
    getAllLeagues(),
    loadActiveSimState(),
    loadTournaments(),
    getActiveTournamentId(),
  ]);
  const payoutTable = loadPayoutTable();
  const tournament = tournaments.find((t) => t.id === activeId) || tournaments[0];
  const simMatchesCurrent = simState.tournamentId === tournament.id;

  const playerEarningsMap = new Map<number, number>();
  if (simMatchesCurrent) {
    for (const p of simState.players) {
      let earnings = 0;
      if (p.status === "active" && p.rounds.length > 0) {
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

  const userId = (_req as AuthenticatedRequest).manager?.id;

  // Batch fetch all lineups in one query
  const allTeamPks = allLeagues.flatMap((l) => l.teams.map((t) => t.pk));
  const allLineups = await getLineupsForTeams(allTeamPks, tournament.id);

  // Build a map of player objects for quick lookup
  const playerMap = new Map(simState.players.map((p) => [p.playerId, p]));
  const holePars = simState.holePars ?? [];

  const summaries = allLeagues.map((league) => {
    const scoring = league.settings.scoringSettings;

    const teamWeekData = league.teams.map((team) => {
      const lineup = allLineups.get(team.pk) ?? [];
      const weekEarnings = lineup.reduce((sum, pid) => sum + (playerEarningsMap.get(pid) || 0), 0);
      let weekPoints = 0;
      if (simMatchesCurrent) {
        for (const pid of lineup) {
          const player = playerMap.get(pid);
          if (player) weekPoints += calculatePlayerPoints(player.holeScores, holePars, scoring);
        }
      }
      return { teamId: team.teamId, weekEarnings, weekPoints };
    });

    const sorted = [...league.teams].sort((a, b) => b.seasonPoints - a.seasonPoints || b.seasonEarnings - a.seasonEarnings);
    const myTeam = league.teams.find((t) => t.managerId === userId);
    const myRank = myTeam ? sorted.findIndex((t) => t.teamId === myTeam.teamId) + 1 : 0;
    const myWeekData = myTeam ? teamWeekData.find((t) => t.teamId === myTeam.teamId) : undefined;
    const weekSorted = [...teamWeekData].sort((a, b) => b.weekPoints - a.weekPoints);
    const myWeekRank = myTeam ? weekSorted.findIndex((t) => t.teamId === myTeam.teamId) + 1 : 0;

    return {
      id: league.id,
      name: league.name,
      team: myTeam?.teamName || "",
      teamColor: myTeam?.colorCode ?? "#003C80",
      teamSecondaryColor: myTeam?.secondaryColorCode ?? "#FFFFFF",
      rank: myRank,
      of: league.teams.length,
      money: myTeam?.seasonEarnings || 0,
      weekMoney: myWeekData?.weekEarnings || 0,
      points: myTeam?.seasonPoints || 0,
      weekPoints: myWeekData?.weekPoints || 0,
      weekRank: myWeekRank,
      showMoney: league.settings.showMoney,
      members: league.teams.length,
      tournament: tournament.name,
      course: tournament.course,
      loc: tournament.location,
      purse: tournament.purse,
      color: tournament.color,
      secondaryColor: tournament.secondaryColor,
      status,
      round,
      cut: cutDisplay,
      phase,
      week: tournaments.findIndex((t) => t.id === tournament.id) + 1,
      myTeamId: myTeam?.teamId ?? null,
    };
  });

  // Only return leagues where the user has a team
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
      color: t.colorCode,
      secondaryColor: t.secondaryColorCode,
    })),
    settings: league.settings,
  });
});

// GET /api/league/:id/leaderboard — fantasy team leaderboard for a tournament
router.get("/:id/leaderboard", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const reqTournamentId = req.query.tournamentId ? Number(req.query.tournamentId) : undefined;
  let simState: SimState;
  const tournaments = await loadTournaments();

  if (reqTournamentId) {
    simState = await loadTournamentState(reqTournamentId);
  } else {
    simState = await loadActiveSimState();
  }
  const payoutTable = loadPayoutTable();
  const tournament = tournaments.find((t) => t.id === simState.tournamentId) || tournaments[0];

  const playerEarningsMap = new Map<number, { earnings: number; position: number; toPar: number; toParDisplay: string; status: string }>();
  for (const p of simState.players) {
    let earnings = 0;
    if (p.status === "active" && p.rounds.length > 0) {
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
  const holePars = simState.holePars ?? [];
  const scoring = league.settings.scoringSettings;

  const teams = league.teams.map((team) => {
    const lineup = leagueLineups.get(team.pk) ?? [];
    const players = team.roster.map((playerId) => {
      const simPlayer = simState.players.find((p) => p.playerId === playerId);
      const earningsData = playerEarningsMap.get(playerId);
      const isActive = lineup.includes(playerId);
      const pts = simPlayer ? calculatePlayerPoints(simPlayer.holeScores, holePars, scoring) : 0;

      return {
        playerId,
        name: simPlayer?.name || `Player ${playerId}`,
        position: earningsData?.position ?? 0,
        toPar: earningsData?.toPar ?? 0,
        toParDisplay: earningsData?.toParDisplay ?? "-",
        status: (earningsData?.status ?? "active") as "active" | "cut" | "wd",
        earnings: isActive ? (earningsData?.earnings ?? 0) : 0,
        points: isActive ? pts : 0,
        isActive,
      };
    });

    const totalEarnings = players.reduce((sum, p) => sum + p.earnings, 0);
    const totalPoints = players.reduce((sum, p) => sum + p.points, 0);

    return {
      teamId: team.teamId,
      teamName: team.teamName,
      managerName: team.managerName,
      color: team.colorCode,
      secondaryColor: team.secondaryColorCode,
      totalEarnings,
      totalPoints,
      players,
    };
  });

  teams.sort((a, b) => b.totalPoints - a.totalPoints || b.totalEarnings - a.totalEarnings);

  res.json({
    leagueId: league.id,
    leagueName: league.name,
    tournamentName: tournament.name,
    phase: simState.phase,
    showMoney: league.settings.showMoney,
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

  res.json({
    teamId: team.teamId,
    teamName: team.teamName,
    color: team.colorCode,
    secondaryColor: team.secondaryColorCode,
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
    const payoutTable = loadPayoutTable();
    const locked = simState.phase !== "idle";
    const lineup = await getLineup(team.pk, simState.tournamentId);
    const rosterHolePars = simState.holePars ?? [];
    const rosterScoring = league.settings.scoringSettings;

    const roster = team.roster.map((playerId) => {
      const simPlayer = simState.players.find((p) => p.playerId === playerId);
      let earnings = 0;
      if (simPlayer?.status === "active" && simPlayer.rounds.length > 0) {
        const payout = payoutTable.find((pt) => pt.position === simPlayer.position);
        if (payout) earnings = Math.round(tournament.purse * (payout.pct / 100));
      }
      const isActive = lineup.includes(playerId);
      const pts = simPlayer ? calculatePlayerPoints(simPlayer.holeScores, rosterHolePars, rosterScoring) : 0;
      const rPts = simPlayer ? calculateRoundPoints(simPlayer.holeScores, rosterHolePars, rosterScoring) : [];
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
        roundPoints: rPts,
        earnings: isActive ? earnings : 0,
        points: pts,
      };
    });

    const reserve = team.reserve.map((playerId) => {
      const simPlayer = simState.players.find((p) => p.playerId === playerId);
      const pts = simPlayer ? calculatePlayerPoints(simPlayer.holeScores, rosterHolePars, rosterScoring) : 0;
      const rPts = simPlayer ? calculateRoundPoints(simPlayer.holeScores, rosterHolePars, rosterScoring) : [];
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
        roundPoints: rPts,
        earnings: 0,
        points: pts,
      };
    });

    res.json({
      teamId: team.teamId,
      teamName: team.teamName,
      color: team.colorCode,
      secondaryColor: team.secondaryColorCode,
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

    // Try loading sim state for this tournament (works for completed weeks)
    const pastSimState = await loadTournamentState(viewTournamentId);
    const hasSim = pastSimState.players.length > 0 && pastSimState.phase !== "idle";

    if (hasSim) {
      const tournament = tournaments.find((t) => t.id === viewTournamentId) || tournaments[0];
      const payoutTable = loadPayoutTable();
      const pastHolePars = pastSimState.holePars ?? [];
      const pastScoring = league.settings.scoringSettings;

      const buildPlayer = (playerId: number, isActive: boolean) => {
        const simPlayer = pastSimState.players.find((p) => p.playerId === playerId);
        let earnings = 0;
        if (simPlayer?.status === "active" && simPlayer.rounds.length > 0) {
          const payout = payoutTable.find((pt) => pt.position === simPlayer.position);
          if (payout) earnings = Math.round(tournament.purse * (payout.pct / 100));
        }
        const pts = simPlayer ? calculatePlayerPoints(simPlayer.holeScores, pastHolePars, pastScoring) : 0;
        const rPts = simPlayer ? calculateRoundPoints(simPlayer.holeScores, pastHolePars, pastScoring) : [];
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
          roundPoints: rPts,
          earnings: isActive ? earnings : 0,
          points: pts,
        };
      };

      const roster = team.roster.map((pid) => buildPlayer(pid, lineup.includes(pid)));
      const reserve = team.reserve.map((pid) => buildPlayer(pid, false));

      res.json({
        teamId: team.teamId,
        teamName: team.teamName,
        color: team.colorCode,
        secondaryColor: team.secondaryColorCode,
        leagueId: league.id,
        locked: true,
        phase: pastSimState.phase,
        settings: league.settings,
        roster,
        reserve,
      });
    } else {
      const seedGolfers = await loadGolfers();
      const seedMap = new Map(seedGolfers.map((p) => [p.id, p]));

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
          roundPoints: [] as number[],
          earnings: 0,
          points: 0,
        };
      };

      const currentIdx = tournaments.findIndex((t) => t.id === currentTournament.id);
      const viewIdx = tournaments.findIndex((t) => t.id === viewTournamentId);
      const isFuture = viewIdx > currentIdx;

      const roster = team.roster.map((pid) => buildStatic(pid, lineup.includes(pid)));
      const reserve = team.reserve.map((pid) => buildStatic(pid, false));

      res.json({
        teamId: team.teamId,
        teamName: team.teamName,
        color: team.colorCode,
        secondaryColor: team.secondaryColorCode,
        leagueId: league.id,
        locked: !isFuture,
        phase: "idle",
        settings: league.settings,
        roster,
        reserve,
      });
    }
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

  const { activePlayerIds, tournamentId: reqTournamentId } = req.body;

  const tournaments = await loadTournaments();
  const activeId = await getActiveTournamentId();
  const currentTournament = tournaments.find((t) => t.id === activeId) || tournaments[0];

  // Determine target tournament — default to current
  const targetId = typeof reqTournamentId === "number" ? reqTournamentId : currentTournament.id;
  const targetTournament = tournaments.find((t) => t.id === targetId);
  if (!targetTournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }

  // Block edits for past tournaments and for the current tournament while sim is in progress
  const currentIdx = tournaments.findIndex((t) => t.id === currentTournament.id);
  const targetIdx = tournaments.findIndex((t) => t.id === targetId);
  if (targetIdx < currentIdx) {
    res.status(403).json({ error: "Cannot change lineup for a past tournament" });
    return;
  }

  const simState = await loadActiveSimState();
  if (targetId === currentTournament.id && simState.phase !== "idle") {
    res.status(403).json({ error: "Lineup is locked — tournament is in progress" });
    return;
  }

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

  await setLineup(team.pk, targetId, activePlayerIds);

  res.json({ ok: true });
});

export default router;
