import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import simRoutes from "./routes/sim.js";
import adminRoutes from "./routes/admin.js";
import simVersionRoutes from "./routes/sim-version.js";
import tournamentRoutes from "./routes/tournament.js";
import leagueRoutes from "./routes/league.js";
import playerRoutes from "./routes/players.js";
import standingsRoutes from "./routes/standings.js";
import chatRoutes from "./routes/chat.js";
import rosterRoutes from "./routes/roster.js";
import playerDetailRoutes from "./routes/player.js";
import leagueCreateRoutes from "./routes/league-create.js";
import { requireAuth, requireAdmin } from "./middleware/auth.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/sim", requireAuth, simVersionRoutes);
// Admin namespace — everything under /api/admin requires an admin.
app.use("/api/admin/simulator", requireAdmin, simRoutes);
app.use("/api/admin", requireAdmin, adminRoutes);
app.use("/api/tournament", tournamentRoutes);
app.use("/api/league", requireAuth, leagueRoutes);
app.use("/api/league", requireAuth, playerRoutes);
app.use("/api/league", requireAuth, standingsRoutes);
app.use("/api/league", requireAuth, chatRoutes);
app.use("/api/league", requireAuth, rosterRoutes);
app.use("/api/league", requireAuth, leagueCreateRoutes);
app.use("/api", requireAuth, leagueCreateRoutes);
app.use("/api/player", playerDetailRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== "production") {
  const PORT = 3001;
  app.listen(PORT, () => {
    console.log(`Fantasy Golf API running on http://localhost:${PORT}`);
  });
}

export default app;
