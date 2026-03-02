import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const STATE_DIR = join(__dirname, "..", "state");
const SIM_ACTIVE_PATH = join(STATE_DIR, "sim-active.json");
const LEGACY_STATE_PATH = join(STATE_DIR, "sim-state.json");

function simTournamentPath(tournamentId: number): string {
  return join(STATE_DIR, `sim-tournament-${tournamentId}.json`);
}

// --- Types ---

export type Phase = "idle" | "round1" | "round2" | "cut" | "round3" | "round4" | "final";

export interface PlayerRound {
  playerId: number;
  name: string;
  country: string;
  ranking: number;
  rounds: number[];
  holeScores?: (number | null)[][];  // holeScores[roundIndex] = 18-element array, null = not yet played
  total: number;
  toPar: number;
  position: number;
  status: "active" | "cut" | "wd";
}

export interface SimState {
  phase: Phase;
  tournamentId: number;
  currentRound: number;
  par: number;
  holePars?: number[];  // 18-element array of per-hole pars
  players: PlayerRound[];
  cutLine: number | null;
  fieldSize: number;
  overrides: Record<number, { score?: number; wd?: boolean }>;
  earningsAccumulated?: boolean;
}

interface SeedPlayer {
  id: number;
  name: string;
  ranking: number;
  country: string;
}

interface SeedTournament {
  id: number;
  name: string;
  course: string;
  location: string;
  purse: number;
  par: number;
  isMajor: boolean;
  current?: boolean;
  dates: { start: string; end: string };
}

// --- Helpers ---

function loadJSON<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8"));
}

// --- Migration ---
// If old sim-state.json exists and no per-tournament files, migrate it.

function migrateLegacyState(): void {
  if (!existsSync(LEGACY_STATE_PATH)) return;
  if (existsSync(SIM_ACTIVE_PATH)) return; // already migrated

  try {
    const legacy = loadJSON<SimState>(LEGACY_STATE_PATH);
    writeFileSync(simTournamentPath(legacy.tournamentId), JSON.stringify(legacy, null, 2));
    writeFileSync(SIM_ACTIVE_PATH, JSON.stringify({ activeTournamentId: legacy.tournamentId }, null, 2));
    unlinkSync(LEGACY_STATE_PATH);
  } catch {
    // If migration fails, we'll create fresh state on next load
  }
}

// Run migration on module load
migrateLegacyState();

// --- Active Tournament ---

export function getActiveTournamentId(): number {
  try {
    const data = JSON.parse(readFileSync(SIM_ACTIVE_PATH, "utf-8"));
    return data.activeTournamentId;
  } catch {
    // Default to first tournament
    const tournaments = loadTournaments();
    const first = tournaments.find((t) => t.current) || tournaments[0];
    setActiveTournamentId(first.id);
    return first.id;
  }
}

export function setActiveTournamentId(tournamentId: number): void {
  writeFileSync(SIM_ACTIVE_PATH, JSON.stringify({ activeTournamentId: tournamentId }, null, 2));
}

// --- State Load / Save ---

export function saveState(state: SimState): void {
  writeFileSync(simTournamentPath(state.tournamentId), JSON.stringify(state, null, 2));
}

/** Load the active tournament's sim state. */
export function loadState(): SimState {
  const id = getActiveTournamentId();
  return loadTournamentState(id);
}

/** Load a specific tournament's sim state (for viewing past results). */
export function loadTournamentState(tournamentId: number): SimState {
  try {
    return loadJSON<SimState>(simTournamentPath(tournamentId));
  } catch {
    return createFreshState(tournamentId);
  }
}

export function loadPlayers(): SeedPlayer[] {
  return loadJSON<SeedPlayer[]>(join(DATA_DIR, "players.json"));
}

export function loadTournaments(): SeedTournament[] {
  return loadJSON<SeedTournament[]>(join(DATA_DIR, "tournaments.json"));
}

export function loadPayoutTable(): { position: number; pct: number }[] {
  return loadJSON<{ position: number; pct: number }[]>(join(DATA_DIR, "payout-table.json"));
}

/** Returns the tournament metadata for the active sim tournament. */
export function getCurrentTournament(): SeedTournament {
  const tournaments = loadTournaments();
  const activeId = getActiveTournamentId();
  return tournaments.find((t) => t.id === activeId) || tournaments[0];
}

// Box-Muller transform for normal distribution
function randomNormal(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
}

function generateRoundScore(par: number, ranking: number): number {
  // Better ranked players skew lower. Rank 1 averages ~2 under par, rank 100 ~2 over.
  const rankingBonus = -2 + (ranking - 1) * (4 / 99);
  const mean = par + rankingBonus;
  const stddev = 2.8;
  const raw = randomNormal(mean, stddev);
  return Math.round(raw);
}

// --- Course / Hole Scoring ---

