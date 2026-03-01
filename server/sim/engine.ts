import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const STATE_DIR = join(__dirname, "..", "state");
const SIM_STATE_PATH = join(STATE_DIR, "sim-state.json");

// --- Types ---

export type Phase = "idle" | "round1" | "round2" | "cut" | "round3" | "round4" | "final";

export interface PlayerRound {
  playerId: number;
  name: string;
  country: string;
  ranking: number;
  rounds: number[];
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
  players: PlayerRound[];
  cutLine: number | null;
  fieldSize: number;
  overrides: Record<number, { score?: number; wd?: boolean }>;
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
  dates: { start: string; end: string };
}

// --- Helpers ---

function loadJSON<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function saveState(state: SimState): void {
  writeFileSync(SIM_STATE_PATH, JSON.stringify(state, null, 2));
}

export function loadState(): SimState {
  try {
    return loadJSON<SimState>(SIM_STATE_PATH);
  } catch {
    return createFreshState(1);
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

function rankPlayers(players: PlayerRound[], par: number, totalRounds: number): void {
  // Active players ranked by score, then WD, then cut
  const active = players.filter((p) => p.status === "active");
  const wd = players.filter((p) => p.status === "wd");
  const cut = players.filter((p) => p.status === "cut");

  active.sort((a, b) => a.total - b.total || a.ranking - b.ranking);

  let pos = 1;
  for (let i = 0; i < active.length; i++) {
    if (i > 0 && active[i].total > active[i - 1].total) {
      pos = i + 1;
    }
    active[i].position = pos;
    active[i].toPar = active[i].total - par * totalRounds;
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

  // Rebuild array in position order
  const sorted = [...active, ...wd, ...cut];
  players.length = 0;
  players.push(...sorted);
}

// --- Core Engine ---

export function createFreshState(tournamentId: number): SimState {
  const players = loadPlayers();
  const tournaments = loadTournaments();
  const tournament = tournaments.find((t) => t.id === tournamentId) || tournaments[0];

  const state: SimState = {
    phase: "idle",
    tournamentId: tournament.id,
    currentRound: 0,
    par: tournament.par,
    players: players.map((p) => ({
      playerId: p.id,
      name: p.name,
      country: p.country,
      ranking: p.ranking,
      rounds: [],
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
    for (const player of state.players) {
      if (player.status !== "active") continue;

      // Check for overrides
      const override = state.overrides[player.playerId];
      if (override?.wd) {
        player.status = "wd";
        continue;
      }

      const score = override?.score ?? generateRoundScore(state.par, player.ranking);
      player.rounds.push(score);
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

export function setOverride(
  state: SimState,
  playerId: number,
  override: { score?: number; wd?: boolean }
): SimState {
  state.overrides[playerId] = { ...state.overrides[playerId], ...override };
  saveState(state);
  return state;
}

export function reset(tournamentId?: number): SimState {
  const state = loadState();
  return createFreshState(tournamentId ?? state.tournamentId);
}

export function formatScore(toPar: number): string {
  if (toPar === 0) return "E";
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}
