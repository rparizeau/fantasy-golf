const BASE = "/api";

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- Sim ---

export interface SimStatus {
  phase: string;
  tournamentId: number;
  currentRound: number;
  par: number;
  fieldSize: number;
  activePlayers: number;
  cutPlayers: number;
  wdPlayers: number;
  cutLine: number | null;
  overrides: Record<number, { score?: number; wd?: boolean }>;
}

export function getSimState() {
  return fetchJSON<SimStatus>("/sim/state");
}

export function advanceSim() {
  return fetchJSON<{ phase: string; currentRound: number; activePlayers?: number; cutPlayers?: number; cutLine?: number | null }>(
    "/sim/advance",
    { method: "POST" }
  );
}

export function setOverride(playerId: number, override: { score?: number; wd?: boolean }) {
  return fetchJSON<{ overrides: Record<number, unknown> }>("/sim/override", {
    method: "POST",
    body: JSON.stringify({ playerId, ...override }),
  });
}

export function updatePlayer(playerId: number, updates: { rounds?: (number | null)[]; status?: string; holeScores?: ((number | null)[] | null)[] }) {
  return fetchJSON<{ ok: boolean }>("/sim/player/update", {
    method: "POST",
    body: JSON.stringify({ playerId, ...updates }),
  });
}

export function resetSim(tournamentId?: number) {
  return fetchJSON<{ phase: string; tournamentId: number; fieldSize: number }>("/sim/reset", {
    method: "POST",
    body: JSON.stringify({ tournamentId }),
  });
}

// --- Tournament ---

export interface TournamentInfo {
  id: number;
  name: string;
  course: string;
  location: string;
  purse: number;
  par: number;
  isMajor: boolean;
  phase: string;
  currentRound: number;
  fieldSize: number;
  activePlayers: number;
  cutLine: number | null;
}

export interface LeaderboardPlayer {
  playerId: number;
  name: string;
  country: string;
  ranking: number;
  rounds: number[];
  holeScores?: (number | null)[][];
  total: number;
  toPar: number;
  toParDisplay: string;
  position: number;
  status: "active" | "cut" | "wd";
  earnings: number;
}

export interface Leaderboard {
  tournamentId: number;
  tournamentName: string;
  phase: string;
  currentRound: number;
  par: number;
  holePars?: number[];
  cutLine: number | null;
  players: LeaderboardPlayer[];
}

export function getTournament() {
  return fetchJSON<TournamentInfo>("/tournament/current");
}

export function getLeaderboard() {
  return fetchJSON<Leaderboard>("/tournament/leaderboard");
}

export interface TournamentListItem {
  id: number;
  name: string;
  course: string;
  location: string;
  purse: number;
  par: number;
  isMajor: boolean;
  current?: boolean;
}

export function getTournamentList() {
  return fetchJSON<TournamentListItem[]>("/tournament/list");
}

// --- Leagues (Lobby) ---

export interface LeagueSummary {
  id: number;
  name: string;
  team: string;
  rank: number;
  of: number;
  money: number;
  weekMoney: number;
  members: number;
  tournament: string;
  course: string;
  loc: string;
  purse: number;
  status: "live" | "done" | "upcoming";
  round: number;
  cut: string;
  phase: string;
}

export function getLeagues() {
  return fetchJSON<LeagueSummary[]>("/league/all");
}

// --- League (Build 2+) ---

export interface FantasyTeamSummary {
  teamId: number;
  teamName: string;
  managerName: string;
  totalEarnings: number;
  players: {
    playerId: number;
    name: string;
    position: number;
    toPar: number;
    toParDisplay: string;
    status: "active" | "cut" | "wd";
    earnings: number;
    isActive: boolean;
  }[];
}

export interface FantasyLeaderboard {
  leagueId: number;
  leagueName: string;
  tournamentName: string;
  phase: string;
  teams: FantasyTeamSummary[];
}

export function getFantasyLeaderboard(leagueId: number) {
  return fetchJSON<FantasyLeaderboard>(`/league/${leagueId}/leaderboard`);
}

export interface LeagueInfo {
  id: number;
  name: string;
  members: { teamId: number; teamName: string; managerName: string }[];
  settings: { rosterSize: number; activeSize: number; reserveSize: number; mulligansPerSeason: number };
}

export function getLeagueInfo(leagueId: number) {
  return fetchJSON<LeagueInfo>(`/league/${leagueId}`);
}

