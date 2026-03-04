import { db } from "../index.js";
import {
  managerPoints, golferRoster, rosters, managerRosters, tournamentRosters,
  leagueTournament, simTournaments, leagueScoring, scoringEvents,
  tournamentResults,
} from "../schema/index.js";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import { holeToPoints, type ScoringSettings } from "../../sim/engine.js";

/**
 * Write per-hole point rows for one golfer_roster entry for one round.
 * `holeScores` is the 18-element array of strokes, `holePars` is the matching par array.
 * Points are computed from the scoring settings and stored in pennies (×100).
 */
export async function writeRoundPoints(
  golferRosterId: number,
  roundNumber: number,
  holeScores: (number | null)[],
  holePars: number[],
  scoring: ScoringSettings,
): Promise<void> {
  const rows: {
    golferRosterId: number;
    roundNumber: number;
    holeNumber: number;
    holeScore: number;
    holePar: number;
    pointsVal: number;
  }[] = [];

  for (let h = 0; h < holeScores.length; h++) {
    const score = holeScores[h];
    if (score == null) continue;
    const par = holePars[h] ?? 4;
    const pts = holeToPoints(score, par, scoring);
    rows.push({
      golferRosterId,
      roundNumber,
      holeNumber: h + 1,
      holeScore: score,
      holePar: par,
      pointsVal: pts * 100,
    });
  }

  if (rows.length > 0) {
    await db.insert(managerPoints).values(rows);
  }
}

/**
 * Get total season points for a manager from tournament_results.
 * Returns points in display units (pennies ÷ 100).
 */
export async function getSeasonPoints(managerId: number): Promise<number> {
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${tournamentResults.totalPointsVal}), 0)` })
    .from(tournamentResults)
    .where(eq(tournamentResults.managerId, managerId));

  return (result[0]?.total ?? 0) / 100;
}

/**
 * Get points for a single tournament for a manager.
 * Returns points in display units (pennies ÷ 100).
 */
export async function getTournamentPoints(managerId: number, leagueTournamentId: number): Promise<number> {
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${managerPoints.pointsVal}), 0)` })
    .from(managerPoints)
    .innerJoin(golferRoster, eq(managerPoints.golferRosterId, golferRoster.id))
    .innerJoin(rosters, eq(golferRoster.rosterId, rosters.id))
    .innerJoin(
      tournamentRosters,
      and(
        eq(rosters.rosterableId, tournamentRosters.id),
        sql`${rosters.rosterableType} = 'tournament_roster'`,
      ),
    )
    .where(
      and(
        eq(tournamentRosters.managerId, managerId),
        eq(tournamentRosters.leagueTournamentId, leagueTournamentId),
      ),
    );

  return (result[0]?.total ?? 0) / 100;
}

/**
 * Delete all point rows for a specific golfer_roster + round.
 * Used when rewinding a round.
 */
export async function deletePointsForRound(golferRosterId: number, roundNumber: number): Promise<void> {
  await db.delete(managerPoints).where(
    and(
      eq(managerPoints.golferRosterId, golferRosterId),
      eq(managerPoints.roundNumber, roundNumber),
    ),
  );
}

/**
 * Delete all point rows for a golfer_roster (all rounds).
 */
export async function deleteAllPointsForGolferRoster(golferRosterId: number): Promise<void> {
  await db.delete(managerPoints).where(eq(managerPoints.golferRosterId, golferRosterId));
}

/**
 * Write points for all active lineup golfers across all leagues for a given round.
 * `playerHoleScores` maps playerId → 18-element hole scores array.
 */