interface CourseData {
  course: string;
  holes: number[];
}

function loadCourses(): Record<string, CourseData> {
  try {
    return loadJSON<Record<string, CourseData>>(join(DATA_DIR, "courses.json"));
  } catch {
    return {};
  }
}

/** Generate a synthetic par layout when no course data exists. */
function defaultHolePars(par: number): number[] {
  // Start with all par-4s, then distribute remaining strokes
  const holes = new Array(18).fill(4);
  let remaining = par - 72; // deviation from 72 (all 4s)
  // Add two par-5s and two par-3s at common positions
  holes[1] = 5; holes[8] = 5; // holes 2, 9
  holes[2] = 3; holes[6] = 3; // holes 3, 7
  // That keeps sum at 72. Adjust if par differs.
  if (remaining > 0) {
    // Need more strokes — bump some par-4s to par-5s
    const candidates = [4, 13, 17];
    for (const i of candidates) {
      if (remaining <= 0) break;
      holes[i] = 5;
      remaining--;
    }
  } else if (remaining < 0) {
    // Need fewer strokes — convert some par-4s to par-3s
    const candidates = [11, 15, 3];
    for (const i of candidates) {
      if (remaining >= 0) break;
      holes[i] = 3;
      remaining++;
    }
  }
  return holes;
}

/** Generate 18 hole scores with realistic birdie/par/bogey distribution. */
function generateHoleScores(holePars: number[], ranking: number): number[] {
  // Skill factor: rank 1 = 1.0 (best), rank 100 = 0.0 (worst)
  const skill = 1 - (ranking - 1) / 99;

  // Scale probabilities by skill — top players birdie more, bogey less
  // Plus random "hot/cold" factor for round-to-round variance
  const hotCold = randomNormal(0, 0.08); // adds ±8% swing per round
  const birdieBoost = Math.max(0, skill * 0.18 + hotCold);  // rank 1 ≈ +18%, rank 100 ≈ 0%
  const bogeyReduce = Math.max(0, skill * 0.14 + hotCold);  // rank 1 ≈ -14% bogey, rank 100 ≈ 0%

  const scores: number[] = [];
  for (const par of holePars) {
    const r = Math.random();
    let score: number;
    if (par === 3) {
      const birdie = 0.05 + birdieBoost * 0.6;
      const bogey = Math.max(0.05, 0.25 - bogeyReduce);
      const dbl = Math.max(0.01, 0.05 - bogeyReduce * 0.3);
      if (r < birdie) score = par - 1;
      else if (r < birdie + (1 - birdie - bogey - dbl)) score = par;
      else if (r < 1 - dbl) score = par + 1;
      else score = par + 2;
    } else if (par === 5) {
      const eagle = 0.02 + birdieBoost * 0.15;
      const birdie = 0.15 + birdieBoost * 0.8;
      const bogey = Math.max(0.05, 0.23 - bogeyReduce);
      const dbl = Math.max(0.01, 0.05 - bogeyReduce * 0.3);
      if (r < eagle) score = par - 2;
      else if (r < eagle + birdie) score = par - 1;
      else if (r < eagle + birdie + (1 - eagle - birdie - bogey - dbl)) score = par;
      else if (r < 1 - dbl) score = par + 1;
      else score = par + 2;
    } else {
      const eagle = 0.005 + birdieBoost * 0.02;
      const birdie = 0.10 + birdieBoost;
      const bogey = Math.max(0.05, 0.24 - bogeyReduce);
      const dbl = Math.max(0.01, 0.05 - bogeyReduce * 0.3);
      if (r < eagle) score = par - 2;
      else if (r < eagle + birdie) score = par - 1;
      else if (r < eagle + birdie + (1 - eagle - birdie - bogey - dbl)) score = par;
      else if (r < 1 - dbl) score = par + 1;
      else score = par + 2;
    }
    scores.push(score);
  }

  return scores;
}

