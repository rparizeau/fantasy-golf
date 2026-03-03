import { db, client } from "../index.js";
import { simActive, simTournaments, simPlayers, tournaments as tournamentsTable } from "../schema/index.js";
import { eq } from "drizzle-orm";
import { loadGolfers, loadTournaments, loadCourse } from "./seed-data.js";

// --- Types (same as engine.ts) ---

export type Phase = "idle" | "round1" | "round2" | "cut" | "round3" | "round4" | "final";

export interface PlayerRound {
  playerId: number;
  name: string;
  country: string;
  ranking: number;
  rounds: number[];
  holeScores?: (number | null)[][];
  total: number;
  toPar: number;
  position: number;
  status: "active" | "cut" | "wd";
}

export interface SimState {
  phase: Phase;
  tournamentId: number;
  currentRound: number;
  par: number;
  holePars?: number[];
  players: PlayerRound[];
  cutLine: number | null;
  fieldSize: number;
  overrides: Record<number, { score?: number; wd?: boolean }>;
  earningsAccumulated?: boolean;
  pointsAccumulated?: boolean;
}

// --- Active Tournament ---

export async function getActiveTournamentId(): Promise<number> {
  const [row] = await db.select().from(simActive).where(eq(simActive.id, 1));
  if (row) return row.activeTournamentId;

  // Default to first tournament
  const tournaments = await loadTournaments();
  const first = tournaments[0];
  await setActiveTournamentId(first.id);
  return first.id;
}

export async function setActiveTournamentId(tournamentId: number): Promise<void> {
  await db.insert(simActive)
    .values({ id: 1, activeTournamentId: tournamentId })
    .onConflictDoUpdate({
      target: simActive.id,
      set: { activeTournamentId: tournamentId },
    });
}

// --- State Load / Save ---

export async function loadActiveSimState(): Promise<SimState> {
  const id = await getActiveTournamentId();
  return loadTournamentState(id);
}

export async function loadTournamentState(tournamentId: number): Promise<SimState> {
  const [tourney] = await db.select().from(simTournaments)
    .where(eq(simTournaments.tournamentId, tournamentId));

  if (!tourney) {
    return createFreshState(tournamentId);
  }

  const playerRows = await db.select().from(simPlayers)
    .where(eq(simPlayers.tournamentId, tournamentId));

  // Sort players by position for consistent ordering
  playerRows.sort((a, b) => a.position - b.position);

  return {
    phase: tourney.phase,
    tournamentId: tourney.tournamentId,
    currentRound: tourney.currentRound,
    par: tourney.par,
    holePars: tourney.holePars ?? undefined,
    players: playerRows.map((p) => ({
      playerId: p.golferId,
      name: p.name,
      country: p.origin,
      ranking: p.ranking,
      rounds: p.rounds,
      holeScores: p.holeScores ?? undefined,
      total: p.total,
      toPar: p.toPar,
      position: p.position,
      status: p.statusEnum,
    })),
    cutLine: tourney.cutLine ?? null,
    fieldSize: tourney.fieldSize,
    overrides: (tourney.overrides ?? {}) as Record<number, { score?: number; wd?: boolean }>,
    earningsAccumulated: tourney.isEarningsAccumulated,
    pointsAccumulated: tourney.isPointsAccumulated,
  };
}

