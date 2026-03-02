import { Router } from "express";
import { loadPlayers, loadState } from "../sim/engine.js";
import { loadLeagueState, saveLeagueState, getLineup, setLineupForTournament } from "../lib/league-helpers.js";

const router = Router();

// GET /api/league/:id/players — all players with ownership status
router.get("/:id/players", (req, res) => {
  const leagueState = loadLeagueState();
  const league = leagueState.leagues[req.params.id];
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const allPlayers = loadPlayers();
  const simState = loadState();

  // Build ownership map (roster + reserve)
  const ownershipMap = new Map<number, { teamId: number; teamName: string }>();
  for (const team of league.teams) {
    for (const playerId of team.roster) {
      ownershipMap.set(playerId, { teamId: team.teamId, teamName: team.teamName });
    }
    for (const playerId of (team.reserve || [])) {
      ownershipMap.set(playerId, { teamId: team.teamId, teamName: team.teamName });
    }
  }

  const pool = allPlayers.map((p) => {
    const simPlayer = simState.players.find((sp) => sp.playerId === p.id);
    return {
      playerId: p.id,
      name: p.name,
      country: p.country,
      ranking: p.ranking,
      ownedBy: ownershipMap.get(p.id) || null,
      seasonEarnings: 0, // TODO: calculate from historical data
      recentFinishes: simPlayer ? [`T${simPlayer.position}`] : [],
    };
  });

  res.json(pool);
});

// POST /api/league/:id/waiver/claim — submit a waiver claim
router.post("/:id/waiver/claim", (req, res) => {
  const leagueState = loadLeagueState();
  const league = leagueState.leagues[req.params.id];
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const { addPlayerId, dropPlayerId, faabBid, teamId = 1 } = req.body;
  if (!addPlayerId) {
    res.status(400).json({ error: "addPlayerId is required" });
    return;
  }

  // Check the add player is a free agent (roster + reserve)
  const isOwned = league.teams.some((t) =>
    t.roster.includes(addPlayerId) || (t.reserve || []).includes(addPlayerId)
  );
  if (isOwned) {
    res.status(400).json({ error: "Player is already rostered" });
    return;
  }

  const team = league.teams.find((t) => t.teamId === teamId);
  if (!team) {
    res.status(400).json({ error: "Team not found" });
    return;
  }

  // If drop player specified, verify they're on the roster
  if (dropPlayerId) {
    if (!team.roster.includes(dropPlayerId)) {
      res.status(400).json({ error: "Drop player is not on your roster" });
      return;
    }
  } else {
    // No drop — roster must have room
    if (team.roster.length >= league.settings.rosterSize) {
      res.status(400).json({ error: "Roster is full — must drop a player" });
      return;
    }
  }

  league.waiverClaims.push({
    id: `wc-${Date.now()}`,
    teamId,
    addPlayerId,
    dropPlayerId: dropPlayerId || null,
    faabBid: faabBid || 0,
    timestamp: new Date().toISOString(),
  });

  saveLeagueState(leagueState);
  res.json({ ok: true });
});

// POST /api/league/:id/waiver/process — process all pending waivers
router.post("/:id/waiver/process", (req, res) => {
  const leagueState = loadLeagueState();
  const league = leagueState.leagues[req.params.id];
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const simState = loadState();
  const currentTournamentId = simState.tournamentId;
  const claims = league.waiverClaims;
  let processed = 0;

  // Sort by FAAB bid (highest first), then timestamp (earliest first)
  claims.sort((a: { faabBid: number; timestamp: string }, b: { faabBid: number; timestamp: string }) =>
    b.faabBid - a.faabBid || new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const processedPlayers = new Set<number>();

  for (const claim of claims) {
    // Skip if add player was already claimed
    if (processedPlayers.has(claim.addPlayerId)) continue;

    const team = league.teams.find((t) => t.teamId === claim.teamId);
    if (!team) continue;

    const allPlayers = loadPlayers();
    const addName = allPlayers.find((p) => p.id === claim.addPlayerId)?.name || `Player ${claim.addPlayerId}`;

    if (claim.dropPlayerId) {
      // Execute the swap
      const dropIdx = team.roster.indexOf(claim.dropPlayerId);
      if (dropIdx === -1) continue;
      team.roster[dropIdx] = claim.addPlayerId;
      // If dropped player was in current tournament lineup, replace with added player
      const lineup = getLineup(team, currentTournamentId);
      const activeIdx = lineup.indexOf(claim.dropPlayerId);
      if (activeIdx !== -1) {
        lineup[activeIdx] = claim.addPlayerId;
        setLineupForTournament(team, currentTournamentId, lineup);
      }

      const dropName = allPlayers.find((p) => p.id === claim.dropPlayerId)?.name || `Player ${claim.dropPlayerId}`;
      league.activityFeed.push({
        id: `feed-${Date.now()}-${processed}`,
        type: "waiver",
        message: `${team.teamName} added ${addName} and dropped ${dropName}`,
        timestamp: new Date().toISOString(),
      });
    } else {
      // Pure add — roster has room
      if (team.roster.length >= league.settings.rosterSize) continue;
      team.roster.push(claim.addPlayerId);

      league.activityFeed.push({
        id: `feed-${Date.now()}-${processed}`,
        type: "waiver",
        message: `${team.teamName} added ${addName}`,
        timestamp: new Date().toISOString(),
      });
    }

    processedPlayers.add(claim.addPlayerId);
    processed++;
  }

  // Clear processed claims
  league.waiverClaims = [];
  saveLeagueState(leagueState);

  res.json({ processed });
});

export default router;
