import { db } from "../index.js";
import { players, tournaments, courses, payouts } from "../schema/index.js";
import { eq } from "drizzle-orm";

export async function loadPlayers() {
  return db.select().from(players).orderBy(players.ranking);
}

export async function loadTournaments() {
  const rows = await db.select().from(tournaments).orderBy(tournaments.id);
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    course: t.course,
    location: t.location,
    purse: t.purse,
    par: t.par,
    isMajor: t.isMajor,
    current: t.isCurrent,
    color: t.color,
    dates: { start: t.dateStart, end: t.dateEnd },
  }));
}

export async function loadPayoutTable() {
  return db.select().from(payouts).orderBy(payouts.position);
}

export async function loadCourse(tournamentId: number) {
  const [row] = await db.select().from(courses).where(eq(courses.tournamentId, tournamentId));
  return row ?? null;
}

export async function loadAllCourses() {
  const rows = await db.select().from(courses);
  const map: Record<string, { course: string; holes: number[] }> = {};
  for (const row of rows) {
    map[String(row.tournamentId)] = { course: row.courseName, holes: row.holes };
  }
  return map;
}
