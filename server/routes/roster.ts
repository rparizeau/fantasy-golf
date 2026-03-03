import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/league/:id/team/:teamId/mulligan — mulligan status
router.get("/:id/team/:teamId/mulligan", async (_req, res) => {
  res.json({
    windowOpen: false,
    remaining: 0,
    eligiblePlayers: [],
    isMajor: false,
    message: "Mulligans are not available in the current version",
  });
});

// POST /api/league/:id/team/:teamId/mulligan — activate mulligan on a player
router.post("/:id/team/:teamId/mulligan", async (_req: AuthenticatedRequest, res) => {
  res.status(403).json({ error: "Mulligans are not available in the current version" });
});

export default router;