export async function saveSimState(state: SimState): Promise<void> {
  // Upsert tournament row
  await db.insert(simTournaments)
    .values({
      tournamentId: state.tournamentId,
      phase: state.phase,
      currentRound: state.currentRound,
      par: state.par,
      holePars: state.holePars ?? null,
      cutLine: state.cutLine ?? null,
      fieldSize: state.fieldSize,
      overrides: state.overrides as Record<number, { score?: number; wd?: boolean }>,
      isEarningsAccumulated: state.earningsAccumulated ?? false,
      isPointsAccumulated: state.pointsAccumulated ?? false,
    })
    .onConflictDoUpdate({
      target: simTournaments.tournamentId,
      set: {
        phase: state.phase,
        currentRound: state.currentRound,
        par: state.par,
        holePars: state.holePars ?? null,
        cutLine: state.cutLine ?? null,
        fieldSize: state.fieldSize,
        overrides: state.overrides as Record<number, { score?: number; wd?: boolean }>,
        isEarningsAccumulated: state.earningsAccumulated ?? false,
        isPointsAccumulated: state.pointsAccumulated ?? false,
      },
    });

  // Bulk upsert all players in a single query using unnest arrays
  if (state.players.length > 0) {
    const tournamentIds = state.players.map(() => state.tournamentId);
    const golferIds = state.players.map((p) => p.playerId);
    const names = state.players.map((p) => p.name);
    const origins = state.players.map((p) => p.country);
    const rankings = state.players.map((p) => p.ranking);
    const rounds = state.players.map((p) => JSON.stringify(p.rounds));
    const holeScores = state.players.map((p) => p.holeScores ? JSON.stringify(p.holeScores) : null);
    const totals = state.players.map((p) => p.total);
    const toPars = state.players.map((p) => p.toPar);
    const positions = state.players.map((p) => p.position);
    const statuses = state.players.map((p) => p.status);

    await client`
      INSERT INTO sim_players (tournament_id, golfer_id, name, origin, ranking, rounds, hole_scores, total, to_par, position, status_enum)
      SELECT * FROM unnest(
        ${tournamentIds}::int[],
        ${golferIds}::int[],
        ${names}::varchar[],
        ${origins}::varchar[],
        ${rankings}::int[],
        ${rounds}::jsonb[],
        ${holeScores}::jsonb[],
        ${totals}::int[],
        ${toPars}::int[],
        ${positions}::int[],
        ${statuses}::varchar[]
      )
      ON CONFLICT (tournament_id, golfer_id) DO UPDATE SET
        rounds = EXCLUDED.rounds,
        hole_scores = EXCLUDED.hole_scores,
        total = EXCLUDED.total,
        to_par = EXCLUDED.to_par,
        position = EXCLUDED.position,
        status_enum = EXCLUDED.status_enum
    `;
  }
}

/** Generate a synthetic par layout when no course data exists. */
function defaultHolePars(par: number): number[] {
  const holes = new Array(18).fill(4);
  let remaining = par - 72;
  holes[1] = 5; holes[8] = 5;
  holes[2] = 3; holes[6] = 3;
  if (remaining > 0) {
    const candidates = [4, 13, 17];
    for (const i of candidates) {
      if (remaining <= 0) break;
      holes[i] = 5;
      remaining--;
    }
  } else if (remaining < 0) {
    const candidates = [11, 15, 3];
    for (const i of candidates) {
      if (remaining >= 0) break;
      holes[i] = 3;
      remaining++;
    }
  }
  return holes;
}

export async function createFreshState(tournamentId: number): Promise<SimState> {
  const allGolfers = await loadGolfers();
  const tournaments = await loadTournaments();
  const tournament = tournaments.find((t) => t.id === tournamentId) || tournaments[0];

  // Load course by looking up courseId from the tournament table
  const [tournamentRow] = await db.select({ courseId: tournamentsTable.courseId })
    .from(tournamentsTable).where(eq(tournamentsTable.id, tournament.id));
  const courseData = tournamentRow ? await loadCourse(tournamentRow.courseId) : null;
  const holePars = courseData ? (courseData.holes as number[]) : defaultHolePars(tournament.par);

  const state: SimState = {
    phase: "idle",
    tournamentId: tournament.id,
    currentRound: 0,
    par: tournament.par,
    holePars,
    players: allGolfers.map((p) => ({
      playerId: p.id,
      name: p.name,
      country: p.country,
      ranking: p.ranking,
      rounds: [],
      holeScores: [],
      total: 0,
      toPar: 0,
      position: p.ranking,
      status: "active" as const,
    })),
    cutLine: null,
    fieldSize: allGolfers.length,
    overrides: {},
  };

  await saveSimState(state);
  return state;
}

export async function resetSimState(tournamentId?: number): Promise<SimState> {
  const activeId = await getActiveTournamentId();
  const targetId = tournamentId ?? activeId;

  if (targetId !== activeId) {
    await setActiveTournamentId(targetId);
    // Check if this tournament has existing state
    const [existing] = await db.select().from(simTournaments)
      .where(eq(simTournaments.tournamentId, targetId));
    if (existing) {
      return loadTournamentState(targetId);
    }
    return createFreshState(targetId);
  }

  // Same tournament — force reset: delete existing sim data, create fresh
  await db.transaction(async (tx) => {
    await tx.delete(simPlayers).where(eq(simPlayers.tournamentId, targetId));
    await tx.delete(simTournaments).where(eq(simTournaments.tournamentId, targetId));
  });

  return createFreshState(targetId);
}
