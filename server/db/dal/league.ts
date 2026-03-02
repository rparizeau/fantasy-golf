import { db } from "../index.js";
import {
  leagues, teams, teamRosters, tournamentLineups,
  waiverClaims, activityFeed, chatMessages, managers,
} from "../schema/index.js";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import type { ScoringSettings } from "../../sim/engine.js";

// --- Types matching existing API shapes ---

export interface TeamData {
  pk: number;            // global PK (teams.id)
  teamId: number;        // league-local ID
  teamName: string;
  managerName: string;
  managerId: number | null;
  roster: number[];      // player IDs with slot='roster'
  reserve: number[];     // player IDs with slot='reserve'
  mulligansUsed: number;
  seasonEarnings: number;
  seasonPoints: number;
}

export interface LeagueData {
  id: number;
  name: string;
  settings: {
    rosterSize: number;
    activeSize: number;
    reserveSize: number;
    mulligansPerSeason: number;
    scoringSettings: ScoringSettings;
    showMoney: boolean;
  };
  teams: TeamData[];
}

// --- Internal helper: build TeamData[] from team rows + batched rosters ---

function buildTeamDataList(
  teamRows: (typeof teams.$inferSelect)[],
  allRosterRows: (typeof teamRosters.$inferSelect)[],
): TeamData[] {
  const rosterByPk = new Map<number, (typeof teamRosters.$inferSelect)[]>();
  for (const r of allRosterRows) {
    const arr = rosterByPk.get(r.teamPk) ?? [];
    arr.push(r);
    rosterByPk.set(r.teamPk, arr);
  }

  return teamRows.map((t) => {
    const rows = rosterByPk.get(t.id) ?? [];
    return {
      pk: t.id,
      teamId: t.teamId,
      teamName: t.teamName,
      managerName: t.managerName,
      managerId: t.managerId,
      roster: rows.filter((r) => r.slot === "roster").map((r) => r.playerId),
      reserve: rows.filter((r) => r.slot === "reserve").map((r) => r.playerId),
      mulligansUsed: t.mulligansUsed,
      seasonEarnings: t.seasonEarnings,
      seasonPoints: t.seasonPoints,
    };
  });
}

// --- League queries ---

export async function getLeague(leagueId: number): Promise<LeagueData | null> {
  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId));
  if (!league) return null;

  const teamRows = await db.select().from(teams)
    .where(eq(teams.leagueId, leagueId))
    .orderBy(teams.teamId);

  const teamPks = teamRows.map((t) => t.id);
  const allRosterRows = teamPks.length > 0
    ? await db.select().from(teamRosters).where(inArray(teamRosters.teamPk, teamPks))
    : [];

  return {
    id: league.id,
    name: league.name,
    settings: {
      rosterSize: league.rosterSize,
      activeSize: league.activeSize,
      reserveSize: league.reserveSize,
      mulligansPerSeason: league.mulligansPerSeason,
      scoringSettings: league.scoringSettings,
      showMoney: league.showMoney,
    },
    teams: buildTeamDataList(teamRows, allRosterRows),
  };
}

export async function getAllLeagues(): Promise<LeagueData[]> {
  const [leagueRows, allTeamRows] = await Promise.all([
    db.select().from(leagues).orderBy(leagues.id),
    db.select().from(teams).orderBy(teams.leagueId, teams.teamId),
  ]);

  const allTeamPks = allTeamRows.map((t) => t.id);
  const allRosterRows = allTeamPks.length > 0
    ? await db.select().from(teamRosters).where(inArray(teamRosters.teamPk, allTeamPks))
    : [];

  return leagueRows.map((league) => {
    const leagueTeams = allTeamRows.filter((t) => t.leagueId === league.id);
    return {
      id: league.id,
      name: league.name,
      settings: {
        rosterSize: league.rosterSize,
        activeSize: league.activeSize,
        reserveSize: league.reserveSize,
        mulligansPerSeason: league.mulligansPerSeason,
        scoringSettings: league.scoringSettings,
        showMoney: league.showMoney,
      },
      teams: buildTeamDataList(leagueTeams, allRosterRows),
    };
  });
}

// --- Team queries ---

export async function getTeamPk(leagueId: number, teamId: number): Promise<number | null> {
  const [row] = await db.select({ id: teams.id }).from(teams)
    .where(and(eq(teams.leagueId, leagueId), eq(teams.teamId, teamId)));
  return row?.id ?? null;
}

// --- Lineup queries ---