// --- Roster (Build 3+) ---

export interface RosterPlayer {
  playerId: number;
  name: string;
  country: string;
  ranking: number;
  isActive: boolean;
  inField: boolean;
  toPar: number;
  toParDisplay: string;
  position: number;
  status: "active" | "cut" | "wd";
  rounds: number[];
  earnings: number;
}

export interface RosterData {
  teamId: number;
  teamName: string;
  leagueId: number;
  locked: boolean;
  phase: string;
  settings: { rosterSize: number; activeSize: number; reserveSize: number; mulligansPerSeason: number };
  roster: RosterPlayer[];
  reserve: RosterPlayer[];
}

export function getRoster(leagueId: number, teamId: number, tournamentId?: number) {
  const qs = tournamentId != null ? `?tournamentId=${tournamentId}` : "";
  return fetchJSON<RosterData>(`/league/${leagueId}/team/${teamId}/roster${qs}`);
}

export function setLineup(leagueId: number, teamId: number, activePlayerIds: number[]) {
  return fetchJSON<{ ok: boolean }>(`/league/${leagueId}/team/${teamId}/lineup`, {
    method: "POST",
    body: JSON.stringify({ activePlayerIds }),
  });
}

// --- Golfers / Waivers (Build 4+) ---

export interface PlayerPoolEntry {
  playerId: number;
  name: string;
  country: string;
  ranking: number;
  ownedBy: { teamId: number; teamName: string } | null;
  seasonEarnings: number;
  recentFinishes: string[];
}

export function getPlayerPool(leagueId: number) {
  return fetchJSON<PlayerPoolEntry[]>(`/league/${leagueId}/players`);
}

export function submitWaiverClaim(leagueId: number, claim: { addPlayerId: number; dropPlayerId?: number; faabBid?: number }) {
  return fetchJSON<{ ok: boolean }>(`/league/${leagueId}/waiver/claim`, {
    method: "POST",
    body: JSON.stringify(claim),
  });
}

export function processWaivers(leagueId: number) {
  return fetchJSON<{ processed: number }>(`/league/${leagueId}/waiver/process`, {
    method: "POST",
  });
}

// --- Standings (Build 5+) ---

export interface SeasonStanding {
  teamId: number;
  teamName: string;
  managerName: string;
  totalEarnings: number;
  previousRank: number;
  currentRank: number;
  tournamentEarnings: { tournamentId: number; tournamentName: string; earnings: number }[];
}

export function getSeasonStandings(leagueId: number) {
  return fetchJSON<SeasonStanding[]>(`/league/${leagueId}/standings`);
}

// --- Chat (Build 6+) ---

export interface FeedEvent {
  id: string;
  type: "waiver" | "lineup" | "mulligan" | "system";
  message: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  teamId: number;
  teamName: string;
  message: string;
  timestamp: string;
}

export function getActivityFeed(leagueId: number) {
  return fetchJSON<FeedEvent[]>(`/league/${leagueId}/feed`);
}

export function getChatMessages(leagueId: number) {
  return fetchJSON<ChatMessage[]>(`/league/${leagueId}/chat`);
}

export function sendChatMessage(leagueId: number, message: string) {
  return fetchJSON<ChatMessage>(`/league/${leagueId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// --- Player Detail ---

export interface PlayerDetail {
  playerId: number;
  name: string;
  country: string;
  ranking: number;
  toPar: number;
  toParDisplay: string;
  position: number;
  status: "active" | "cut" | "wd";
  rounds: number[];
  earnings: number;
}

export function getPlayer(id: number) {
  return fetchJSON<PlayerDetail>(`/player/${id}`);
}

// --- Mulligan (Build 7+) ---

export interface MulliganStatus {
  windowOpen: boolean;
  remaining: number;
  eligiblePlayers: { playerId: number; name: string; earnings: number }[];
  isMajor: boolean;
}

export function getMulliganStatus(leagueId: number, teamId: number) {
  return fetchJSON<MulliganStatus>(`/league/${leagueId}/team/${teamId}/mulligan`);
}

export function activateMulligan(leagueId: number, teamId: number, playerId: number) {
  return fetchJSON<{ ok: boolean; remaining: number }>(`/league/${leagueId}/team/${teamId}/mulligan`, {
    method: "POST",
    body: JSON.stringify({ playerId }),
  });
}
