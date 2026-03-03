/**
 * Dev/test data seed — creates fake leagues, users, rosters, and sim state.
 * Run AFTER the reference seed (db:seed).
 *
 * Bobby's user is seeded with his real email so Supabase auth links automatically.
 */
import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const STATE_DIR = join(__dirname, "..", "state");

function loadJSON<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8"));
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

// ─── Real emails for dev users ──────────────────────────────
// Map manager display name → real email (for Supabase auth linking).
// Everyone else gets a fake @example.com address.
const REAL_EMAILS: Record<string, string> = {
  Bobby: "bobbyparizeau@gmail.com",
};

function emailFor(name: string): string {
  return REAL_EMAILS[name] ?? `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`;
}

async function seedDev() {
  console.log("🧪 Seeding dev/test data...");

  // ─── Clear test data (keep reference data) ────────────────
  await db.delete(schema.managerPoints);
  await db.delete(schema.simPlayers);
  await db.delete(schema.simTournaments);
  await db.delete(schema.simActive);
  await db.delete(schema.messages);
  await db.delete(schema.activities);
  await db.delete(schema.waivers);
  await db.delete(schema.golferTrade);
  await db.delete(schema.trades);
  await db.delete(schema.draftPicks);
  await db.delete(schema.drafts);
  await db.delete(schema.golferRoster);
  await db.delete(schema.rosters);
  await db.delete(schema.tournamentRosters);
  await db.delete(schema.managerRosters);
  await db.delete(schema.draftRosters);
  await db.delete(schema.leagueTournament);
  await db.delete(schema.leagueScores);
  await db.delete(schema.leagueSettings);
  await db.delete(schema.managers);
  await db.delete(schema.leagues);
  await db.delete(schema.users);
  console.log("  Cleared test data tables");

  // ─── Load league state from JSON ──────────────────────────
  const leagueState = loadJSON<{
    leagues: Record<string, {
      id: number; name: string;
      settings: { rosterSize: number; activeSize: number; reserveSize: number; mulligansPerSeason: number };
      teams: {
        teamId: number; teamName: string; managerName: string;
        roster: number[]; reserve: number[];
        tournamentLineups: Record<string, number[]>;
        mulligansUsed: number; seasonEarnings: number;
      }[];
      waiverClaims: { id: string; teamId: number; addPlayerId: number; dropPlayerId?: number | null; faabBid: number; timestamp: string }[];
      activityFeed: { id: string; type: string; message: string; timestamp: string }[];
      chatMessages: { id: string; teamId: number; teamName: string; message: string; timestamp: string }[];
    }>;
  }>(join(STATE_DIR, "league-state.json"));

  const tournamentsRaw = loadJSON<{ id: number; name: string }[]>(join(DATA_DIR, "tournaments.json"));

  // ─── 1. Users ─────────────────────────────────────────────
  const uniqueNames = new Set<string>();
  for (const league of Object.values(leagueState.leagues)) {
    if (typeof league !== "object" || !league.teams) continue;
    for (const team of league.teams) uniqueNames.add(team.managerName);
  }

  const userMap = new Map<string, number>();
  for (const name of uniqueNames) {
    const [user] = await db.insert(schema.users).values({
      supabaseUserId: `seed-${name.toLowerCase().replace(/\s+/g, "-")}`,
      email: emailFor(name),
      name,
    }).returning();
    userMap.set(name, user.id);
  }
  console.log(`  ✓ users: ${userMap.size}`);

  // ─── 2. Leagues ───────────────────────────────────────────
  for (const league of Object.values(leagueState.leagues)) {
    if (typeof league !== "object" || !league.teams) continue;
    const creatorId = userMap.get(league.teams[0].managerName)!;
    await db.insert(schema.leagues).values({ id: league.id, createdById: creatorId, name: league.name });
  }
  console.log(`  ✓ leagues`);

  // ─── 3. League settings + scores ──────────────────────────
  for (const league of Object.values(leagueState.leagues)) {
    if (typeof league !== "object" || !league.settings) continue;
    await db.insert(schema.leagueSettings).values({
      leagueId: league.id,
      weekCount: 19,
      managerCount: league.teams.length,
      rosterCount: league.settings.rosterSize,
      lineupCount: league.settings.activeSize,
      reserveCount: league.settings.reserveSize,
    });
    await db.insert(schema.leagueScores).values({
      leagueId: league.id,
      albatrossVal: 800, eagleVal: 500, birdieVal: 300, parVal: 100,
      bogeyVal: -100, doubleVal: -200, tripleVal: -300,
    });
  }
  console.log(`  ✓ league_settings + league_scores`);

  // ─── 4. Managers ──────────────────────────────────────────
  const managerIdMap = new Map<string, number>();
  for (const league of Object.values(leagueState.leagues)) {
    if (typeof league !== "object" || !league.teams) continue;
    for (const team of league.teams) {
      const userId = userMap.get(team.managerName)!;
      const [manager] = await db.insert(schema.managers).values({
        userId, leagueId: league.id, teamName: team.teamName, isCommissioner: team.teamId === 1,
      }).returning();
      managerIdMap.set(`${league.id}-${team.teamId}`, manager.id);
    }
  }
  console.log(`  ✓ managers: ${managerIdMap.size}`);

  // ─── 5. Manager rosters (polymorphic) ─────────────────────
  let golferLinkCount = 0;
  for (const league of Object.values(leagueState.leagues)) {
    if (typeof league !== "object" || !league.teams) continue;
    const rosterSize = league.settings.rosterSize; // e.g. 12

    // Track which golfer IDs are taken in this league
    const takenInLeague = new Set<number>();
    for (const team of league.teams) {
      for (const gid of team.roster) takenInLeague.add(gid);
      for (const gid of team.reserve || []) takenInLeague.add(gid);
    }

    // Pool of available golfer IDs (1-100) for filling rosters
    const available = Array.from({ length: 100 }, (_, i) => i + 1).filter((id) => !takenInLeague.has(id));
    let availIdx = 0;

    for (const team of league.teams) {
      const managerId = managerIdMap.get(`${league.id}-${team.teamId}`)!;
      const [mr] = await db.insert(schema.managerRosters).values({ managerId }).returning();
      const [roster] = await db.insert(schema.rosters).values({
        rosterableId: mr.id, rosterableType: "manager_roster",
      }).returning();

      // Pad roster to rosterSize with available golfers
      const fullRoster = [...team.roster];
      while (fullRoster.length < rosterSize && availIdx < available.length) {
        fullRoster.push(available[availIdx++]);
      }

      const entries = [
        ...fullRoster.map((gid) => ({ golferId: gid, rosterId: roster.id, statusEnum: "active" as const })),
        ...(team.reserve || []).map((gid) => ({ golferId: gid, rosterId: roster.id, statusEnum: "bench" as const })),
      ];
      if (entries.length > 0) {
        await db.insert(schema.golferRoster).values(entries);
        golferLinkCount += entries.length;
      }
    }
  }
  console.log(`  ✓ manager rosters: ${golferLinkCount} golfer links`);

  // ─── 6. League tournaments ────────────────────────────────
  const ltIdMap = new Map<string, number>();
  for (const league of Object.values(leagueState.leagues)) {
    if (typeof league !== "object" || !league.teams) continue;
    for (let i = 0; i < tournamentsRaw.length; i++) {
      const t = tournamentsRaw[i];
      const [lt] = await db.insert(schema.leagueTournament).values({
        leagueId: league.id, tournamentId: t.id, weekNumber: i + 1, orderNumber: i + 1,
      }).returning();
      ltIdMap.set(`${league.id}-${t.id}`, lt.id);
    }
  }
  console.log(`  ✓ league_tournament: ${ltIdMap.size}`);

  // ─── 7. Tournament rosters (lineups) ──────────────────────
  let trCount = 0;
  for (const league of Object.values(leagueState.leagues)) {
    if (typeof league !== "object" || !league.teams) continue;
    for (const team of league.teams) {
      const managerId = managerIdMap.get(`${league.id}-${team.teamId}`)!;
      for (const [tid, golferIds] of Object.entries(team.tournamentLineups)) {
        const ltId = ltIdMap.get(`${league.id}-${Number(tid)}`);
        if (!ltId) continue;
        const [tr] = await db.insert(schema.tournamentRosters).values({
          leagueTournamentId: ltId, managerId,
        }).returning();
        const [roster] = await db.insert(schema.rosters).values({
          rosterableId: tr.id, rosterableType: "tournament_roster",
        }).returning();
        if (golferIds.length > 0) {
          await db.insert(schema.golferRoster).values(
            golferIds.map((gid) => ({ golferId: gid, rosterId: roster.id, statusEnum: "active" as const }))
          );
        }
        trCount++;
      }
    }
  }
  console.log(`  ✓ tournament rosters: ${trCount}`);

  // ─── 8. Activities + Messages ─────────────────────────────
  for (const league of Object.values(leagueState.leagues)) {
    if (typeof league !== "object") continue;
    if (league.activityFeed?.length > 0) {
      await db.insert(schema.activities).values(
        league.activityFeed.map((af) => ({
          leagueId: league.id, type: af.type, message: af.message, createdAt: new Date(af.timestamp),
        }))
      );
    }
    for (const cm of league.chatMessages || []) {
      const managerId = managerIdMap.get(`${league.id}-${cm.teamId}`);
      if (!managerId) continue;
      await db.insert(schema.messages).values({
        leagueId: league.id, managerId, content: cm.message, createdAt: new Date(cm.timestamp),
      });
    }
  }
  console.log(`  ✓ activities + messages`);

  // ─── 9. Sim state ─────────────────────────────────────────
  const simActiveData = loadJSON<{ activeTournamentId: number }>(join(STATE_DIR, "sim-active.json"));
  await db.insert(schema.simActive).values({ id: 1, activeTournamentId: simActiveData.activeTournamentId });

  let simTCount = 0, simPCount = 0;
  for (let tid = 1; tid <= 19; tid++) {
    const path = join(STATE_DIR, `sim-tournament-${tid}.json`);
    if (!existsSync(path)) continue;
    const state = loadJSON<{
      phase: string; tournamentId: number; currentRound: number;
      par: number; holePars?: number[]; cutLine: number | null;
      fieldSize: number; overrides: Record<string, unknown>;
      earningsAccumulated?: boolean; pointsAccumulated?: boolean;
      players: {
        playerId: number; name: string; country: string; ranking: number;
        rounds: number[]; holeScores?: (number | null)[][];
        total: number; toPar: number; position: number; status: "active" | "cut" | "wd";
      }[];
    }>(path);

    await db.insert(schema.simTournaments).values({
      tournamentId: state.tournamentId,
      phase: state.phase as "idle" | "round1" | "round2" | "cut" | "round3" | "round4" | "final",
      currentRound: state.currentRound, par: state.par,
      holePars: state.holePars ?? null, cutLine: state.cutLine ?? null,
      fieldSize: state.fieldSize,
      overrides: state.overrides as Record<number, { score?: number; wd?: boolean }>,
      isEarningsAccumulated: state.earningsAccumulated ?? false,
      isPointsAccumulated: state.pointsAccumulated ?? false,
    });
    simTCount++;

    const rows = state.players.map((p) => ({
      tournamentId: state.tournamentId, golferId: p.playerId, name: p.name,
      origin: p.country, ranking: p.ranking, rounds: p.rounds,
      holeScores: p.holeScores ?? null, total: p.total, toPar: p.toPar,
      position: p.position, statusEnum: p.status as "active" | "cut" | "wd",
    }));
    for (let i = 0; i < rows.length; i += 50) {
      await db.insert(schema.simPlayers).values(rows.slice(i, i + 50));
    }
    simPCount += rows.length;
  }
  console.log(`  ✓ sim: ${simTCount} tournaments, ${simPCount} players`);

  console.log("\n✅ Dev data seeded.");
  await client.end();
}

seedDev().catch((err) => {
  console.error("Dev seed failed:", err);
  process.exit(1);
});
