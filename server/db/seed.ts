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

async function seed() {
  console.log("🌱 Starting seed...");

  // --- Seed: players ---
  const players = loadJSON<{ id: number; name: string; ranking: number; country: string }[]>(
    join(DATA_DIR, "players.json")
  );
  await db.delete(schema.simPlayers);
  await db.delete(schema.simTournaments);
  await db.delete(schema.simActive);
  await db.delete(schema.tournamentLineups);
  await db.delete(schema.teamRosters);
  await db.delete(schema.waiverClaims);
  await db.delete(schema.activityFeed);
  await db.delete(schema.chatMessages);
  await db.delete(schema.teams);
  await db.delete(schema.leagues);
  await db.delete(schema.courses);
  await db.delete(schema.payouts);
  await db.delete(schema.players);
  await db.delete(schema.tournaments);
  console.log("  Cleared all tables");

  await db.insert(schema.players).values(players);
  console.log(`  ✓ players: ${players.length} rows`);

  // --- Seed: tournaments ---
  const tournaments = loadJSON<{
    id: number; name: string; course: string; location: string;
    purse: number; par: number; isMajor: boolean; current?: boolean;
    dates: { start: string; end: string };
  }[]>(join(DATA_DIR, "tournaments.json"));

  await db.insert(schema.tournaments).values(
    tournaments.map((t) => ({
      id: t.id,
      name: t.name,
      course: t.course,
      location: t.location,
      purse: t.purse,
      par: t.par,
      isMajor: t.isMajor,
      isCurrent: t.current ?? false,
      dateStart: t.dates.start,
      dateEnd: t.dates.end,
    }))
  );
  console.log(`  ✓ tournaments: ${tournaments.length} rows`);

  // --- Seed: courses ---
  const coursesRaw = loadJSON<Record<string, { course: string; holes: number[] }>>(
    join(DATA_DIR, "courses.json")
  );
  const courseRows = Object.entries(coursesRaw).map(([tid, data]) => ({
    tournamentId: Number(tid),
    courseName: data.course,
    holes: data.holes,
  }));
  await db.insert(schema.courses).values(courseRows);
  console.log(`  ✓ courses: ${courseRows.length} rows`);

  // --- Seed: payouts ---
  const payoutTable = loadJSON<{ position: number; pct: number }[]>(
    join(DATA_DIR, "payout-table.json")
  );
  await db.insert(schema.payouts).values(payoutTable);
  console.log(`  ✓ payouts: ${payoutTable.length} rows`);

  // --- Seed: leagues + teams + rosters + lineups ---
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

  // Map to track league-local teamId → global team PK
  const teamPkMap = new Map<string, number>(); // "leagueId-teamId" → pk

  for (const league of Object.values(leagueState.leagues)) {
    await db.insert(schema.leagues).values({
      id: league.id,
      name: league.name,
      rosterSize: league.settings.rosterSize,
      activeSize: league.settings.activeSize,
      reserveSize: league.settings.reserveSize,
      mulligansPerSeason: league.settings.mulligansPerSeason,
    });

    for (const team of league.teams) {
      const [inserted] = await db.insert(schema.teams).values({
        leagueId: league.id,
        teamId: team.teamId,
        teamName: team.teamName,
        managerName: team.managerName,
        mulligansUsed: team.mulligansUsed,
        seasonEarnings: team.seasonEarnings,
      }).returning({ id: schema.teams.id });

      const pk = inserted.id;
      teamPkMap.set(`${league.id}-${team.teamId}`, pk);

      // Roster entries
      const rosterRows = team.roster.map((pid) => ({
        teamPk: pk,
        playerId: pid,
        slot: "roster" as const,
      }));
      const reserveRows = (team.reserve || []).map((pid) => ({
        teamPk: pk,
        playerId: pid,
        slot: "reserve" as const,
      }));
      const allRosterRows = [...rosterRows, ...reserveRows];
      if (allRosterRows.length > 0) {
        await db.insert(schema.teamRosters).values(allRosterRows);
      }

      // Tournament lineups
      const lineupRows: { teamPk: number; tournamentId: number; playerId: number }[] = [];
      for (const [tid, playerIds] of Object.entries(team.tournamentLineups)) {
        for (const pid of playerIds) {
          lineupRows.push({ teamPk: pk, tournamentId: Number(tid), playerId: pid });
        }
      }
      if (lineupRows.length > 0) {
        await db.insert(schema.tournamentLineups).values(lineupRows);
      }
    }

    // Waiver claims
    if (league.waiverClaims.length > 0) {
      await db.insert(schema.waiverClaims).values(
        league.waiverClaims.map((wc) => ({
          leagueId: league.id,
          teamId: wc.teamId,
          addPlayerId: wc.addPlayerId,
          dropPlayerId: wc.dropPlayerId ?? null,
          faabBid: wc.faabBid,
          createdAt: new Date(wc.timestamp),
        }))
      );
    }

    // Activity feed
    if (league.activityFeed.length > 0) {
      await db.insert(schema.activityFeed).values(
        league.activityFeed.map((af) => ({
          leagueId: league.id,
          type: af.type,
          message: af.message,
          createdAt: new Date(af.timestamp),
        }))
      );
    }

    // Chat messages
    if (league.chatMessages.length > 0) {
      await db.insert(schema.chatMessages).values(
        league.chatMessages.map((cm) => ({
          leagueId: league.id,
          teamId: cm.teamId,
          teamName: cm.teamName,
          message: cm.message,
          createdAt: new Date(cm.timestamp),
        }))
      );
    }

    console.log(`  ✓ league "${league.name}": ${league.teams.length} teams`);
  }

  // --- Seed: sim_active ---
  const simActiveData = loadJSON<{ activeTournamentId: number }>(
    join(STATE_DIR, "sim-active.json")
  );
  await db.insert(schema.simActive).values({
    id: 1,
    activeTournamentId: simActiveData.activeTournamentId,
  });
  console.log(`  ✓ sim_active: tournament ${simActiveData.activeTournamentId}`);

  // --- Seed: sim_tournaments + sim_players ---
  let simTournamentCount = 0;
  let simPlayerCount = 0;

  for (let tid = 1; tid <= 19; tid++) {
    const path = join(STATE_DIR, `sim-tournament-${tid}.json`);
    if (!existsSync(path)) continue;

    const state = loadJSON<{
      phase: string; tournamentId: number; currentRound: number;
      par: number; holePars?: number[]; cutLine: number | null;
      fieldSize: number; overrides: Record<string, unknown>;
      earningsAccumulated?: boolean;
      players: {
        playerId: number; name: string; country: string; ranking: number;
        rounds: number[]; holeScores?: (number | null)[][];
        total: number; toPar: number; position: number;
        status: "active" | "cut" | "wd";
      }[];
    }>(path);

    await db.insert(schema.simTournaments).values({
      tournamentId: state.tournamentId,
      phase: state.phase as "idle" | "round1" | "round2" | "cut" | "round3" | "round4" | "final",
      currentRound: state.currentRound,
      par: state.par,
      holePars: state.holePars ?? null,
      cutLine: state.cutLine ?? null,
      fieldSize: state.fieldSize,
      overrides: state.overrides as Record<number, { score?: number; wd?: boolean }>,
      earningsAccumulated: state.earningsAccumulated ?? false,
    });
    simTournamentCount++;

    // Batch insert sim players in chunks of 50
    const playerRows = state.players.map((p) => ({
      tournamentId: state.tournamentId,
      playerId: p.playerId,
      name: p.name,
      country: p.country,
      ranking: p.ranking,
      rounds: p.rounds,
      holeScores: p.holeScores ?? null,
      total: p.total,
      toPar: p.toPar,
      position: p.position,
      status: p.status,
    }));

    for (let i = 0; i < playerRows.length; i += 50) {
      await db.insert(schema.simPlayers).values(playerRows.slice(i, i + 50));
    }
    simPlayerCount += playerRows.length;
  }

  console.log(`  ✓ sim_tournaments: ${simTournamentCount} rows`);
  console.log(`  ✓ sim_players: ${simPlayerCount} rows`);

  console.log("\n✅ Seed complete!");
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
