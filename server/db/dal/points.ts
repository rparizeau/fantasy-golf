import { db } from "../index.js";
import {
  managerPoints, golferRoster, rosters, managerRosters, tournamentRosters,
} from "../schema/index.js";
import { eq, and, sql } from "drizzle-orm";
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
 * Get total season points for a manager (sum of all manager_points via golfer_roster chain).
 * Returns points in display units (pennies ÷ 100).
 */
export async function getSeasonPoints(managerId: number): Promise<number> {
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
    .where(eq(tournamentRosters.managerId, managerId));

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