export async function getLineup(teamPk: number, tournamentId: number): Promise<number[]> {
  const rows = await db.select().from(tournamentLineups)
    .where(and(
      eq(tournamentLineups.teamPk, teamPk),
      eq(tournamentLineups.tournamentId, tournamentId),
    ));
  return rows.map((r) => r.playerId);
}

export async function getLineupsForTeams(teamPks: number[], tournamentId: number): Promise<Map<number, number[]>> {
  if (teamPks.length === 0) return new Map();
  const rows = await db.select().from(tournamentLineups)
    .where(and(
      inArray(tournamentLineups.teamPk, teamPks),
      eq(tournamentLineups.tournamentId, tournamentId),
    ));
  const map = new Map<number, number[]>();
  for (const r of rows) {
    const arr = map.get(r.teamPk) ?? [];
    arr.push(r.playerId);
    map.set(r.teamPk, arr);
  }
  return map;
}

export async function setLineup(teamPk: number, tournamentId: number, playerIds: number[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(tournamentLineups).where(and(
      eq(tournamentLineups.teamPk, teamPk),
      eq(tournamentLineups.tournamentId, tournamentId),
    ));
    if (playerIds.length > 0) {
      await tx.insert(tournamentLineups).values(
        playerIds.map((pid) => ({ teamPk, tournamentId, playerId: pid }))
      );
    }
  });
}

// --- Roster mutations ---

export async function addToRoster(teamPk: number, playerId: number, slot: "roster" | "reserve" = "roster"): Promise<void> {
  await db.insert(teamRosters).values({ teamPk, playerId, slot });
}

export async function removeFromRoster(teamPk: number, playerId: number): Promise<void> {
  await db.delete(teamRosters).where(and(
    eq(teamRosters.teamPk, teamPk),
    eq(teamRosters.playerId, playerId),
  ));
}

export async function swapRosterPlayer(teamPk: number, dropPlayerId: number, addPlayerId: number): Promise<void> {
  await db.transaction(async (tx) => {
    // Get the slot of the dropped player
    const [dropped] = await tx.select().from(teamRosters)
      .where(and(eq(teamRosters.teamPk, teamPk), eq(teamRosters.playerId, dropPlayerId)));
    const slot = dropped?.slot ?? "roster";

    await tx.delete(teamRosters).where(and(
      eq(teamRosters.teamPk, teamPk),
      eq(teamRosters.playerId, dropPlayerId),
    ));
    await tx.insert(teamRosters).values({ teamPk, playerId: addPlayerId, slot });
  });
}

export async function getRosterCount(teamPk: number): Promise<number> {
  const rows = await db.select().from(teamRosters)
    .where(and(eq(teamRosters.teamPk, teamPk), eq(teamRosters.slot, "roster")));
  return rows.length;
}

// --- Season earnings ---

export async function updateSeasonEarnings(teamPk: number, delta: number): Promise<void> {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamPk));
  if (!team) return;
  const newEarnings = Math.max(0, team.seasonEarnings + delta);
  await db.update(teams).set({ seasonEarnings: newEarnings }).where(eq(teams.id, teamPk));
}

// --- Season points ---

export async function updateSeasonPoints(teamPk: number, delta: number): Promise<void> {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamPk));
  if (!team) return;
  const newPoints = team.seasonPoints + delta;
  await db.update(teams).set({ seasonPoints: newPoints }).where(eq(teams.id, teamPk));
}

// --- Mulligans ---

export async function incrementMulligansUsed(teamPk: number): Promise<void> {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamPk));
  if (!team) return;
  await db.update(teams).set({ mulligansUsed: team.mulligansUsed + 1 }).where(eq(teams.id, teamPk));
}

// --- Waiver claims ---

export async function getWaiverClaims(leagueId: number) {
  return db.select().from(waiverClaims)
    .where(eq(waiverClaims.leagueId, leagueId))
    .orderBy(desc(waiverClaims.faabBid), asc(waiverClaims.createdAt));
}

export async function addWaiverClaim(leagueId: number, teamId: number, addPlayerId: number, dropPlayerId: number | null, faabBid: number) {
  await db.insert(waiverClaims).values({
    leagueId,
    teamId,
    addPlayerId,
    dropPlayerId,
    faabBid,
  });
}

export async function clearWaiverClaims(leagueId: number) {
  await db.delete(waiverClaims).where(eq(waiverClaims.leagueId, leagueId));
}

// --- Activity feed ---

export async function getActivityFeed(leagueId: number) {
  return db.select().from(activityFeed)
    .where(eq(activityFeed.leagueId, leagueId))
    .orderBy(desc(activityFeed.createdAt));
}

