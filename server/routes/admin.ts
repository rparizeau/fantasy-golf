import { Router } from "express";
import { asc, count, desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { leagues, users, managers, drafts } from "../db/schema/index.js";

// Mounted at /api/admin behind requireAdmin (see server/index.ts).
const router = Router();

type LeagueStatus = "Setup" | "Drafting" | "Active";

// There is no league status column yet, so derive it from the latest draft.
function deriveLeagueStatus(draftStatus: string | undefined): LeagueStatus {
  if (!draftStatus) return "Setup";
  return draftStatus === "complete" ? "Active" : "Drafting";
}

// GET /api/admin/leagues
router.get("/leagues", async (_req, res) => {
  try {
    const [leagueRows, managerCounts, draftRows] = await Promise.all([
      db
        .select({
          id: leagues.id,
          name: leagues.name,
          ownerName: users.name,
          ownerEmail: users.email,
        })
        .from(leagues)
        .innerJoin(users, eq(leagues.createdById, users.id))
        .orderBy(asc(leagues.name)),
      db
        .select({ leagueId: managers.leagueId, n: count() })
        .from(managers)
        .groupBy(managers.leagueId),
      db
        .select({ leagueId: drafts.leagueId, status: drafts.statusEnum })
        .from(drafts)
        .orderBy(desc(drafts.createdAt)),
    ]);

    const managersByLeague = new Map(managerCounts.map((r) => [r.leagueId, r.n]));
    // Rows are newest-first, so the first draft seen per league is the latest.
    const latestDraft = new Map<number, string>();
    for (const d of draftRows) {
      if (!latestDraft.has(d.leagueId)) latestDraft.set(d.leagueId, d.status);
    }

    res.json(
      leagueRows.map((l) => ({
        ...l,
        managerCount: managersByLeague.get(l.id) ?? 0,
        status: deriveLeagueStatus(latestDraft.get(l.id)),
      })),
    );
  } catch (e) {
    console.error("GET /api/admin/leagues failed", e);
    res.status(500).json({ error: "Failed to load leagues" });
  }
});

// GET /api/admin/users
router.get("/users", async (_req, res) => {
  try {
    const [userRows, teamCounts] = await Promise.all([
      db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .orderBy(asc(users.name)),
      db
        .select({ userId: managers.userId, n: count() })
        .from(managers)
        .groupBy(managers.userId),
    ]);

    const teamsByUser = new Map(teamCounts.map((r) => [r.userId, r.n]));
    res.json(userRows.map((u) => ({ ...u, teamCount: teamsByUser.get(u.id) ?? 0 })));
  } catch (e) {
    console.error("GET /api/admin/users failed", e);
    res.status(500).json({ error: "Failed to load users" });
  }
});

export default router;
