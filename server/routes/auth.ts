import { Router } from "express";
import { db } from "../db/index.js";
import { users, managers, leagues } from "../db/schema/index.js";
import { eq } from "drizzle-orm";
import { requireSupabaseAuth, requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

// POST /api/auth/register — create user record after Supabase signup
router.post("/register", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
  const { displayName, email } = req.body;

  if (!displayName || !email) {
    res.status(400).json({ error: "displayName and email are required" });
    return;
  }

  // Check if user already exists by supabase ID
  const [existing] = await db.select().from(users)
    .where(eq(users.supabaseUserId, req.supabaseUserId!));

  if (existing) {
    res.json({ id: existing.id, displayName: existing.name, email: existing.email, isAdmin: false });
    return;
  }

  // Migration fallback: match seeded user by email and link real supabase ID
  const [byEmail] = await db.select().from(users)
    .where(eq(users.email, email));

  if (byEmail) {
    await db.update(users)
      .set({ supabaseUserId: req.supabaseUserId! })
      .where(eq(users.id, byEmail.id));
    res.json({ id: byEmail.id, displayName: byEmail.name, email: byEmail.email, isAdmin: false });
    return;
  }

  const [user] = await db.insert(users).values({
    supabaseUserId: req.supabaseUserId!,
    email,
    name: displayName,
  }).returning();

  res.json({ id: user.id, displayName: user.name, email: user.email, isAdmin: false });
});

// GET /api/auth/me — return user profile + their managed leagues
router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.manager!;

  const managerRows = await db
    .select({
      managerId: managers.id,
      leagueId: managers.leagueId,
      leagueName: leagues.name,
      isCommissioner: managers.isCommissioner,
    })
    .from(managers)
    .innerJoin(leagues, eq(managers.leagueId, leagues.id))
    .where(eq(managers.userId, user.id));

  res.json({
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    isAdmin: user.isAdmin,
    teams: managerRows.map((m) => ({
      pk: m.managerId,
      leagueId: m.leagueId,
      teamId: m.managerId,
      teamName: m.leagueName,
    })),
  });
});

export default router;