export async function writePointsForRound(
  tournamentId: number,
  roundNumber: number,
  playerHoleScores: Map<number, (number | null)[]>,
  holePars: number[],
): Promise<void> {
  // Get all league_tournament rows for this tournament
  const ltRows = await db.select().from(leagueTournament)
    .where(eq(leagueTournament.tournamentId, tournamentId));
  if (ltRows.length === 0) return;

  const ltIds = ltRows.map((r) => r.id);

  // Get scoring settings for each league
  const leagueIds = [...new Set(ltRows.map((r) => r.leagueId))];
  const scoringRows = await db.select({
    leagueId: leagueScoring.leagueId,
    key: scoringEvents.key,
    value: leagueScoring.pointsVal,
  })
    .from(leagueScoring)
    .innerJoin(scoringEvents, eq(leagueScoring.scoringEventId, scoringEvents.id))
    .where(inArray(leagueScoring.leagueId, leagueIds));

  const leagueScoringMap = new Map<number, ScoringSettings>();
  for (const row of scoringRows) {
    const settings = leagueScoringMap.get(row.leagueId) ?? {};
    settings[row.key] = row.value / 100; // DB stores pennies, holeToPoints expects display units
    leagueScoringMap.set(row.leagueId, settings);
  }

  // Get all tournament_rosters for these league_tournaments
  const trRows = await db.select().from(tournamentRosters)
    .where(inArray(tournamentRosters.leagueTournamentId, ltIds));
  if (trRows.length === 0) return;

  const trIds = trRows.map((r) => r.id);

  // Get rosters → golfer_roster chain
  const rosterRows = await db.select().from(rosters)
    .where(and(
      inArray(rosters.rosterableId, trIds),
      eq(rosters.rosterableType, "tournament_roster"),
    ));
  if (rosterRows.length === 0) return;

  const rosterIds = rosterRows.map((r) => r.id);
  const grRows = await db.select().from(golferRoster)
    .where(inArray(golferRoster.rosterId, rosterIds));

  // Build mapping: golfer_roster.id → { golferId, leagueId }
  const rosterToTrId = new Map(rosterRows.map((r) => [r.id, r.rosterableId]));
  const trToLtId = new Map(trRows.map((r) => [r.id, r.leagueTournamentId]));
  const ltToLeagueId = new Map(ltRows.map((r) => [r.id, r.leagueId]));

  const allRows: {
    golferRosterId: number;
    roundNumber: number;
    holeNumber: number;
    holeScore: number;
    holePar: number;
    pointsVal: number;
  }[] = [];

  for (const gr of grRows) {
    const trId = rosterToTrId.get(gr.rosterId);
    if (trId == null) continue;
    const ltId = trToLtId.get(trId);
    if (ltId == null) continue;
    const leagueId = ltToLeagueId.get(ltId);
    if (leagueId == null) continue;

    const scoring = leagueScoringMap.get(leagueId) ?? {};
    const holeScores = playerHoleScores.get(gr.golferId);
    if (!holeScores) continue;

    for (let h = 0; h < holeScores.length; h++) {
      const score = holeScores[h];
      if (score == null) continue;
      const par = holePars[h] ?? 4;
      const pts = holeToPoints(score, par, scoring);
      allRows.push({
        golferRosterId: gr.id,
        roundNumber,
        holeNumber: h + 1,
        holeScore: score,
        holePar: par,
        pointsVal: pts * 100,
      });
    }
  }

  // Batch insert
  if (allRows.length > 0) {
    // Insert in chunks of 500 to avoid hitting parameter limits
    for (let i = 0; i < allRows.length; i += 500) {
      await db.insert(managerPoints).values(allRows.slice(i, i + 500));
    }
  }
}

export interface GolferSeasonStats {
  points: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubles: number;
}

/**
 * Get season stats grouped by golfer for a league.
 * Returns a Map of golferId → stats (points in display units, hole-type counts).
 */
export async function getSeasonStatsByGolfer(leagueId: number, excludeTournamentId?: number): Promise<Map<number, GolferSeasonStats>> {
  const conditions = [eq(leagueTournament.leagueId, leagueId)];
  if (excludeTournamentId != null) {
    conditions.push(sql`${leagueTournament.tournamentId} != ${excludeTournamentId}`);
  }
  const rows = await db
    .select({
      golferId: golferRoster.golferId,
      total: sql<number>`COALESCE(SUM(${managerPoints.pointsVal}), 0)`,
      eagles: sql<number>`COUNT(*) FILTER (WHERE ${managerPoints.holeScore} <= ${managerPoints.holePar} - 2)`,
      birdies: sql<number>`COUNT(*) FILTER (WHERE ${managerPoints.holeScore} = ${managerPoints.holePar} - 1)`,
      pars: sql<number>`COUNT(*) FILTER (WHERE ${managerPoints.holeScore} = ${managerPoints.holePar})`,
      bogeys: sql<number>`COUNT(*) FILTER (WHERE ${managerPoints.holeScore} = ${managerPoints.holePar} + 1)`,
      doubles: sql<number>`COUNT(*) FILTER (WHERE ${managerPoints.holeScore} >= ${managerPoints.holePar} + 2)`,
    })
    .from(managerPoints)
    .innerJoin(golferRoster, eq(managerPoints.golferRosterId, golferRoster.id))
    .innerJoin(rosters, eq(golferRoster.rosterId, rosters.id))
    .innerJoin(
      tournamentRosters,
      and(
        eq(rosters.rosterableId, tournamentRosters.id),
        sql`${rosters.rosterableType} = 'tournament_roster'`,
      ),
    )
    .innerJoin(leagueTournament, eq(tournamentRosters.leagueTournamentId, leagueTournament.id))
    .where(and(...conditions))
    .groupBy(golferRoster.golferId);

  const map = new Map<number, GolferSeasonStats>();
  for (const r of rows) {
    map.set(r.golferId, {
      points: r.total / 100,
      eagles: Number(r.eagles),
      birdies: Number(r.birdies),
      pars: Number(r.pars),
      bogeys: Number(r.bogeys),
      doubles: Number(r.doubles),
    });
  }
  return map;
}

