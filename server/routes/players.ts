import { Router } from "express";
import { loadGolfers } from "../db/dal/seed-data.js";
import { loadActiveSimState } from "../db/dal/sim.js";
import {
  getLeague, getOwnershipMap, isPlayerOwned,
  addWaiverClaim, getTeamByManagerAndLeague,
  getWaiverClaims, clearWaiverClaims,
  swapRosterPlayer, addToRoster, getLineup, setLineup,
  addActivityFeedEntry,
} from "../db/dal/league.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/league/:id/players — all players with ownership status
router.get("/:id/players", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const allGolfers = await loadGolfers();
  const simState = await loadActiveSimState();
  const ownershipMap = await getOwnershipMap(league.id);

  const pool = allGolfers.map((p) => {
    const simPlayer = simState.players.find((sp) => sp.playerId === p.id);
    return {
      playerId: p.id,
      name: p.name,
      country: p.country,
      ranking: p.ranking,
      ownedBy: ownershipMap.get(p.id) || null,
      seasonEarnings: 0,
      recentFinishes: simPlayer ? [`T${simPlayer.position}`] : [],
    };
  });

  res.json(pool);
});

// POST /api/league/:id/waiver/claim — submit a waiver claim
router.post("/:id/waiver/claim", async (req: AuthenticatedRequest, res) => {
  const leagueId = Number(req.params.id);
  const league = await getLeague(leagueId);
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const myTeam = await getTeamByManagerAndLeague(req.manager!.id, leagueId);
  if (!myTeam) {
    res.status(403).json({ error: "You don't have a team in this league" });
    return;
  }

  const { addPlayerId, dropPlayerId, faabBid } = req.body;
  if (!addPlayerId) {
    res.status(400).json({ error: "addPlayerId is required" });
    return;
  }

  const owned = await isPlayerOwned(league.id, addPlayerId);
  if (owned) {
    res.status(400).json({ error: "Player is already rostered" });
    return;
  }

  if (dropPlayerId) {
    if (!myTeam.roster.includes(dropPlayerId)) {
      res.status(400).json({ error: "Drop player is not on your roster" });
      return;
    }
  } else {
    if (myTeam.roster.length >= league.settings.rosterSize) {
      res.status(400).json({ error: "Roster is full — must drop a player" });
      return;
    }
  }

  await addWaiverClaim(league.id, myTeam.pk, addPlayerId, dropPlayerId || null, faabBid || 0);
  res.json({ ok: true });
});

// POST /api/league/:id/waiver/process — process all pending waivers
router.post("/:id/waiver/process", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const simState = await loadActiveSimState();
  const currentTournamentId = simState.tournamentId;
  const claims = await getWaiverClaims(league.id);
  const allGolfers = await loadGolfers();
  let processed = 0;
  const processedPlayers = new Set<number>();

  for (const claim of claims) {
    if (processedPlayers.has(claim.addGolferId)) continue;

    const team = league.teams.find((t) => t.pk === claim.managerId);
    if (!team) continue;

    const addName = allGolfers.find((p) => p.id === claim.addGolferId)?.name || `Player ${claim.addGolferId}`;

    if (claim.dropGolferId) {
      const dropIdx = team.roster.indexOf(claim.dropGolferId);
      if (dropIdx === -1) continue;

      await swapRosterPlayer(team.pk, claim.dropGolferId, claim.addGolferId);

      // Update lineup if dropped player was active
      const lineup = await getLineup(team.pk, currentTournamentId);
      const activeIdx = lineup.indexOf(claim.dropGolferId);
      if (activeIdx !== -1) {
        lineup[activeIdx] = claim.addGolferId;
        await setLineup(team.pk, currentTournamentId, lineup);
      }

      const dropName = allGolfers.find((p) => p.id === claim.dropGolferId)?.name || `Player ${claim.dropGolferId}`;
      await addActivityFeedEntry(league.id, "waiver", `${team.teamName} added ${addName} and dropped ${dropName}`);
    } else {
      if (team.roster.length >= league.settings.rosterSize) continue;
      await addToRoster(team.pk, claim.addGolferId);
      await addActivityFeedEntry(league.id, "waiver", `${team.teamName} added ${addName}`);
    }

    processedPlayers.add(claim.addGolferId);
    processed++;
  }

  await clearWaiverClaims(league.id);
  res.json({ processed });
});

export default router;
