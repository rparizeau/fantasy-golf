// Pure simulation engine — no I/O, no file system access.
// All state is passed in and returned; persistence is handled by the DAL.

// --- Types ---

export type Phase = "idle" | "round1" | "round2" | "cut" | "round3" | "round4" | "final";

export interface PlayerRound {
  playerId: number;
  name: string;
  country: string;
  ranking: number;
  rounds: number[];
  holeScores?: (number | null)[][];
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
  holePars?: number[];
  players: PlayerRound[];
  cutLine: number | null;
  fieldSize: number;
  overrides: Record<number, { score?: number; wd?: boolean }>;
  earningsAccumulated?: boolean;
  pointsAccumulated?: boolean;
}

// --- Scoring Settings ---

/** Keyed by scoring_events.key (snake_case). */
export type ScoringSettings = Record<string, number>;

export const DEFAULT_SCORING: ScoringSettings = {
  albatross: 10, eagle: 6, birdie: 3, par: 1,
  bogey: 0, double_bogey: -1, triple_bogey_plus: -2,
  hole_in_one: 8,
};

/** Map a single hole score to points based on diff from par, plus hole-in-one bonus. */
export function holeToPoints(holeScore: number, holePar: number, scoring: ScoringSettings): number {
  const diff = holeScore - holePar;
  let base: number;
  if (diff <= -3) base = scoring.albatross ?? 0;
  else if (diff === -2) base = scoring.eagle ?? 0;
  else if (diff === -1) base = scoring.birdie ?? 0;
  else if (diff === 0) base = scoring.par ?? 0;
  else if (diff === 1) base = scoring.bogey ?? 0;
  else if (diff === 2) base = scoring.double_bogey ?? 0;
  else base = scoring.triple_bogey_plus ?? 0;

  // Hole-in-one bonus (score of 1 on any hole)
  if (holeScore === 1) base += scoring.hole_in_one ?? 0;

  return base;
}

/** Sum points across all rounds of hole scores. */
export function calculatePlayerPoints(
  holeScores: (number | null)[][] | undefined,
  holePars: number[],
  scoring: ScoringSettings,
): number {
  if (!holeScores || holeScores.length === 0) return 0;
  let total = 0;
  for (const round of holeScores) {
    for (let h = 0; h < round.length; h++) {
      const score = round[h];
      if (score != null) {
        total += holeToPoints(score, holePars[h] ?? 4, scoring);
      }
    }
  }
  return total;
}

/** Points broken down per round. */
export function calculateRoundPoints(
  holeScores: (number | null)[][] | undefined,
  holePars: number[],
  scoring: ScoringSettings,
): number[] {
  if (!holeScores || holeScores.length === 0) return [];
  return holeScores.map((round) => {
    let total = 0;
    for (let h = 0; h < round.length; h++) {
      const score = round[h];
      if (score != null) {
        total += holeToPoints(score, holePars[h] ?? 4, scoring);
      }
    }
    return total;
  });
}

// --- Helpers ---

/** Generate a synthetic par layout when no course data exists. */
function defaultHolePars(par: number): number[] {
  const holes = new Array(18).fill(4);
  let remaining = par - 72;
  holes[1] = 5; holes[8] = 5;
  holes[2] = 3; holes[6] = 3;
  if (remaining > 0) {
    const candidates = [4, 13, 17];
    for (const i of candidates) {
      if (remaining <= 0) break;
      holes[i] = 5;
      remaining--;
    }
  } else if (remaining < 0) {
    const candidates = [11, 15, 3];
    for (const i of candidates) {
      if (remaining >= 0) break;
      holes[i] = 3;
      remaining++;
    }
  }
  return holes;
}

// Box-Muller transform for normal distribution
function randomNormal(mean: number, stddev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stddev;
}

