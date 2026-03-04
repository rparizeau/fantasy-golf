/**
 * Reference data seed — safe to run in any environment.
 * Seeds: golfers, courses, tournaments.
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

async function seed() {
  console.log("🌱 Seeding reference data...");

  // ─── Clear reference tables (and dependents) ─────────────
  // Must clear dependents first due to FK constraints
  await db.delete(schema.managerPoints);
  await db.delete(schema.simPlayers);
  await db.delete(schema.simTournaments);
  await db.delete(schema.simActive);
  await db.delete(schema.golferRoster);
  await db.delete(schema.rosters);
  await db.delete(schema.tournamentRosters);
  await db.delete(schema.managerRosters);
  await db.delete(schema.draftRosters);
  await db.delete(schema.draftPicks);
  await db.delete(schema.leagueTournament);
  await db.delete(schema.leagueScoring);
  await db.delete(schema.tournaments);
  await db.delete(schema.courses);
  await db.delete(schema.scoringEvents);
  await db.delete(schema.golfers);
  console.log("  Cleared reference tables");

  // ─── Golfers ──────────────────────────────────────────────
  const players = loadJSON<{ id: number; name: string; ranking: number; country: string }[]>(
    join(DATA_DIR, "players.json")
  );
  await db.insert(schema.golfers).values(
    players.map((p) => ({ id: p.id, name: p.name, ranking: p.ranking, origin: p.country }))
  );
  console.log(`  ✓ golfers: ${players.length}`);

  // ─── Load tournament data first (needed for course locations) ─
  const tournaments = loadJSON<{
    id: number; name: string; course: string; location: string;
    purse: number; par: number; isMajor: boolean; current?: boolean;
    color?: string; secondaryColor?: string; dates: { start: string; end: string };
  }[]>(join(DATA_DIR, "tournaments.json"));
  const locationByTid = new Map(tournaments.map((t) => [t.id, t.location]));

  // ─── Courses ──────────────────────────────────────────────
  const coursesRaw = loadJSON<Record<string, { course: string; holes: number[] }>>(
    join(DATA_DIR, "courses.json")
  );
  const courseEntries = Object.entries(coursesRaw);
  for (const [tid, data] of courseEntries) {
    await db.insert(schema.courses).values({
      id: Number(tid),
      name: data.course,
      holes: data.holes,
      address: locationByTid.get(Number(tid)) ?? null,
    });
  }
  console.log(`  ✓ courses: ${courseEntries.length}`);

  for (const t of tournaments) {
    await db.insert(schema.tournaments).values({
      id: t.id,
      courseId: t.id, // course IDs match tournament IDs from seed
      name: t.name,
      startDate: t.dates.start,
      endDate: t.dates.end,
      purse: t.purse,
      colorCode: t.color ?? "#003C80",
      secondaryColorCode: t.secondaryColor ?? "#FFFFFF",
      isMajor: t.isMajor,
    });
  }
  console.log(`  ✓ tournaments: ${tournaments.length}`);

  // ─── Scoring Events ────────────────────────────────────────
  await db.delete(schema.scoringEvents);
  await db.insert(schema.scoringEvents).values([
    { key: "albatross", label: "Albatross", category: "hole_outcome", defaultPoints: 1000, sortOrder: 1 },
    { key: "eagle", label: "Eagle", category: "hole_outcome", defaultPoints: 600, sortOrder: 2 },
    { key: "birdie", label: "Birdie", category: "hole_outcome", defaultPoints: 300, sortOrder: 3 },
    { key: "par", label: "Par", category: "hole_outcome", defaultPoints: 100, sortOrder: 4 },
    { key: "bogey", label: "Bogey", category: "hole_outcome", defaultPoints: 0, sortOrder: 5 },
    { key: "double_bogey", label: "Double Bogey", category: "hole_outcome", defaultPoints: -100, sortOrder: 6 },
    { key: "triple_bogey_plus", label: "Triple Bogey+", category: "hole_outcome", defaultPoints: -200, sortOrder: 7 },
    { key: "hole_in_one", label: "Hole-in-One", category: "bonus", defaultPoints: 800, sortOrder: 8 },
  ]);
  console.log(`  ✓ scoring_events: 8`);

  console.log("\n✅ Reference data seeded.");
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
