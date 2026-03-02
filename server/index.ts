import express from "express";
import cors from "cors";
import simRoutes from "./routes/sim.js";
import tournamentRoutes from "./routes/tournament.js";
import leagueRoutes from "./routes/league.js";
import playerRoutes from "./routes/players.js";
import standingsRoutes from "./routes/standings.js";
import chatRoutes from "./routes/chat.js";
import rosterRoutes from "./routes/roster.js";
import playerDetailRoutes from "./routes/player.js";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use("/api/sim", simRoutes);
app.use("/api/tournament", tournamentRoutes);
app.use("/api/league", leagueRoutes);
app.use("/api/league", playerRoutes);
app.use("/api/league", standingsRoutes);
app.use("/api/league", chatRoutes);
app.use("/api/league", rosterRoutes);
app.use("/api/player", playerDetailRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Fantasy Golf API running on http://localhost:${PORT}`);
});