/**
 * Write (or overwrite) tournament_results rows for all leagues tied to a tournament.
 * Sums manager_points through the roster chain, ranks managers, and upserts results.
 */
export async function writeTournamentResults(tournamentId: number): Promise<void> {
  // Get all league_tournament rows for this tournament
  const ltRows = await db.select().from(leagueTournament)
    .where(eq(leagueTournament.tournamentId, tournamentId));
  if (ltRows.length === 0) return;

  for (const lt of ltRows) {
    // Get all managers who have tournament_rosters for this league_tournament
    const trRows = await db.select().from(tournamentRosters)
      .where(eq(tournamentRosters.leagueTournamentId, lt.id));
    if (trRows.length === 0) continue;

    // Sum points per manager through the roster chain
    const pointRows = await db
      .select({
        managerId: tournamentRosters.managerId,
        total: sql<number>`COALESCE(SUM(${managerPoints.pointsVal}), 0)`,
      })
      .from(managerPoints)
      .innerJoin(golferRoster, eq(managerPoints.golferRosterId, golferRoster.id))
      .innerJoin(rosters, eq(golferRoster.rosterId, rosters.id))
      .innerJoin(
        tournamentRosters,
        and(
          eq(rosters.rosterableId, tournamentRosters.id),
          sql`${rosters.rosterableType} = 'tournament_roster'`,
        ),
      )
      .where(eq(tournamentRosters.leagueTournamentId, lt.id))
      .groupBy(tournamentRosters.managerId);

    // Build a map of managerId → totalPointsVal (keep as pennies)
    const managerTotals = new Map(pointRows.map((r) => [r.managerId, r.total]));

    // Include managers with 0 points (had a roster but no points)
    for (const tr of trRows) {
      if (!managerTotals.has(tr.managerId)) {
        managerTotals.set(tr.managerId, 0);
      }
    }

    // Rank by points DESC (dense rank for ties)
    const sorted = [...managerTotals.entries()].sort((a, b) => b[1] - a[1]);
    const ranked: { managerId: number; totalPointsVal: number; position: number }[] = [];
    let pos = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i][1] < sorted[i - 1][1]) {
        pos = i + 1;
      }
      ranked.push({
        managerId: sorted[i][0],
        totalPointsVal: sorted[i][1],
        position: pos,
      });
    }

    // Upsert into tournament_results
    for (const r of ranked) {
      await db.insert(tournamentResults)
        .values({
          leagueTournamentId: lt.id,
          managerId: r.managerId,
          totalPointsVal: r.totalPointsVal,
          position: r.position,
        })
        .onConflictDoUpdate({
          target: [tournamentResults.leagueTournamentId, tournamentResults.managerId],
          set: {
            totalPointsVal: r.totalPointsVal,
            position: r.position,
          },
        });
    }
  }
}

/**
 * Delete tournament_results rows for a given tournament (all leagues).
 */
export async function deleteTournamentResults(tournamentId: number): Promise<void> {
  const ltRows = await db.select({ id: leagueTournament.id }).from(leagueTournament)
    .where(eq(leagueTournament.tournamentId, tournamentId));
  if (ltRows.length === 0) return;

  await db.delete(tournamentResults).where(
    inArray(tournamentResults.leagueTournamentId, ltRows.map((r) => r.id)),
  );
}
