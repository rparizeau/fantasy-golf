import crypto from "crypto";
import { db } from "../index.js";
import {
  leagues, managers, users, leagueSettings, leagueScoring,
  scoringEvents, leagueTournament, drafts, tournaments,
} from "../schema/index.js";
import { eq, and, sql, gte, lte, asc } from "drizzle-orm";

// --- Invite code generation ---

export async function generateInviteCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/1/0
  for (let attempt = 0; attempt < 10; attempt++) {
    const bytes = crypto.randomBytes(8);
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i] % chars.length];
    }
    const [existing] = await db.select({ id: leagues.id })
      .from(leagues)
      .where(eq(leagues.inviteCode, code));
    if (!existing) return code;
  }
  throw new Error("Failed to generate unique invite code");
}

// --- League creation (transactional) ---

export interface CreateLeagueParams {
  userId: number;
  name: string;
  teamName?: string;
  managerCount: number;
  lineupCount: number;
  benchCount: number;
  reserveCount: number;
  scoring: { scoringEventId: number; pointsVal: number }[];
  waiverType: "reverse_standings" | "faab";
  faabBudget: number;
  tradeVetoRule: "none" | "commissioner" | "league";
  weekCount: number;
  regularSeasonPoints: number;
  majorSeasonPoints: number;
  draftScheduledAt?: Date;
}

export async function createLeague(params: CreateLeagueParams) {
  const inviteCode = await generateInviteCode();
  const rosterCount = params.lineupCount + params.benchCount;
  const roundCount = rosterCount + params.reserveCount;

  // Tournament IDs: (20 - weekCount) through 19
  const startId = 20 - params.weekCount;
  const tournamentIds: number[] = [];
  for (let i = startId; i <= 19; i++) tournamentIds.push(i);

  return db.transaction(async (tx) => {
    // 1. Create league
    const [league] = await tx.insert(leagues).values({
      createdById: params.userId,
      name: params.name,
      inviteCode,
    }).returning();

    // 2. Create league_settings
    await tx.insert(leagueSettings).values({
      leagueId: league.id,
      weekCount: params.weekCount,
      managerCount: params.managerCount,
      rosterCount,
      lineupCount: params.lineupCount,
      reserveCount: params.reserveCount,
      waiverType: params.waiverType,
      faabBudget: params.faabBudget,
      tradeVetoRule: params.tradeVetoRule,
      regularSeasonPoints: params.regularSeasonPoints,
      majorSeasonPoints: params.majorSeasonPoints,
    });

    // 3. Create league_scoring rows
    if (params.scoring.length > 0) {
      await tx.insert(leagueScoring).values(
        params.scoring.map((s) => ({
          leagueId: league.id,
          scoringEventId: s.scoringEventId,
          pointsVal: s.pointsVal,
          isActive: true,
        }))
      );
    }

    // 4. Create league_tournament rows
    if (tournamentIds.length > 0) {
      await tx.insert(leagueTournament).values(
        tournamentIds.map((tid, idx) => ({
          leagueId: league.id,
          tournamentId: tid,
          weekNumber: idx + 1,
          orderNumber: idx + 1,
        }))
      );
    }

    // 5. Create commissioner manager
    const [manager] = await tx.insert(managers).values({
      userId: params.userId,
      leagueId: league.id,
      teamName: params.teamName || null,
      isCommissioner: true,
    }).returning();

    // 6. Create draft record
    await tx.insert(drafts).values({
      leagueId: league.id,
      roundCount,
      scheduledAt: params.draftScheduledAt ?? null,
    });

    return { leagueId: league.id, inviteCode, managerId: manager.id };
  });
}

// --- Invite code lookup ---

export async function getLeagueByInviteCode(code: string) {
  const [league] = await db
    .select({
      id: leagues.id,
      name: leagues.name,
      createdById: leagues.createdById,
    })
    .from(leagues)
    .where(eq(leagues.inviteCode, code.toUpperCase()));

  if (!league) return null;

  const [creator] = await db.select({ name: users.name }).from(users)
    .where(eq(users.id, league.createdById));

  const [settings] = await db.select({ managerCount: leagueSettings.managerCount })
    .from(leagueSettings)
    .where(eq(leagueSettings.leagueId, league.id));

  const memberRows = await db.select({ id: managers.id }).from(managers)
    .where(eq(managers.leagueId, league.id));

  return {
    id: league.id,
    name: league.name,
    members: memberRows.length,
    maxMembers: settings?.managerCount ?? 10,
    creatorName: creator?.name ?? "Unknown",
  };
}

// --- Join league ---

export async function joinLeague(userId: number, inviteCode: string, teamName?: string) {
  const preview = await getLeagueByInviteCode(inviteCode);
  if (!preview) throw new Error("Invalid invite code");
  if (preview.members >= preview.maxMembers) throw new Error("League is full");

  // Check not already in league
  const [existing] = await db.select({ id: managers.id }).from(managers)
    .where(and(eq(managers.userId, userId), eq(managers.leagueId, preview.id)));
  if (existing) throw new Error("Already in this league");

  // Check draft not started
  const [draft] = await db.select({ status: drafts.statusEnum }).from(drafts)
    .where(eq(drafts.leagueId, preview.id));
  if (draft && draft.status !== "pending") throw new Error("Draft has already started");

  const [manager] = await db.insert(managers).values({
    userId,
    leagueId: preview.id,
    teamName: teamName || null,
  }).returning();

  return { leagueId: preview.id, managerId: manager.id };
}

// --- Scoring event defaults ---

export async function getScoringEventDefaults() {
  return db.select({
    id: scoringEvents.id,
    key: scoringEvents.key,
    label: scoringEvents.label,
    defaultPoints: scoringEvents.defaultPoints,
    sortOrder: scoringEvents.sortOrder,
  })
  .from(scoringEvents)
  .orderBy(asc(scoringEvents.sortOrder));
}

// --- Tournament schedule preview ---

export async function getSchedulePreview(weekCount: number) {
  const startId = 20 - weekCount;
  return db.select({
    id: tournaments.id,
    name: tournaments.name,
    isMajor: tournaments.isMajor,
    startDate: tournaments.startDate,
  })
  .from(tournaments)
  .where(and(gte(tournaments.id, startId), lte(tournaments.id, 19)))
  .orderBy(asc(tournaments.id));
}
