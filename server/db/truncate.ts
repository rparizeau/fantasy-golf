import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client, { schema });

async function truncate() {
  console.log("🗑️  Truncating all tables...");

  // Reverse dependency order
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
  await db.delete(schema.scoringEvents);
  await db.delete(schema.tournaments);
  await db.delete(schema.courses);
  await db.delete(schema.golfers);
  await db.delete(schema.users);

  console.log("✅ All tables truncated.");
  await client.end();
}

truncate().catch((err) => {
  console.error("Truncate failed:", err);
  process.exit(1);
});
