import { Router } from "express";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import {
  createLeague, getLeagueByInviteCode, joinLeague,
  getScoringEventDefaults, getSchedulePreview,
  type CreateLeagueParams,
} from "../db/dal/league-create.js";

const router = Router();

// POST /api/league/create
router.post("/create", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.manager!.id;
    const b = req.body;

    const params: CreateLeagueParams = {
      userId,
      name: b.name,
      teamName: b.teamName,
      managerCount: b.managerCount ?? 10,
      lineupCount: b.lineupCount ?? 4,
      benchCount: b.benchCount ?? 4,
      reserveCount: b.reserveCount ?? 0,
      scoring: b.scoring ?? [],
      waiverType: b.waiverType ?? "reverse_standings",
      faabBudget: b.faabBudget ?? 100,
      tradeVetoRule: b.tradeVetoRule ?? "none",
      weekCount: b.weekCount ?? 19,
      regularSeasonPoints: b.regularSeasonPoints ?? 500,
      majorSeasonPoints: b.majorSeasonPoints ?? 700,
      draftScheduledAt: b.draftScheduledAt ? new Date(b.draftScheduledAt) : undefined,
    };

    if (!params.name?.trim()) {
      res.status(400).json({ error: "League name is required" });
      return;
    }

    const result = await createLeague(params);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "Failed to create league" });
  }
});

// GET /api/league/invite/:code
router.get("/invite/:code", async (req: AuthenticatedRequest, res) => {
  try {
    const preview = await getLeagueByInviteCode(req.params.code);
    if (!preview) {
      res.status(404).json({ error: "Invalid invite code" });
      return;
    }
    res.json(preview);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/league/join
router.post("/join", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.manager!.id;
    const { inviteCode, teamName } = req.body;

    if (!inviteCode) {
      res.status(400).json({ error: "Invite code is required" });
      return;
    }

    const result = await joinLeague(userId, inviteCode, teamName);
    res.json(result);
  } catch (err: any) {
    const status = err.message.includes("Invalid") || err.message.includes("full") || err.message.includes("Already") || err.message.includes("Draft")
      ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/scoring-events
router.get("/scoring-events", async (_req: AuthenticatedRequest, res) => {
  try {
    const events = await getScoringEventDefaults();
    res.json({ events });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/tournaments/schedule-preview?weekCount=N
router.get("/tournaments/schedule-preview", async (req: AuthenticatedRequest, res) => {
  try {
    const weekCount = parseInt(req.query.weekCount as string) || 19;
    const tournaments = await getSchedulePreview(weekCount);
    res.json({ tournaments });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
