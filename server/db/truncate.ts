import "dotenv/config";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(connectionString, { prepare: false });

async function truncate() {
  console.log("🗑️  Truncating all tables...");

  await client`
    TRUNCATE
      manager_points,
      sim_players,
      sim_tournaments,
      sim_active,
      messages,
      activities,
      waivers,
      golfer_trade,
      trades,
      draft_picks,
      drafts,
      golfer_roster,
      rosters,
      tournament_rosters,
      manager_rosters,
      draft_rosters,
      league_tournament,
      league_scoring,
      league_settings,
      managers,
      leagues,
      scoring_events,
      tournaments,
      courses,
      golfers,
      users
    CASCADE
  `;

  console.log("✅ All tables truncated.");
  await client.end();
}

truncate().catch((err) => {
  console.error("Truncate failed:", err);
  process.exit(1);
});