export async function addActivityFeedEntry(leagueId: number, type: string, message: string) {
  await db.insert(activityFeed).values({ leagueId, type, message });
}

// --- Chat messages ---

export async function getChatMessages(leagueId: number) {
  return db.select().from(chatMessages)
    .where(eq(chatMessages.leagueId, leagueId))
    .orderBy(asc(chatMessages.createdAt));
}

export async function addChatMessage(leagueId: number, teamId: number, teamName: string, message: string) {
  const [msg] = await db.insert(chatMessages)
    .values({ leagueId, teamId, teamName, message })
    .returning();
  return msg;
}

// --- Ownership check (is a player on any team in this league?) ---

export async function isPlayerOwned(leagueId: number, playerId: number): Promise<boolean> {
  const teamRows = await db.select({ id: teams.id }).from(teams)
    .where(eq(teams.leagueId, leagueId));
  const teamPks = teamRows.map((t) => t.id);
  if (teamPks.length === 0) return false;

  const [row] = await db.select().from(teamRosters)
    .where(and(inArray(teamRosters.teamPk, teamPks), eq(teamRosters.playerId, playerId)));
  return !!row;
}

// --- Build ownership map for a league ---

export async function getOwnershipMap(leagueId: number): Promise<Map<number, { teamId: number; teamName: string }>> {
  const teamRows = await db.select().from(teams)
    .where(eq(teams.leagueId, leagueId));
  const teamPks = teamRows.map((t) => t.id);
  if (teamPks.length === 0) return new Map();

  const allRosterRows = await db.select().from(teamRosters)
    .where(inArray(teamRosters.teamPk, teamPks));

  const teamMap = new Map(teamRows.map((t) => [t.id, t]));
  const map = new Map<number, { teamId: number; teamName: string }>();
  for (const r of allRosterRows) {
    const t = teamMap.get(r.teamPk)!;
    map.set(r.playerId, { teamId: t.teamId, teamName: t.teamName });
  }
  return map;
}

// --- Manager queries ---

export async function getTeamByManagerAndLeague(managerId: number, leagueId: number): Promise<TeamData | null> {
  const [row] = await db.select().from(teams)
    .where(and(eq(teams.managerId, managerId), eq(teams.leagueId, leagueId)));
  if (!row) return null;

  const rosterRows = await db.select().from(teamRosters)
    .where(eq(teamRosters.teamPk, row.id));

  return {
    pk: row.id,
    teamId: row.teamId,
    teamName: row.teamName,
    managerName: row.managerName,
    managerId: row.managerId,
    roster: rosterRows.filter((r) => r.slot === "roster").map((r) => r.playerId),
    reserve: rosterRows.filter((r) => r.slot === "reserve").map((r) => r.playerId),
    mulligansUsed: row.mulligansUsed,
    seasonEarnings: row.seasonEarnings,
    seasonPoints: row.seasonPoints,
  };
}

export async function getLeaguesForManager(managerId: number): Promise<number[]> {
  const rows = await db.select({ leagueId: teams.leagueId }).from(teams)
    .where(eq(teams.managerId, managerId));
  return rows.map((r) => r.leagueId);
}

// --- Auto-copy lineups ---

export async function autoCopyLineups(leagueId: number, tournamentId: number, activeSize: number): Promise<void> {
  const league = await getLeague(leagueId);
  if (!league) return;

  for (const team of league.teams) {
    const existing = await getLineup(team.pk, tournamentId);
    if (existing.length > 0) continue;

    // Find most recent previous tournament lineup
    const allLineupRows = await db.select().from(tournamentLineups)
      .where(eq(tournamentLineups.teamPk, team.pk));

    const prevTournamentIds = [...new Set(allLineupRows.map((r) => r.tournamentId))]
      .filter((id) => id < tournamentId)
      .sort((a, b) => b - a);

    let newLineup: number[] = [];
    for (const prevId of prevTournamentIds) {
      const prevLineup = allLineupRows
        .filter((r) => r.tournamentId === prevId)
        .map((r) => r.playerId);
      if (prevLineup.length > 0) {
        newLineup = prevLineup.filter((pid) => team.roster.includes(pid));
        break;
      }
    }

    if (newLineup.length === 0) {
      newLineup = team.roster.slice(0, activeSize);
    }

    if (newLineup.length < activeSize) {
      for (const pid of team.roster) {
        if (newLineup.length >= activeSize) break;
        if (!newLineup.includes(pid)) newLineup.push(pid);
      }
    }

    await setLineup(team.pk, tournamentId, newLineup);
  }
}
