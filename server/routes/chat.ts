import { Router } from "express";
import { getLeague, getActivityFeed, getChatMessages, addChatMessage, getTeamByManagerAndLeague } from "../db/dal/league.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/league/:id/feed — activity feed
router.get("/:id/feed", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const feed = await getActivityFeed(league.id);
  // Map to match existing shape
  res.json(feed.map((f) => ({
    id: `feed-${f.id}`,
    type: f.type,
    message: f.message,
    timestamp: f.createdAt.toISOString(),
  })));
});

// GET /api/league/:id/chat — message history
router.get("/:id/chat", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const msgs = await getChatMessages(league.id);
  res.json(msgs.map((m) => ({
    id: `msg-${m.id}`,
    teamId: m.teamId,
    teamName: m.teamName,
    message: m.message,
    timestamp: m.createdAt.toISOString(),
  })));
});

// POST /api/league/:id/chat — send a message
router.post("/:id/chat", async (req: AuthenticatedRequest, res) => {
  const leagueId = Number(req.params.id);
  const league = await getLeague(leagueId);
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const myTeam = await getTeamByManagerAndLeague(req.manager!.id, leagueId);
  if (!myTeam) {
    res.status(403).json({ error: "You don't have a team in this league" });
    return;
  }

  const { message } = req.body;
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const msg = await addChatMessage(league.id, myTeam.pk, myTeam.teamName, message.trim());

  res.json({
    id: `msg-${msg.id}`,
    teamId: msg.teamId,
    teamName: msg.teamName,
    message: msg.message,
    timestamp: msg.createdAt.toISOString(),
  });
});

export default router;
