import { Router } from "express";
import { loadSimVersion } from "../db/dal/sim.js";

const router = Router();

router.get("/version", async (_req, res) => {
  try {
    const version = await loadSimVersion();
    res.json(version);
  } catch (e) {
    res.status(500).json({ error: "Failed to load sim version" });
  }
});

export default router;
