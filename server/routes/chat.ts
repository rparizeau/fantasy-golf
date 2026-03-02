import { Router } from "express";
import { getLeague, getActivityFeed, getChatMessages, addChatMessage } from "../db/dal/league.js";

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

  const messages = await getChatMessages(league.id);
  res.json(messages.map((m) => ({
    id: `msg-${m.id}`,
    teamId: m.teamId,
    teamName: m.teamName,
    message: m.message,
    timestamp: m.createdAt.toISOString(),
  })));
});

// POST /api/league/:id/chat — send a message
router.post("/:id/chat", async (req, res) => {
  const league = await getLeague(Number(req.params.id));
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  const { message, teamId = 1 } = req.body;
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const team = league.teams.find((t) => t.teamId === teamId);
  const msg = await addChatMessage(league.id, teamId, team?.teamName || "Unknown", message.trim());

  res.json({
    id: `msg-${msg.id}`,
    teamId: msg.teamId,
    teamName: msg.teamName,
    message: msg.message,
    timestamp: msg.createdAt.toISOString(),
  });
});

export default router;
