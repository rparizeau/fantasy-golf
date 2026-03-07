/**
 * Dev/test data seed — creates leagues, users, rosters, and sim state.
 * Run AFTER the reference seed (db:seed).
 *
 * Bobby's user is seeded with his real email so Supabase auth links automatically.
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");

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
const REAL_EMAILS: Record<string, string> = {
  Bobby: "bobbyparizeau@gmail.com",
};

function emailFor(name: string): string {
  return REAL_EMAILS[name] ?? `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`;
}

// ─── League definitions ─────────────────────────────────────

const LEAGUES = [
  {
    name: "The Dirty Dozen",
    rosterCount: 6, lineupCount: 2, reserveCount: 0,
    teams: [
      { manager: "Bobby", teamName: "Grip It & Rip It", colors: ["#0F172A", "#F59E0B"] },
      { manager: "Jess", teamName: "Tee It High", colors: ["#7C3AED", "#E0E7FF"] },
      { manager: "Dan", teamName: "The Shankers", colors: ["#DC2626", "#FECACA"] },
      { manager: "Kate", teamName: "Putter Butter", colors: ["#059669", "#D1FAE5"] },
      { manager: "Nick", teamName: "Fade City", colors: ["#2563EB", "#DBEAFE"] },
      { manager: "Matt", teamName: "The Yips", colors: ["#B91C1C", "#FEE2E2"] },
      { manager: "Amy", teamName: "Albatross Alley", colors: ["#9333EA", "#F3E8FF"] },
      { manager: "Ben", teamName: "Lag Putts", colors: ["#15803D", "#DCFCE7"] },
      { manager: "Zoe", teamName: "Stinger Squad", colors: ["#EA580C", "#FED7AA"] },
      { manager: "Tyler", teamName: "The Draws", colors: ["#CA8A04", "#FEF9C3"] },
      { manager: "Hailey", teamName: "Bogey Free", colors: ["#6D28D9", "#EDE9FE"] },
      { manager: "Josh", teamName: "Dormie Club", colors: ["#0891B2", "#CFFAFE"] },
    ],
  },
];

/** Shuffle array in place (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Simulate a snake draft to distribute golfers across teams.
 * Golfers are ranked 1-100; teams pick in snake order (1→N, N→1, 1→N, …).
 * Draft order is randomized. Each team picks up to `rosterCount` golfers.
 */
function snakeDraft(teamCount: number, rosterCount: number): number[][] {
  const draftOrder = shuffle(Array.from({ length: teamCount }, (_, i) => i));
  const rosters: number[][] = Array.from({ length: teamCount }, () => []);
  const totalPicks = Math.min(teamCount * rosterCount, 100);
  let pick = 0;
  let round = 0;

  while (pick < totalPicks) {
    const forward = round % 2 === 0;
    const order = forward ? draftOrder : [...draftOrder].reverse();
    for (const teamIdx of order) {
      if (pick >= totalPicks) break;
      if (rosters[teamIdx].length >= rosterCount) { pick++; continue; }
      // Golfers ranked 1-100, drafted in order (best available)
      rosters[teamIdx].push(pick + 1);
      pick++;
    }
    round++;
  }

  return rosters;
}

