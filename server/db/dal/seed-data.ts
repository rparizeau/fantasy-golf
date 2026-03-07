import { db } from "../index.js";
import { golfers, tournaments, courses, payouts } from "../schema/index.js";
import { eq } from "drizzle-orm";

export async function loadGolfers() {
  const rows = await db.select().from(golfers).orderBy(golfers.ranking);
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    ranking: g.ranking,
    country: g.origin,
  }));
}

/** @deprecated Use loadGolfers() instead */
export const loadPlayers = loadGolfers;

export async function loadTournaments() {
  const rows = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      courseId: tournaments.courseId,
      courseName: courses.name,
      courseAddress: courses.address,
      courseHoles: courses.holes,
      purse: tournaments.purse,
      isMajor: tournaments.isMajor,
      colorCode: tournaments.colorCode,
      secondaryColorCode: tournaments.secondaryColorCode,
      startDate: tournaments.startDate,
      endDate: tournaments.endDate,
    })
    .from(tournaments)
    .innerJoin(courses, eq(tournaments.courseId, courses.id))
    .orderBy(tournaments.id);

  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    course: t.courseName,
    location: t.courseAddress ?? "",
    purse: t.purse,
    par: (t.courseHoles as number[]).reduce((s, h) => s + h, 0),
    isMajor: t.isMajor,
    current: false,
    color: t.colorCode,
    secondaryColor: t.secondaryColorCode,
    dates: { start: t.startDate, end: t.endDate },
  }));
}

/** Hardcoded PGA Tour payout percentages — no DB table needed. */
export function loadPayoutTable(): { position: number; pct: number }[] {
  return [
    { position: 1, pct: 18.0 }, { position: 2, pct: 10.9 }, { position: 3, pct: 6.9 },
    { position: 4, pct: 4.9 }, { position: 5, pct: 4.1 }, { position: 6, pct: 3.65 },
    { position: 7, pct: 3.4 }, { position: 8, pct: 3.15 }, { position: 9, pct: 2.95 },
    { position: 10, pct: 2.75 }, { position: 11, pct: 2.55 }, { position: 12, pct: 2.35 },
    { position: 13, pct: 2.15 }, { position: 14, pct: 1.95 }, { position: 15, pct: 1.8 },
    { position: 16, pct: 1.65 }, { position: 17, pct: 1.55 }, { position: 18, pct: 1.45 },
    { position: 19, pct: 1.35 }, { position: 20, pct: 1.25 }, { position: 21, pct: 1.15 },
    { position: 22, pct: 1.06 }, { position: 23, pct: 0.98 }, { position: 24, pct: 0.9 },
    { position: 25, pct: 0.84 }, { position: 26, pct: 0.78 }, { position: 27, pct: 0.75 },
    { position: 28, pct: 0.72 }, { position: 29, pct: 0.69 }, { position: 30, pct: 0.66 },
    { position: 31, pct: 0.62 }, { position: 32, pct: 0.58 }, { position: 33, pct: 0.54 },
    { position: 34, pct: 0.5 }, { position: 35, pct: 0.48 }, { position: 36, pct: 0.46 },
    { position: 37, pct: 0.44 }, { position: 38, pct: 0.42 }, { position: 39, pct: 0.4 },
    { position: 40, pct: 0.38 }, { position: 41, pct: 0.36 }, { position: 42, pct: 0.34 },
    { position: 43, pct: 0.32 }, { position: 44, pct: 0.3 }, { position: 45, pct: 0.282 },
    { position: 46, pct: 0.264 }, { position: 47, pct: 0.246 }, { position: 48, pct: 0.23 },
    { position: 49, pct: 0.216 }, { position: 50, pct: 0.208 }, { position: 51, pct: 0.202 },
    { position: 52, pct: 0.196 }, { position: 53, pct: 0.19 }, { position: 54, pct: 0.186 },
    { position: 55, pct: 0.182 }, { position: 56, pct: 0.178 }, { position: 57, pct: 0.174 },
    { position: 58, pct: 0.17 }, { position: 59, pct: 0.166 }, { position: 60, pct: 0.162 },
    { position: 61, pct: 0.158 }, { position: 62, pct: 0.154 }, { position: 63, pct: 0.15 },
    { position: 64, pct: 0.131 }, { position: 65, pct: 0.111 },
  ];
}

/** Load position-based point payouts from the DB. Pass isMajor to get the right column. */
export async function loadPayoutPoints(isMajor: boolean): Promise<{ position: number; points: number }[]> {
  const rows = await db.select({
    position: payouts.position,
    regularPoints: payouts.regularPoints,
    majorPoints: payouts.majorPoints,
  }).from(payouts).orderBy(payouts.position);
  return rows.map((r) => ({
    position: r.position,
    points: isMajor ? r.majorPoints : r.regularPoints,
  }));
}

export async function loadCourse(courseId: number) {
  const [row] = await db.select().from(courses).where(eq(courses.id, courseId));
  return row ?? null;
}

export async function loadAllCourses() {
  const rows = await db.select().from(courses);
  const map: Record<number, { name: string; holes: number[] }> = {};
  for (const row of rows) {
    map[row.id] = { name: row.name, holes: row.holes as number[] };
  }
  return map;
}
