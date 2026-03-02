import type { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase-admin.js";
import { db } from "../db/index.js";
import { managers } from "../db/schema/index.js";
import { eq } from "drizzle-orm";

export interface ManagerRecord {
  id: number;
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
 * Verifies the Supabase JWT and attaches the manager record to req.manager.
 * Returns 401 if no valid token or no manager record found.
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

  const [manager] = await db.select().from(managers)
    .where(eq(managers.supabaseUserId, data.user.id));

  if (!manager) {
    res.status(401).json({ error: "No manager profile found — please register first" });
    return;
  }

  req.manager = {
    id: manager.id,
    supabaseUserId: manager.supabaseUserId,
    email: manager.email,
    displayName: manager.displayName,
    isAdmin: manager.isAdmin,
  };

  next();
}

/**
 * Verifies the Supabase JWT only (no manager record required).
 * Used for the register endpoint where the manager record doesn't exist yet.
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
 * Extends requireAuth — also checks that the manager is an admin.
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
