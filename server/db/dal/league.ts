import { db } from "../index.js";
import {
  leagues, managers, users, leagueSettings, leagueScores,
  managerRosters, rosters, golferRoster, tournamentRosters,
  waivers, activities, messages, golfers,
} from "../schema/index.js";
import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";
import type { ScoringSettings } from "../../sim/engine.js";
import { getSeasonPoints } from "./points.js";

// --- Types matching existing API shapes ---

export interface TeamData {
  pk: number;            // manager.id (serves as PK)
  teamId: number;        // same as manager.id (no separate teamId in V2)
  teamName: string;      // user.name (manager display name)
  managerName: string;   // user.name
  managerId: number;     // user.id (the users table PK)
  roster: number[];      // golfer IDs with status='active'
  reserve: number[];     // golfer IDs with status='bench'
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

// --- Polymorphic roster helpers ---

/** Get or create the manager_roster for a manager, return the roster table ID. */
async function getOrCreateManagerRoster(managerId: number): Promise<{ managerRosterId: number; rosterId: number }> {
  // Check if manager_roster exists
  const [mr] = await db.select().from(managerRosters)
    .where(eq(managerRosters.managerId, managerId));

  let managerRosterId: number;
  if (mr) {
    managerRosterId = mr.id;
  } else {
    const [inserted] = await db.insert(managerRosters).values({ managerId }).returning();
    managerRosterId = inserted.id;
  }

  // Check if rosters row exists for this manager_roster
  const [rosterRow] = await db.select().from(rosters)
    .where(and(
      eq(rosters.rosterableId, managerRosterId),
      eq(rosters.rosterableType, "manager_roster"),
    ));

  let rosterId: number;
  if (rosterRow) {
    rosterId = rosterRow.id;
  } else {
    const [inserted] = await db.insert(rosters).values({
      rosterableId: managerRosterId,
      rosterableType: "manager_roster",
    }).returning();
    rosterId = inserted.id;
  }

  return { managerRosterId, rosterId };
}

/** Get golfers on a manager's roster (through polymorphic chain). */
async function getManagerRosterGolfers(managerId: number): Promise<{ active: number[]; bench: number[] }> {
  const [mr] = await db.select().from(managerRosters)
    .where(eq(managerRosters.managerId, managerId));
  if (!mr) return { active: [], bench: [] };

  const [rosterRow] = await db.select().from(rosters)
    .where(and(
      eq(rosters.rosterableId, mr.id),
      eq(rosters.rosterableType, "manager_roster"),
    ));
  if (!rosterRow) return { active: [], bench: [] };

  const grRows = await db.select().from(golferRoster)
    .where(eq(golferRoster.rosterId, rosterRow.id));

  return {
    active: grRows.filter((r) => r.statusEnum === "active").map((r) => r.golferId),
    bench: grRows.filter((r) => r.statusEnum === "bench").map((r) => r.golferId),
  };
}

/** Build scoring settings from league_scores row. Values in DB are pennies (÷100 for display). */
function buildScoringSettings(scores: typeof leagueScores.$inferSelect): ScoringSettings {
  return {
    albatross: scores.albatrossVal / 100,
    eagle: scores.eagleVal / 100,
    birdie: scores.birdieVal / 100,
    par: scores.parVal / 100,
    bogey: scores.bogeyVal / 100,
    doubleBogey: scores.doubleVal / 100,
    triplePlus: scores.tripleVal / 100,
  };
}

// --- League queries ---

export async function getLeague(leagueId: number): Promise<LeagueData | null> {
  const [league] = await db.select().from(leagues).where(eq(leagues.id, leagueId));
  if (!league) return null;

  const [settings] = await db.select().from(leagueSettings).where(eq(leagueSettings.leagueId, leagueId));
  const [scores] = await db.select().from(leagueScores).where(eq(leagueScores.leagueId, leagueId));

  const managerRows = await db
    .select({
      managerId: managers.id,
      userId: managers.userId,
      userName: users.name,
      isCommissioner: managers.isCommissioner,
    })
    .from(managers)
    .innerJoin(users, eq(managers.userId, users.id))
    .where(eq(managers.leagueId, leagueId))
    .orderBy(managers.id);

  const teamDataList: TeamData[] = [];
  for (const m of managerRows) {
    const rosterData = await getManagerRosterGolfers(m.managerId);
    const seasonPts = await getSeasonPoints(m.managerId);
    teamDataList.push({
      pk: m.managerId,
      teamId: m.managerId,
      teamName: m.userName,
      managerName: m.userName,
      managerId: m.userId,
      roster: rosterData.active,
      reserve: rosterData.bench,
      mulligansUsed: 0,
      seasonEarnings: 0,
      seasonPoints: seasonPts,
    });
  }

  const scoring = scores ? buildScoringSettings(scores) : {
    albatross: 8, eagle: 5, birdie: 3, par: 1, bogey: -1, doubleBogey: -2, triplePlus: -3,
  };

  return {
    id: league.id,
    name: league.name,
    settings: {
      rosterSize: settings?.rosterCount ?? 8,
      activeSize: settings?.lineupCount ?? 5,
      reserveSize: settings?.reserveCount ?? 3,
      mulligansPerSeason: 0,
      scoringSettings: scoring,
      showMoney: false,
    },
    teams: teamDataList,
  };
}

export async function getAllLeagues(): Promise<LeagueData[]> {
  const leagueRows = await db.select().from(leagues).orderBy(leagues.id);
  const results: LeagueData[] = [];
  for (const league of leagueRows) {
    const data = await getLeague(league.id);
    if (data) results.push(data);
  }
  return results;
}

// --- Team queries ---

/** In V2, managerId IS the pk. teamId param is the manager.id. */
export async function getTeamPk(leagueId: number, teamId: number): Promise<number | null> {
  const [row] = await db.select({ id: managers.id }).from(managers)
    .where(and(eq(managers.leagueId, leagueId), eq(managers.id, teamId)));
  return row?.id ?? null;
}

// --- Lineup queries (tournament_rosters → rosters → golfer_roster) ---

async function getOrCreateTournamentRoster(managerId: number, leagueTournamentId: number): Promise<{ tournamentRosterId: number; rosterId: number }> {
  const [tr] = await db.select().from(tournamentRosters)
    .where(and(
      eq(tournamentRosters.managerId, managerId),
      eq(tournamentRosters.leagueTournamentId, leagueTournamentId),
    ));

  let tournamentRosterId: number;
  if (tr) {
    tournamentRosterId = tr.id;
  } else {
    const [inserted] = await db.insert(tournamentRosters).values({
      managerId,
      leagueTournamentId,
    }).returning();
    tournamentRosterId = inserted.id;
  }

  const [rosterRow] = await db.select().from(rosters)
    .where(and(
      eq(rosters.rosterableId, tournamentRosterId),
      eq(rosters.rosterableType, "tournament_roster"),
    ));

  let rosterId: number;
  if (rosterRow) {
    rosterId = rosterRow.id;
  } else {
    const [inserted] = await db.insert(rosters).values({
      rosterableId: tournamentRosterId,
      rosterableType: "tournament_roster",
    }).returning();
    rosterId = inserted.id;
  }

  return { tournamentRosterId, rosterId };
}

/**
 * Get lineup (golfer IDs) for a manager in a tournament.
 * `teamPk` is the manager.id. `tournamentId` is the sim tournament ID.
 * We need to resolve tournament ID → league_tournament ID to query tournament_rosters.
 */
export async function getLineup(teamPk: number, tournamentId: number): Promise<number[]> {
  // Find all league_tournament rows for this tournament
  const { leagueTournament } = await import("../schema/index.js");
  const ltRows = await db.select().from(leagueTournament)
    .where(eq(leagueTournament.tournamentId, tournamentId));

  for (const lt of ltRows) {
    const [tr] = await db.select().from(tournamentRosters)
      .where(and(
        eq(tournamentRosters.managerId, teamPk),
        eq(tournamentRosters.leagueTournamentId, lt.id),
      ));
    if (!tr) continue;

    const [rosterRow] = await db.select().from(rosters)
      .where(and(
        eq(rosters.rosterableId, tr.id),
        eq(rosters.rosterableType, "tournament_roster"),
      ));
    if (!rosterRow) continue;

    const grRows = await db.select().from(golferRoster)
      .where(eq(golferRoster.rosterId, rosterRow.id));
    return grRows.map((r) => r.golferId);
  }

  return [];
}

export async function getLineupsForTeams(teamPks: number[], tournamentId: number): Promise<Map<number, number[]>> {
  if (teamPks.length === 0) return new Map();

  const { leagueTournament } = await import("../schema/index.js");
  const ltRows = await db.select().from(leagueTournament)
    .where(eq(leagueTournament.tournamentId, tournamentId));
  const ltIds = ltRows.map((r) => r.id);
  if (ltIds.length === 0) return new Map();

  // Get all tournament_rosters for these managers and league_tournament IDs
  const trRows = await db.select().from(tournamentRosters)
    .where(and(
      inArray(tournamentRosters.managerId, teamPks),
      inArray(tournamentRosters.leagueTournamentId, ltIds),
    ));
  if (trRows.length === 0) return new Map();

  const trIds = trRows.map((r) => r.id);
  const rosterRows = await db.select().from(rosters)
    .where(and(
      inArray(rosters.rosterableId, trIds),
      eq(rosters.rosterableType, "tournament_roster"),
    ));
  if (rosterRows.length === 0) return new Map();

  const rosterIds = rosterRows.map((r) => r.id);
  const grRows = await db.select().from(golferRoster)
    .where(inArray(golferRoster.rosterId, rosterIds));

  // Build reverse mapping: roster.id → tournament_roster.id → manager.id
  const rosterToTr = new Map(rosterRows.map((r) => [r.id, r.rosterableId]));
  const trToManager = new Map(trRows.map((r) => [r.id, r.managerId]));

  const map = new Map<number, number[]>();
  for (const gr of grRows) {
    const trId = rosterToTr.get(gr.rosterId);
    if (trId == null) continue;
    const managerId = trToManager.get(trId);
    if (managerId == null) continue;
    const arr = map.get(managerId) ?? [];
    arr.push(gr.golferId);
    map.set(managerId, arr);
  }

  return map;
}

export async function setLineup(teamPk: number, tournamentId: number, golferIds: number[]): Promise<void> {
  // Find the league_tournament for this manager's league + tournament
  const [manager] = await db.select().from(managers).where(eq(managers.id, teamPk));
  if (!manager) return;

  const { leagueTournament } = await import("../schema/index.js");
  const [lt] = await db.select().from(leagueTournament)
    .where(and(
      eq(leagueTournament.leagueId, manager.leagueId),
      eq(leagueTournament.tournamentId, tournamentId),
    ));
  if (!lt) return;

  const { rosterId } = await getOrCreateTournamentRoster(teamPk, lt.id);

  await db.transaction(async (tx) => {
    // Delete existing golfer_roster entries
    await tx.delete(golferRoster).where(eq(golferRoster.rosterId, rosterId));
    // Insert new ones
    if (golferIds.length > 0) {
      await tx.insert(golferRoster).values(
        golferIds.map((gid) => ({ golferId: gid, rosterId, statusEnum: "active" as const }))
      );
    }
  });
}

// --- Roster mutations ---

export async function addToRoster(teamPk: number, golferId: number, slot: "active" | "bench" = "active"): Promise<void> {
  const { rosterId } = await getOrCreateManagerRoster(teamPk);
  await db.insert(golferRoster).values({ golferId, rosterId, statusEnum: slot });
}

export async function removeFromRoster(teamPk: number, golferId: number): Promise<void> {
  const [mr] = await db.select().from(managerRosters).where(eq(managerRosters.managerId, teamPk));
  if (!mr) return;
  const [rosterRow] = await db.select().from(rosters)
    .where(and(eq(rosters.rosterableId, mr.id), eq(rosters.rosterableType, "manager_roster")));
  if (!rosterRow) return;

  await db.delete(golferRoster).where(and(
    eq(golferRoster.rosterId, rosterRow.id),
    eq(golferRoster.golferId, golferId),
  ));
}

export async function swapRosterPlayer(teamPk: number, dropGolferId: number, addGolferId: number): Promise<void> {
  const [mr] = await db.select().from(managerRosters).where(eq(managerRosters.managerId, teamPk));
  if (!mr) return;
  const [rosterRow] = await db.select().from(rosters)
    .where(and(eq(rosters.rosterableId, mr.id), eq(rosters.rosterableType, "manager_roster")));
  if (!rosterRow) return;

  await db.transaction(async (tx) => {
    const [dropped] = await tx.select().from(golferRoster)
      .where(and(eq(golferRoster.rosterId, rosterRow.id), eq(golferRoster.golferId, dropGolferId)));
    const slot = dropped?.statusEnum ?? "active";

    await tx.delete(golferRoster).where(and(
      eq(golferRoster.rosterId, rosterRow.id),
      eq(golferRoster.golferId, dropGolferId),
    ));
    await tx.insert(golferRoster).values({ golferId: addGolferId, rosterId: rosterRow.id, statusEnum: slot });
  });
}

export async function getRosterCount(teamPk: number): Promise<number> {
  const [mr] = await db.select().from(managerRosters).where(eq(managerRosters.managerId, teamPk));
  if (!mr) return 0;
  const [rosterRow] = await db.select().from(rosters)
    .where(and(eq(rosters.rosterableId, mr.id), eq(rosters.rosterableType, "manager_roster")));
  if (!rosterRow) return 0;

  const rows = await db.select().from(golferRoster)
    .where(and(eq(golferRoster.rosterId, rosterRow.id), eq(golferRoster.statusEnum, "active")));
  return rows.length;
}

// --- Waiver claims ---

export async function getWaiverClaims(leagueId: number) {
  return db.select().from(waivers)
    .where(and(eq(waivers.leagueId, leagueId), eq(waivers.statusEnum, "pending")))
    .orderBy(asc(waivers.createdAt));
}

export async function addWaiverClaim(leagueId: number, managerId: number, addGolferId: number, dropGolferId: number | null, _faabBid: number) {
  await db.insert(waivers).values({
    leagueId,
    managerId,
    addGolferId,
    dropGolferId,
    statusEnum: "pending",
  });
}

export async function clearWaiverClaims(leagueId: number) {
  await db.update(waivers)
    .set({ statusEnum: "approved", resolvedAt: new Date() })
    .where(and(eq(waivers.leagueId, leagueId), eq(waivers.statusEnum, "pending")));
}

// --- Activity feed ---

export async function getActivityFeed(leagueId: number) {
  return db.select().from(activities)
    .where(eq(activities.leagueId, leagueId))
    .orderBy(desc(activities.createdAt));
}

export async function addActivityFeedEntry(leagueId: number, type: string, message: string) {
  await db.insert(activities).values({ leagueId, type, message });
}

// --- Chat messages ---

export async function getChatMessages(leagueId: number) {
  const rows = await db
    .select({
      id: messages.id,
      managerId: messages.managerId,
      content: messages.content,
      createdAt: messages.createdAt,
      managerName: users.name,
    })
    .from(messages)
    .innerJoin(managers, eq(messages.managerId, managers.id))
    .innerJoin(users, eq(managers.userId, users.id))
    .where(eq(messages.leagueId, leagueId))
    .orderBy(asc(messages.createdAt));

  return rows.map((m) => ({
    id: m.id,
    teamId: m.managerId,
    teamName: m.managerName,
    message: m.content,
    createdAt: m.createdAt,
  }));
}

export async function addChatMessage(leagueId: number, managerId: number, _teamName: string, message: string) {
  const [msg] = await db.insert(messages)
    .values({ leagueId, managerId, content: message })
    .returning();

  // Fetch the manager's user name
  const [manager] = await db.select({ userName: users.name })
    .from(managers)
    .innerJoin(users, eq(managers.userId, users.id))
    .where(eq(managers.id, managerId));

  return {
    id: msg.id,
    teamId: managerId,
    teamName: manager?.userName ?? "Unknown",
    message: msg.content,
    createdAt: msg.createdAt,
  };
}

// --- Ownership check (is a golfer on any team in this league?) ---

export async function isPlayerOwned(leagueId: number, golferId: number): Promise<boolean> {
  const managerRows = await db.select({ id: managers.id }).from(managers)
    .where(eq(managers.leagueId, leagueId));
  if (managerRows.length === 0) return false;

  const managerIds = managerRows.map((m) => m.id);
  const mrRows = await db.select().from(managerRosters)
    .where(inArray(managerRosters.managerId, managerIds));
  if (mrRows.length === 0) return false;

  const mrIds = mrRows.map((r) => r.id);
  const rosterRows = await db.select().from(rosters)
    .where(and(
      inArray(rosters.rosterableId, mrIds),
      eq(rosters.rosterableType, "manager_roster"),
    ));
  if (rosterRows.length === 0) return false;

  const rosterIds = rosterRows.map((r) => r.id);
  const [row] = await db.select().from(golferRoster)
    .where(and(
      inArray(golferRoster.rosterId, rosterIds),
      eq(golferRoster.golferId, golferId),
    ));

  return !!row;
}

// --- Build ownership map for a league ---

export async function getOwnershipMap(leagueId: number): Promise<Map<number, { teamId: number; teamName: string }>> {
  const managerRows = await db
    .select({ managerId: managers.id, userName: users.name })
    .from(managers)
    .innerJoin(users, eq(managers.userId, users.id))
    .where(eq(managers.leagueId, leagueId));
  if (managerRows.length === 0) return new Map();

  const managerIds = managerRows.map((m) => m.managerId);
  const mrRows = await db.select().from(managerRosters)
    .where(inArray(managerRosters.managerId, managerIds));
  if (mrRows.length === 0) return new Map();

  const mrIds = mrRows.map((r) => r.id);
  const rosterRows = await db.select().from(rosters)
    .where(and(
      inArray(rosters.rosterableId, mrIds),
      eq(rosters.rosterableType, "manager_roster"),
    ));
  if (rosterRows.length === 0) return new Map();

  const rosterIds = rosterRows.map((r) => r.id);
  const grRows = await db.select().from(golferRoster)
    .where(inArray(golferRoster.rosterId, rosterIds));

  // Build reverse lookup: roster.id → managerRoster.managerId
  const rosterToMr = new Map(rosterRows.map((r) => [r.id, r.rosterableId]));
  const mrToManager = new Map(mrRows.map((r) => [r.id, r.managerId]));
  const managerMap = new Map(managerRows.map((m) => [m.managerId, m.userName]));

  const map = new Map<number, { teamId: number; teamName: string }>();
  for (const gr of grRows) {
    const mrId = rosterToMr.get(gr.rosterId);
    if (mrId == null) continue;
    const managerId = mrToManager.get(mrId);
    if (managerId == null) continue;
    const name = managerMap.get(managerId) ?? "Unknown";
    map.set(gr.golferId, { teamId: managerId, teamName: name });
  }
  return map;
}

// --- Manager queries ---

export async function getTeamByManagerAndLeague(userId: number, leagueId: number): Promise<TeamData | null> {
  // userId here is the users.id, find the manager row
  const [manager] = await db
    .select({ managerId: managers.id, userName: users.name, userId: users.id })
    .from(managers)
    .innerJoin(users, eq(managers.userId, users.id))
    .where(and(eq(managers.userId, userId), eq(managers.leagueId, leagueId)));
  if (!manager) return null;

  const rosterData = await getManagerRosterGolfers(manager.managerId);
  const seasonPts = await getSeasonPoints(manager.managerId);

  return {
    pk: manager.managerId,
    teamId: manager.managerId,
    teamName: manager.userName,
    managerName: manager.userName,
    managerId: manager.userId,
    roster: rosterData.active,
    reserve: rosterData.bench,
    mulligansUsed: 0,
    seasonEarnings: 0,
    seasonPoints: seasonPts,
  };
}

export async function getLeaguesForManager(userId: number): Promise<number[]> {
  const rows = await db.select({ leagueId: managers.leagueId }).from(managers)
    .innerJoin(users, eq(managers.userId, users.id))
    .where(eq(users.id, userId));
  return rows.map((r) => r.leagueId);
}

// --- Auto-copy lineups ---

export async function autoCopyLineups(leagueId: number, tournamentId: number, activeSize: number): Promise<void> {
  const league = await getLeague(leagueId);
  if (!league) return;

  for (const team of league.teams) {
    const existing = await getLineup(team.pk, tournamentId);
    if (existing.length > 0) continue;

    // Default: use first `activeSize` roster players
    const newLineup = team.roster.slice(0, activeSize);
    if (newLineup.length > 0) {
      await setLineup(team.pk, tournamentId, newLineup);
    }
  }
}