function rankPlayers(players: PlayerRound[], par: number, _totalRounds: number): void {
  // Active players ranked by score, then WD, then cut
  const active = players.filter((p) => p.status === "active");
  const wd = players.filter((p) => p.status === "wd");
  const cut = players.filter((p) => p.status === "cut");

  // Split active into scored (have rounds) and unscored
  const scored = active.filter((p) => p.rounds.length > 0);
  const unscored = active.filter((p) => p.rounds.length === 0);

  scored.sort((a, b) => a.total - b.total || a.ranking - b.ranking);

  let pos = 1;
  for (let i = 0; i < scored.length; i++) {
    if (i > 0 && scored[i].total > scored[i - 1].total) {
      pos = i + 1;
    }
    scored[i].position = pos;
    scored[i].toPar = scored[i].total - par * scored[i].rounds.length;
  }

  // Unscored players sort by world ranking, positioned after scored players
  unscored.sort((a, b) => a.ranking - b.ranking);
  const unscoredStart = scored.length + 1;
  for (let i = 0; i < unscored.length; i++) {
    unscored[i].position = unscoredStart + i;
    unscored[i].toPar = 0;
  }

  // WD players get position after active players
  wd.sort((a, b) => a.total - b.total || a.ranking - b.ranking);
  let wdPos = active.length + 1;
  for (let i = 0; i < wd.length; i++) {
    wd[i].position = wdPos + i;
    wd[i].toPar = wd[i].total - par * wd[i].rounds.length;
  }

  // Cut players get position after WD players
  cut.sort((a, b) => a.total - b.total || a.ranking - b.ranking);
  let cutPos = active.length + wd.length + 1;
  for (let i = 0; i < cut.length; i++) {
    if (i > 0 && cut[i].total > cut[i - 1].total) {
      cutPos = active.length + wd.length + i + 1;
    }
    cut[i].position = cutPos;
    cut[i].toPar = cut[i].total - par * 2;
  }

  // Rebuild array: scored → unscored → wd → cut
  const sorted = [...scored, ...unscored, ...wd, ...cut];
  players.length = 0;
  players.push(...sorted);
}

// --- Core Engine ---

export function createFreshState(tournamentId: number): SimState {
  const players = loadPlayers();
  const tournaments = loadTournaments();
  const tournament = tournaments.find((t) => t.id === tournamentId) || tournaments[0];

  // Load hole pars from courses.json, falling back to a synthetic layout
  const courses = loadCourses();
  const courseData = courses[String(tournament.id)];
  const holePars = courseData ? courseData.holes : defaultHolePars(tournament.par);

  const state: SimState = {
    phase: "idle",
    tournamentId: tournament.id,
    currentRound: 0,
    par: tournament.par,
    holePars,
    players: players.map((p) => ({
      playerId: p.id,
      name: p.name,
      country: p.country,
      ranking: p.ranking,
      rounds: [],
      holeScores: [],
      total: 0,
      toPar: 0,
      position: p.ranking,
      status: "active",
    })),
    cutLine: null,
    fieldSize: players.length,
    overrides: {},
  };

  saveState(state);
  return state;
}

const PHASE_ORDER: Phase[] = ["idle", "round1", "round2", "cut", "round3", "round4", "final"];

export function advance(state: SimState): SimState {
  const currentIdx = PHASE_ORDER.indexOf(state.phase);
  if (currentIdx === -1 || currentIdx >= PHASE_ORDER.length - 1) {
    return state; // Already at final
  }

  const nextPhase = PHASE_ORDER[currentIdx + 1];

  if (nextPhase === "round1" || nextPhase === "round2" || nextPhase === "round3" || nextPhase === "round4") {
    // Generate scores for active (non-cut, non-wd) players
    const roundNum = parseInt(nextPhase.replace("round", ""));
    const holePars = state.holePars ?? defaultHolePars(state.par);
    for (const player of state.players) {
      if (player.status !== "active") continue;

      // Check for overrides
      const override = state.overrides[player.playerId];
      if (override?.wd) {
        player.status = "wd";
        continue;
      }

      if (override?.score != null) {
        // Override with a flat round score — no hole detail
        player.rounds.push(override.score);
      } else {
        // Generate per-hole scores
        const holes = generateHoleScores(holePars, player.ranking);
        if (!player.holeScores) player.holeScores = [];
        player.holeScores.push(holes);
        const roundTotal = holes.reduce((sum, s) => sum + s, 0);
        player.rounds.push(roundTotal);
      }
      player.total = player.rounds.reduce((sum, s) => sum + s, 0);
    }

    state.currentRound = roundNum;
    state.phase = nextPhase;
    state.overrides = {};

    rankPlayers(state.players, state.par, roundNum);
  } else if (nextPhase === "cut") {
    // Apply cut: top 65 + ties after round 2
    const activePlayers = state.players.filter((p) => p.status === "active");
    activePlayers.sort((a, b) => a.total - b.total || a.ranking - b.ranking);

    if (activePlayers.length > 65) {
      // Find the score at position 65
      const cutScore = activePlayers[64].total;
      state.cutLine = cutScore;

      for (const player of activePlayers) {
        if (player.total > cutScore) {
          player.status = "cut";
        }
      }
    }

    state.phase = "cut";
    rankPlayers(state.players, state.par, 2);
  } else if (nextPhase === "final") {
    state.phase = "final";
    rankPlayers(state.players, state.par, 4);
  }

  saveState(state);
  return state;
}