async function seedDev() {
  console.log("🧪 Seeding dev/test data...");

  // ─── Clear test data (keep reference data) ────────────────
  await db.delete(schema.tournamentResults);
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
  await db.delete(schema.leagueScoring);
  await db.delete(schema.leagueSettings);
  await db.delete(schema.managers);
  await db.delete(schema.leagues);
  await db.delete(schema.users);
  console.log("  Cleared test data tables");

  const tournamentsRaw = loadJSON<{ id: number; name: string }[]>(join(DATA_DIR, "tournaments.json"));

  // ─── 1. Users ─────────────────────────────────────────────
  const uniqueNames = new Set<string>();
  for (const league of LEAGUES) {
    for (const team of league.teams) uniqueNames.add(team.manager);
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
  const leagueIdMap = new Map<number, number>(); // index → DB id
  for (let i = 0; i < LEAGUES.length; i++) {
    const league = LEAGUES[i];
    const creatorId = userMap.get(league.teams[0].manager)!;
    const [row] = await db.insert(schema.leagues).values({
      createdById: creatorId, name: league.name,
    }).returning();
    leagueIdMap.set(i, row.id);
  }
  console.log(`  ✓ leagues: ${LEAGUES.length}`);

  // ─── 3. League settings + scoring ─────────────────────────
  const scoringEventsRows = await db.select().from(schema.scoringEvents);
  for (let i = 0; i < LEAGUES.length; i++) {
    const league = LEAGUES[i];
    const leagueId = leagueIdMap.get(i)!;
    await db.insert(schema.leagueSettings).values({
      leagueId,
      weekCount: 19,
      managerCount: league.teams.length,
      rosterCount: league.rosterCount,
      lineupCount: league.lineupCount,
      reserveCount: league.reserveCount,
    });
    if (scoringEventsRows.length > 0) {
      await db.insert(schema.leagueScoring).values(
        scoringEventsRows.map((e) => ({
          leagueId,
          scoringEventId: e.id,
          pointsVal: e.defaultPoints,
          isActive: true,
        }))
      );
    }
  }
  console.log(`  ✓ league_settings + league_scoring`);

  // ─── 4. Managers ──────────────────────────────────────────
  // managerDbId keyed by "leagueIdx-teamIdx"
  const managerIdMap = new Map<string, number>();
  for (let i = 0; i < LEAGUES.length; i++) {
    const league = LEAGUES[i];
    const leagueId = leagueIdMap.get(i)!;
    for (let t = 0; t < league.teams.length; t++) {
      const team = league.teams[t];
      const userId = userMap.get(team.manager)!;
      const isCommissioner = team.manager === "Bobby";
      const [manager] = await db.insert(schema.managers).values({
        userId, leagueId, teamName: team.teamName,
        colorCode: team.colors[0], secondaryColorCode: team.colors[1],
        isCommissioner,
      }).returning();
      managerIdMap.set(`${i}-${t}`, manager.id);
    }
  }
  console.log(`  ✓ managers: ${managerIdMap.size}`);

  // ─── 5. Manager rosters (snake draft) ───────────────────────
  let golferLinkCount = 0;
  const rosterGolfers = new Map<string, number[]>(); // "leagueIdx-teamIdx" → active golfer IDs

  for (let i = 0; i < LEAGUES.length; i++) {
    const league = LEAGUES[i];
    const teamGolfers = snakeDraft(league.teams.length, league.rosterCount);

    for (let t = 0; t < league.teams.length; t++) {
      const managerId = managerIdMap.get(`${i}-${t}`)!;
      const golfers = teamGolfers[t];
      const activeCount = league.lineupCount;

      const [mr] = await db.insert(schema.managerRosters).values({ managerId }).returning();
      const [roster] = await db.insert(schema.rosters).values({
        rosterableId: mr.id, rosterableType: "manager_roster",
      }).returning();

      const entries = golfers.map((gid, idx) => ({
        golferId: gid,
        rosterId: roster.id,
        statusEnum: "rostered" as const,
        isActive: idx < activeCount,
      }));

      if (entries.length > 0) {
        await db.insert(schema.golferRoster).values(entries);
        golferLinkCount += entries.length;
      }

      rosterGolfers.set(`${i}-${t}`, golfers.slice(0, activeCount));
    }
  }
  console.log(`  ✓ manager rosters: ${golferLinkCount} golfer links`);

  // ─── 6. League tournaments ────────────────────────────────
  const ltIdMap = new Map<string, number>();
  for (let i = 0; i < LEAGUES.length; i++) {
    const leagueId = leagueIdMap.get(i)!;
    for (let j = 0; j < tournamentsRaw.length; j++) {
      const t = tournamentsRaw[j];
      const [lt] = await db.insert(schema.leagueTournament).values({
        leagueId, tournamentId: t.id, weekNumber: j + 1, orderNumber: j + 1,
      }).returning();
      ltIdMap.set(`${i}-${t.id}`, lt.id);
    }
  }
  console.log(`  ✓ league_tournament: ${ltIdMap.size}`);

  // ─── 7. Tournament rosters (lineups for active tournament) ─
  let trCount = 0;
  const activeTournamentId = tournamentsRaw[0]?.id ?? 1;

  for (let i = 0; i < LEAGUES.length; i++) {
    const league = LEAGUES[i];
    for (let t = 0; t < league.teams.length; t++) {
      const managerId = managerIdMap.get(`${i}-${t}`)!;
      const ltId = ltIdMap.get(`${i}-${activeTournamentId}`);
      if (!ltId) continue;

      const lineupGolfers = rosterGolfers.get(`${i}-${t}`) ?? [];
      if (lineupGolfers.length === 0) continue;

      const [tr] = await db.insert(schema.tournamentRosters).values({
        leagueTournamentId: ltId, managerId,
      }).returning();
      const [roster] = await db.insert(schema.rosters).values({
        rosterableId: tr.id, rosterableType: "tournament_roster",
      }).returning();
      await db.insert(schema.golferRoster).values(
        lineupGolfers.map((gid) => ({ golferId: gid, rosterId: roster.id, statusEnum: "rostered" as const, isActive: true }))
      );
      trCount++;
    }
  }
  console.log(`  ✓ tournament rosters: ${trCount}`);

  // ─── 8. Sim state (fresh — pre-built so first R1 advance is fast) ─
  const firstTournamentId = tournamentsRaw[0]?.id ?? 1;
  await db.insert(schema.simActive).values({ id: 1, activeTournamentId: firstTournamentId })
    .onConflictDoUpdate({ target: schema.simActive.id, set: { activeTournamentId: firstTournamentId } });

  // Pre-build sim_tournaments + sim_players (the expensive part of first advance)
  const allGolfers = await db.select().from(schema.golfers);
  const [tournamentRow] = await db.select().from(schema.tournaments).where(
    (await import("drizzle-orm")).eq(schema.tournaments.id, firstTournamentId)
  );
  const [courseRow] = tournamentRow
    ? await db.select().from(schema.courses).where(
        (await import("drizzle-orm")).eq(schema.courses.id, tournamentRow.courseId)
      )
    : [null];
  const holePars = courseRow?.holes as number[] ?? Array(18).fill(4);
  const par = tournamentRow ? holePars.reduce((a, b) => a + b, 0) : 72;

  await db.insert(schema.simTournaments).values({
    tournamentId: firstTournamentId,
    phase: "idle",
    currentRound: 0,
    par,
    holePars,
    cutLine: null,
    fieldSize: allGolfers.length,
    overrides: {},
    isEarningsAccumulated: false,
    isPointsAccumulated: false,
  });

  if (allGolfers.length > 0) {
    await db.insert(schema.simPlayers).values(
      allGolfers.map((g) => ({
        tournamentId: firstTournamentId,
        golferId: g.id,
        name: g.name,
        origin: g.origin,
        ranking: g.ranking,
        rounds: [],
        holeScores: null,
        total: 0,
        toPar: 0,
        position: g.ranking,
        statusEnum: "active" as const,
      }))
    );
  }
  console.log(`  ✓ sim: pre-built idle (tournament ${firstTournamentId}, ${allGolfers.length} players)`);

  console.log("\n✅ Dev data seeded.");
  await client.end();
}

seedDev().catch((err) => {
  console.error("Dev seed failed:", err);
  process.exit(1);
});