/** Generate 18 hole scores with realistic birdie/par/bogey distribution. */
function generateHoleScores(holePars: number[], ranking: number): number[] {
  const skill = 1 - (ranking - 1) / 99;
  const hotCold = randomNormal(0, 0.08);
  const birdieBoost = Math.max(0, skill * 0.18 + hotCold);
  const bogeyReduce = Math.max(0, skill * 0.14 + hotCold);

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
  const active = players.filter((p) => p.status === "active");
  const wd = players.filter((p) => p.status === "wd");
  const cut = players.filter((p) => p.status === "cut");

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

  unscored.sort((a, b) => a.ranking - b.ranking);
  const unscoredStart = scored.length + 1;
  for (let i = 0; i < unscored.length; i++) {
    unscored[i].position = unscoredStart + i;
    unscored[i].toPar = 0;
  }

  wd.sort((a, b) => a.total - b.total || a.ranking - b.ranking);
  let wdPos = active.length + 1;
  for (let i = 0; i < wd.length; i++) {
    wd[i].position = wdPos + i;
    wd[i].toPar = wd[i].total - par * wd[i].rounds.length;
  }

  cut.sort((a, b) => a.total - b.total || a.ranking - b.ranking);
  let cutPos = active.length + wd.length + 1;
  for (let i = 0; i < cut.length; i++) {
    if (i > 0 && cut[i].total > cut[i - 1].total) {
      cutPos = active.length + wd.length + i + 1;
    }
    cut[i].position = cutPos;
    cut[i].toPar = cut[i].total - par * 2;
  }

  const sorted = [...scored, ...unscored, ...wd, ...cut];
  players.length = 0;
  players.push(...sorted);
}

// --- Core Engine (pure functions — mutate state in-memory, caller persists) ---

const PHASE_ORDER: Phase[] = ["idle", "round1", "round2", "cut", "round3", "round4", "final"];

export function advance(state: SimState): SimState {
  const currentIdx = PHASE_ORDER.indexOf(state.phase);
  if (currentIdx === -1 || currentIdx >= PHASE_ORDER.length - 1) {
    return state;
  }

  const nextPhase = PHASE_ORDER[currentIdx + 1];

  if (nextPhase === "round1" || nextPhase === "round2" || nextPhase === "round3" || nextPhase === "round4") {
    const roundNum = parseInt(nextPhase.replace("round", ""));
    const holePars = state.holePars ?? defaultHolePars(state.par);
    for (const player of state.players) {
      if (player.status !== "active") continue;

      const override = state.overrides[player.playerId];
      if (override?.wd) {
        player.status = "wd";
        continue;
      }

      if (override?.score != null) {
        player.rounds.push(override.score);
      } else {
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
    const activePlayers = state.players.filter((p) => p.status === "active");
    activePlayers.sort((a, b) => a.total - b.total || a.ranking - b.ranking);

    if (activePlayers.length > 65) {
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

  return state;
}

export function rewind(state: SimState): SimState {
  const currentIdx = PHASE_ORDER.indexOf(state.phase);
  if (currentIdx <= 0) return state;

  if (state.phase === "final") {
    state.phase = "round4";
  } else if (state.phase === "cut") {
    for (const player of state.players) {
      if (player.status === "cut") player.status = "active";
    }
    state.cutLine = null;
    state.phase = "round2";
    rankPlayers(state.players, state.par, 2);
  } else {
    for (const player of state.players) {
      if (player.status !== "active" && player.status !== "wd") continue;
      if (player.rounds.length >= state.currentRound) {
        player.rounds.pop();
        if (player.holeScores && player.holeScores.length > 0) player.holeScores.pop();
        player.total = player.rounds.reduce((sum, s) => sum + s, 0);
      }
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

  return state;
}

export function setOverride(
  state: SimState,
  playerId: number,
  override: { score?: number; wd?: boolean }
): SimState {
  state.overrides[playerId] = { ...state.overrides[playerId], ...override };
  return state;
}

export function updatePlayer(
  state: SimState,
  playerId: number,
  updates: { rounds?: (number | null)[]; status?: "active" | "cut" | "wd"; holeScores?: ((number | null)[] | null)[] }
): SimState {
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) return state;

  if (updates.status) player.status = updates.status;

  if (updates.holeScores) {
    if (!player.holeScores) player.holeScores = [];
    for (let i = 0; i < updates.holeScores.length; i++) {
      const holes = updates.holeScores[i];
      if (holes != null) {
        player.holeScores[i] = holes;
      }
    }
    while (player.holeScores.length > 0) {
      const last = player.holeScores[player.holeScores.length - 1];
      if (!last || last.length === 0 || last.every((h) => h == null)) {
        player.holeScores.pop();
      } else {
        break;
      }
    }
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
  return state;
}

export function formatScore(toPar: number): string {
  if (toPar === 0) return "E";
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}