/** Undo the most recent phase transition. */
export function rewind(state: SimState): SimState {
  const currentIdx = PHASE_ORDER.indexOf(state.phase);
  if (currentIdx <= 0) return state; // Already at idle

  if (state.phase === "final") {
    state.phase = "round4";
  } else if (state.phase === "cut") {
    // Undo cut — restore cut players to active
    for (const player of state.players) {
      if (player.status === "cut") player.status = "active";
    }
    state.cutLine = null;
    state.phase = "round2";
    rankPlayers(state.players, state.par, 2);
  } else {
    // Undo a round — strip last round from active players
    for (const player of state.players) {
      if (player.status !== "active" && player.status !== "wd") continue;
      // Only strip if player actually has this round's data
      if (player.rounds.length >= state.currentRound) {
        player.rounds.pop();
        if (player.holeScores && player.holeScores.length > 0) player.holeScores.pop();
        player.total = player.rounds.reduce((sum, s) => sum + s, 0);
      }
      // Restore WD players from this round back to active
      if (player.status === "wd" && player.rounds.length === state.currentRound - 1) {
        player.status = "active";
      }
    }
    state.currentRound--;
    state.phase = PHASE_ORDER[currentIdx - 1];
    if (state.currentRound > 0) {
      rankPlayers(state.players, state.par, state.currentRound);
    }
  }

  saveState(state);
  return state;
}

export function setOverride(
  state: SimState,
  playerId: number,
  override: { score?: number; wd?: boolean }
): SimState {
  state.overrides[playerId] = { ...state.overrides[playerId], ...override };
  saveState(state);
  return state;
}

/** Directly update a player's rounds and status, then re-rank. */
export function updatePlayer(
  state: SimState,
  playerId: number,
  updates: { rounds?: (number | null)[]; status?: "active" | "cut" | "wd"; holeScores?: ((number | null)[] | null)[] }
): SimState {
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) return state;

  if (updates.status) player.status = updates.status;

  if (updates.holeScores) {
    // Update only the rounds that were sent (non-null). null = "no change".
    if (!player.holeScores) player.holeScores = [];
    for (let i = 0; i < updates.holeScores.length; i++) {
      const holes = updates.holeScores[i];
      if (holes != null) {
        player.holeScores[i] = holes;
      }
    }
    // Trim any trailing empty entries (no real data)
    while (player.holeScores.length > 0) {
      const last = player.holeScores[player.holeScores.length - 1];
      if (!last || last.length === 0 || last.every((h) => h == null)) {
        player.holeScores.pop();
      } else {
        break;
      }
    }
    // Recompute rounds from holeScores — only sum non-null holes per round
    const newRounds: number[] = [];
    let totalScored = 0;
    for (let i = 0; i < player.holeScores.length; i++) {
      const roundHoles = player.holeScores[i];
      const scored = roundHoles.filter((s): s is number => s != null);
      if (scored.length > 0) {
        const roundTotal = scored.reduce((sum, s) => sum + s, 0);
        newRounds.push(roundTotal);
        totalScored += roundTotal;
      }
    }
    player.rounds = newRounds;
    player.total = totalScored;
    // toPar based on the par of holes actually scored
    const holePars = state.holePars ?? defaultHolePars(state.par);
    let parForScored = 0;
    for (let i = 0; i < player.holeScores.length; i++) {
      for (let h = 0; h < player.holeScores[i].length; h++) {
        if (player.holeScores[i][h] != null) {
          parForScored += holePars[h] ?? 4;
        }
      }
    }
    player.toPar = totalScored - parForScored;
  } else if (updates.rounds) {
    const newRounds: number[] = [];
    for (let i = 0; i < 4; i++) {
      const val = updates.rounds[i];
      if (val != null) {
        newRounds.push(val);
      } else if (player.rounds[i] != null) {
        newRounds.push(player.rounds[i]);
      }
    }
    player.rounds = newRounds;
    player.total = newRounds.reduce((sum, s) => sum + s, 0);
    player.toPar = player.total - state.par * newRounds.length;
  }

  const roundCount = Math.max(...state.players.filter((p) => p.status === "active").map((p) => p.rounds.length), 0);
  rankPlayers(state.players, state.par, roundCount || state.currentRound);
  saveState(state);
  return state;
}

/**
 * Reset or switch tournaments.
 * - If tournamentId differs from active: switch to it (loads existing state or creates fresh).
 * - If tournamentId is same or omitted: force-reset the current tournament.
 */
export function reset(tournamentId?: number): SimState {
  const activeId = getActiveTournamentId();
  const targetId = tournamentId ?? activeId;

  if (targetId !== activeId) {
    // Switching tournaments — preserve old data, load or create new
    setActiveTournamentId(targetId);
    try {
      return loadJSON<SimState>(simTournamentPath(targetId));
    } catch {
      return createFreshState(targetId);
    }
  }

  // Same tournament — force reset
  return createFreshState(targetId);
}

export function formatScore(toPar: number): string {
  if (toPar === 0) return "E";
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}
