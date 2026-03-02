import { Router } from "express";
import { db } from "../db/index.js";
import { managers, teams } from "../db/schema/index.js";
import { eq } from "drizzle-orm";
import { requireSupabaseAuth, requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

// POST /api/auth/register — create manager record after Supabase signup
router.post("/register", requireSupabaseAuth, async (req: AuthenticatedRequest, res) => {
  const { displayName, email } = req.body;

  if (!displayName || !email) {
    res.status(400).json({ error: "displayName and email are required" });
    return;
  }

  // Check if manager already exists
  const [existing] = await db.select().from(managers)
    .where(eq(managers.supabaseUserId, req.supabaseUserId!));

  if (existing) {
    res.json({ id: existing.id, displayName: existing.displayName, email: existing.email, isAdmin: existing.isAdmin });
    return;
  }

  const [manager] = await db.insert(managers).values({
    supabaseUserId: req.supabaseUserId!,
    email,
    displayName,
  }).returning();

  res.json({ id: manager.id, displayName: manager.displayName, email: manager.email, isAdmin: manager.isAdmin });
});

// GET /api/auth/me — return manager profile + their teams across leagues
router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  const manager = req.manager!;

  const teamRows = await db.select().from(teams)
    .where(eq(teams.managerId, manager.id));

  res.json({
    id: manager.id,
    displayName: manager.displayName,
    email: manager.email,
    isAdmin: manager.isAdmin,
    teams: teamRows.map((t) => ({
      pk: t.id,
      leagueId: t.leagueId,
      teamId: t.teamId,
      teamName: t.teamName,
    })),
  });
});

export default router;
