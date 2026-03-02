import { Router } from "express";
import { loadLeagueState, saveLeagueState } from "../lib/league-helpers.js";

const router = Router();

// GET /api/league/:id/feed — activity feed
router.get("/:id/feed", (req, res) => {
  const leagueState = loadLeagueState();
  const league = leagueState.leagues[req.params.id];
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  // Return feed sorted newest first
  const feed = [...league.activityFeed].reverse();
  res.json(feed);
});

// GET /api/league/:id/chat — message history
router.get("/:id/chat", (req, res) => {
  const leagueState = loadLeagueState();
  const league = leagueState.leagues[req.params.id];
  if (!league) {
    res.status(404).json({ error: "League not found" });
    return;
  }

  res.json(league.chatMessages);
});

// POST /api/league/:id/chat — send a message
router.post("/:id/chat", (req, res) => {
  const leagueState = loadLeagueState();
  const league = leagueState.leagues[req.params.id];
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
  const msg = {
    id: `msg-${Date.now()}`,
    teamId,
    teamName: team?.teamName || "Unknown",
    message: message.trim(),
    timestamp: new Date().toISOString(),
  };

  league.chatMessages.push(msg);
  saveLeagueState(leagueState);

  res.json(msg);
});

export default router;
