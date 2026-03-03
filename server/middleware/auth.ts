import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { db } from "../db/index.js";
import { users, managers } from "../db/schema/index.js";
import { eq } from "drizzle-orm";

export interface ManagerRecord {
  id: number;           // users.id
  supabaseUserId: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

export interface AuthenticatedRequest extends Request {
  manager?: ManagerRecord;
  supabaseUserId?: string;
}

/**
 * Verifies the Supabase JWT and attaches the user record to req.manager.
 * Returns 401 if no valid token or no user record found.
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  let [user] = await db.select().from(users)
    .where(eq(users.supabaseUserId, data.user.id));

  // Migration fallback: if no user found by supabase ID, try matching by email
  // and link the real supabase ID to the existing seeded user record
  if (!user && data.user.email) {
    const [byEmail] = await db.select().from(users)
      .where(eq(users.email, data.user.email));
    if (byEmail) {
      await db.update(users)
        .set({ supabaseUserId: data.user.id })
        .where(eq(users.id, byEmail.id));
      user = { ...byEmail, supabaseUserId: data.user.id };
    }
  }

  // Auto-create user record if JWT is valid but no users row exists
  if (!user) {
    const [created] = await db.insert(users).values({
      supabaseUserId: data.user.id,
      email: data.user.email ?? "",
      name: data.user.user_metadata?.display_name ?? data.user.email?.split("@")[0] ?? "User",
    }).returning();
    user = created;
  }

  // Check if user is commissioner in any league
  const [commish] = await db.select().from(managers)
    .where(eq(managers.userId, user.id));
  const isAdmin = commish?.isCommissioner ?? false;

  req.manager = {
    id: user.id,
    supabaseUserId: user.supabaseUserId,
    email: user.email,
    displayName: user.name,
    isAdmin,
  };

  next();
}

/**
 * Verifies the Supabase JWT only (no user record required).
 * Used for the register endpoint where the user record doesn't exist yet.
 */
export async function requireSupabaseAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  const token = authHeader.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  req.supabaseUserId = data.user.id;
  next();
}

/**
 * Extends requireAuth — also checks that the user is an admin (commissioner).
 */
export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    if (!req.manager?.isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}
