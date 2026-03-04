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
    name: "Gruesome Twosome",
    rosterCount: 8, lineupCount: 2, reserveCount: 2,
    teams: [
      { manager: "Bobby", teamName: "Bogey Bros", colors: ["#1A1A2E", "#E94560"] },
      { manager: "Jake", teamName: "The Sandbaggers", colors: ["#006B54", "#FFD700"] },
      { manager: "Mike", teamName: "Birdie Brigade", colors: ["#0F4C75", "#BBE1FA"] },
      { manager: "Sarah", teamName: "Eagle Eyes", colors: ["#5C2D91", "#FFB900"] },
      { manager: "Tom", teamName: "Par-tee Animals", colors: ["#CC0000", "#FFFFFF"] },
      { manager: "Lisa", teamName: "Fore Play", colors: ["#E8659B", "#FFFFFF"] },
      { manager: "Dave", teamName: "Slice of Life", colors: ["#2D6A4F", "#D4AF37"] },
      { manager: "Emma", teamName: "Cart Narcs", colors: ["#FF6B35", "#1A1A1A"] },
      { manager: "Chris", teamName: "Putt Pirates", colors: ["#1B1B3A", "#FFD700"] },
      { manager: "Alex", teamName: "Fairway Bandits", colors: ["#344E41", "#DAD7CD"] },
      { manager: "Ryan", teamName: "Green Machine", colors: ["#2D8B52", "#FFFFFF"] },
      { manager: "Megan", teamName: "Rough Riders", colors: ["#8B4513", "#F5DEB3"] },
    ],
  },
  {
    name: "The Foursome",
    rosterCount: 8, lineupCount: 4, reserveCount: 0,
    teams: [
      { manager: "Bobby", teamName: "Pin Seekers", colors: ["#003C80", "#FFD700"] },
      { manager: "Dan", teamName: "Tee Time Bandits", colors: ["#2C3E50", "#E74C3C"] },
      { manager: "Kate", teamName: "Iron Maidens", colors: ["#4A0E4E", "#E8A0BF"] },
      { manager: "Nick", teamName: "Driver's Ed", colors: ["#1A5276", "#F39C12"] },
      { manager: "Jess", teamName: "Club Soda", colors: ["#16A085", "#ECF0F1"] },
      { manager: "Matt", teamName: "Chip Shots", colors: ["#C0392B", "#FFFFFF"] },
      { manager: "Amy", teamName: "Mulligan Stew", colors: ["#8E44AD", "#F1C40F"] },
      { manager: "Ben", teamName: "Caddy Shack", colors: ["#27AE60", "#1A1A1A"] },
      { manager: "Zoe", teamName: "Ace Ventura", colors: ["#E67E22", "#FFFFFF"] },
      { manager: "Tyler", teamName: "Sand Trap Stars", colors: ["#D4A03C", "#3D2B1F"] },
      { manager: "Sam", teamName: "Divot Diggers", colors: ["#5D4037", "#FFCC80"] },
      { manager: "Luke", teamName: "Links Legends", colors: ["#1C2841", "#C9B037"] },
    ],
  },
  {
    name: "Thin Lines",
    rosterCount: 8, lineupCount: 2, reserveCount: 2,
    teams: [
      { manager: "Bobby", teamName: "Commissioner's Cut", colors: ["#1A1A1A", "#D4AF37"] },
      { manager: "Hailey", teamName: "Wedge Warriors", colors: ["#6C3483", "#FFFFFF"] },
      { manager: "Josh", teamName: "The Handicappers", colors: ["#154360", "#48C9B0"] },
      { manager: "Rachel", teamName: "Bogey Nights", colors: ["#2E4053", "#F5B041"] },
      { manager: "Ethan", teamName: "Putt Busters", colors: ["#922B21", "#FDEBD0"] },
      { manager: "Olivia", teamName: "The Back Nine", colors: ["#0B5345", "#ABEBC6"] },
      { manager: "Kyle", teamName: "Sub Par", colors: ["#1F618D", "#AED6F1"] },
      { manager: "Nate", teamName: "Cart Path Crusaders", colors: ["#7D6608", "#F9E79F"] },
      { manager: "Derek", teamName: "Swing Kings", colors: ["#4A235A", "#D7BDE2"] },
      { manager: "Kelly", teamName: "Hole in Fun", colors: ["#E74C3C", "#FADBD8"] },
      { manager: "Jake", teamName: "Duffer's Delight", colors: ["#117A65", "#D5F5E3"] },
      { manager: "Mike", teamName: "The Caddies", colors: ["#2C3E50", "#85C1E9"] },
      { manager: "Sarah", teamName: "Front Nine Crew", colors: ["#784212", "#FAD7A0"] },
      { manager: "Tom", teamName: "Golf Nuts", colors: ["#1A5276", "#FFFFFF"] },
      { manager: "Lisa", teamName: "Under Par Stars", colors: ["#7B241C", "#F5B7B1"] },
      { manager: "Dave", teamName: "Tee Rex", colors: ["#145A32", "#F9E79F"] },
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
  await db.insert(schema.simActive).values({ id: 1, activeTournamentId: firstTournamentId });

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
