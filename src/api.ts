import { supabase } from "./lib/supabase";

const BASE = "/api";

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`${BASE}${url}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// --- Sim Version (polling) ---

export interface SimVersion {
  tournamentId: number;
  phase: string;
  currentRound: number;
  fieldSize: number;
  cutLine: number | null;
  holesPlayed: number;
}

export function getSimVersion() {
  return fetchJSON<SimVersion>("/sim/version");
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
  hotStreaks: Record<number, string>;
  holesPlayed: number;
}

export function getSimState() {
  return fetchJSON<SimStatus>("/admin/simulator/state");
}

export function advanceSim(holes?: number) {
  return fetchJSON<{ phase: string; currentRound: number; activePlayers?: number; cutPlayers?: number; cutLine?: number | null; holesPlayed: number }>(
    "/admin/simulator/advance",
    { method: "POST", body: JSON.stringify({ holes }) }
  );
}

export function setOverride(playerId: number, override: { score?: number; wd?: boolean }) {
  return fetchJSON<{ overrides: Record<number, unknown> }>("/admin/simulator/override", {
    method: "POST",
    body: JSON.stringify({ playerId, ...override }),
  });
}

export function updatePlayer(playerId: number, updates: { rounds?: (number | null)[]; status?: string; holeScores?: ((number | null)[] | null)[] }) {
  return fetchJSON<{ ok: boolean }>("/admin/simulator/player/update", {
    method: "POST",
    body: JSON.stringify({ playerId, ...updates }),
  });
}

export function rewindSim() {
  return fetchJSON<{ phase: string; currentRound: number }>("/admin/simulator/rewind", { method: "POST" });
}

export function completeSim() {
  return fetchJSON<{ completed: boolean; nextTournamentId: number | null; nextTournamentName: string | null }>("/admin/simulator/complete", { method: "POST" });
}

export function rollbackSim() {
  return fetchJSON<{ phase: string; tournamentId: number }>("/admin/simulator/rollback", { method: "POST" });
}

export function resetSim(tournamentId?: number) {
  return fetchJSON<{ phase: string; tournamentId: number; fieldSize: number }>("/admin/simulator/reset", {
    method: "POST",
    body: JSON.stringify({ tournamentId }),
  });
}

export function setHotStreaks(players: { playerId: number; tier: string }[]) {
  return fetchJSON<{ hotStreaks: Record<number, string> }>("/admin/simulator/hot-streak", {
    method: "POST",
    body: JSON.stringify({ players }),
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
  points: number;
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
  color?: string;
  secondaryColor?: string;
}

export function getTournamentList() {
  return fetchJSON<TournamentListItem[]>("/tournament/list");
}

// --- Leagues (Lobby) ---

export interface LeagueSummary {
  id: number;
  name: string;
  team: string;
  teamColor?: string;
  teamSecondaryColor?: string;
  rank: number;
  rankTied: boolean;
  of: number;
  money: number;
  weekMoney: number;
  points: number;
  weekPoints: number;
  weekRankTied: boolean;
  showMoney: boolean;
  members: number;
  tournament: string;
  course: string;
  loc: string;
  purse: number;
  color?: string;
  secondaryColor?: string;
  status: "live" | "done" | "upcoming";
  round: number;
  cut: string;
  phase: string;
  week: number;
  weekRank: number;
  myTeamId: number;
}

export function getLeagues() {
  return fetchJSON<LeagueSummary[]>("/league/all");
}

// --- League (Build 2+) ---

export interface FantasyTeamSummary {
  teamId: number;
  teamName: string;
  managerName: string;
  color?: string;
  secondaryColor?: string;
  totalEarnings: number;
  totalPoints: number;
  roundPoints: number[];
  projectedRoundPoints: number[];
  players: {
    playerId: number;
    name: string;
    position: number;
    positionTied: boolean;
    toPar: number;
    toParDisplay: string;
    status: "active" | "cut" | "wd";
    earnings: number;
    points: number;
    isActive: boolean;
    rounds: number[];
    currentRound: number;
    holesThru: number;
    totalScore: number;
    currentRoundToPar: number;
    currentRoundStrokes: number;
  }[];
}

export interface FantasyLeaderboard {
  leagueId: number;
  leagueName: string;
  tournamentName: string;
  phase: string;
  showMoney: boolean;
  managerCount?: number;
  activeSize?: number;
  teams: FantasyTeamSummary[];
}

export function getFantasyLeaderboard(leagueId: number, tournamentId?: number, options?: { signal?: AbortSignal }) {
  const qs = tournamentId != null ? `?tournamentId=${tournamentId}` : "";
  return fetchJSON<FantasyLeaderboard>(`/league/${leagueId}/leaderboard${qs}`, options);
}

export type ScoringSettings = Record<string, number>;

export interface LeagueInfo {
  id: number;
  name: string;
  members: { teamId: number; teamName: string; managerName: string; color?: string; secondaryColor?: string }[];
  settings: { rosterSize: number; activeSize: number; reserveSize: number; mulligansPerSeason: number; scoringSettings: ScoringSettings; showMoney: boolean };
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
  positionTied: boolean;
  status: "active" | "cut" | "wd";
  rounds: number[];
  roundPoints: number[];
  projectedRoundPoints: number[];
  earnings: number;
  points: number;
  holesThru: number;
}

export interface RosterData {
  teamId: number;
  teamName: string;
  color?: string;
  secondaryColor?: string;
  leagueId: number;
  locked: boolean;
  phase: string;
  settings: { rosterSize: number; activeSize: number; reserveSize: number; mulligansPerSeason: number };
  roster: RosterPlayer[];
  reserve: RosterPlayer[];
}

export function getRoster(leagueId: number, teamId: number, tournamentId?: number, options?: { signal?: AbortSignal }) {
  const qs = tournamentId != null ? `?tournamentId=${tournamentId}` : "";
  return fetchJSON<RosterData>(`/league/${leagueId}/team/${teamId}/roster${qs}`, options);
}

export function setLineup(leagueId: number, teamId: number, activePlayerIds: number[], tournamentId?: number) {
  return fetchJSON<{ ok: boolean }>(`/league/${leagueId}/team/${teamId}/lineup`, {
    method: "POST",
    body: JSON.stringify({ activePlayerIds, tournamentId }),
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
  seasonPoints: number;
  eagles: number;
  birdies: number;
  pars: number;
  bogeys: number;
  doubles: number;
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
  color?: string;
  secondaryColor?: string;
  totalEarnings: number;
  totalPoints: number;
  previousRank: number;
  currentRank: number;
  completedWeeks: number;
  totalWeeks: number;
  tournamentEarnings: { tournamentId: number; tournamentName: string; earnings: number }[];
}

export function getSeasonStandings(leagueId: number) {
  return fetchJSON<{ leagueName: string; managerCount?: number; totalWeeks: number; standings: SeasonStanding[] }>(`/league/${leagueId}/standings`);
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
  points: number;
  holeScores: (number | null)[][];
  holePars: number[];
  roundPoints: number[];
  holePoints: number[][];
}

export function getPlayer(id: number, leagueId?: number) {
  const qs = leagueId != null ? `?leagueId=${leagueId}` : "";
  return fetchJSON<PlayerDetail>(`/player/${id}${qs}`);
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

// --- League Creation (Build 8+) ---

export interface ScoringEventDefault {
  id: number;
  key: string;
  label: string;
  defaultPoints: number;
  sortOrder: number;
}

export function getScoringEventDefaults() {
  return fetchJSON<{ events: ScoringEventDefault[] }>("/scoring-events");
}

export interface SchedulePreviewTournament {
  id: number;
  name: string;
  isMajor: boolean;
  startDate: string;
}

export function getSchedulePreview(weekCount: number) {
  return fetchJSON<{ tournaments: SchedulePreviewTournament[] }>(`/tournaments/schedule-preview?weekCount=${weekCount}`);
}

export interface CreateLeaguePayload {
  name: string;
  teamName?: string;
  managerCount: number;
  lineupCount: number;
  benchCount: number;
  reserveCount: number;
  scoring: { scoringEventId: number; pointsVal: number }[];
  waiverType: "reverse_standings" | "faab";
  faabBudget: number;
  tradeVetoRule: "none" | "commissioner" | "league";
  weekCount: number;
  regularSeasonPoints: number;
  majorSeasonPoints: number;
  draftScheduledAt?: string;
}

export function createLeague(payload: CreateLeaguePayload) {
  return fetchJSON<{ leagueId: number; inviteCode: string; managerId: number }>("/league/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface InvitePreview {
  id: number;
  name: string;
  members: number;
  maxMembers: number;
  creatorName: string;
}

export function getInvitePreview(code: string) {
  return fetchJSON<InvitePreview>(`/league/invite/${code}`);
}

export function joinLeague(inviteCode: string, teamName?: string) {
  return fetchJSON<{ leagueId: number; managerId: number }>("/league/join", {
    method: "POST",
    body: JSON.stringify({ inviteCode, teamName }),
  });
}

// --- Admin ---

export type AdminLeagueStatus = "Setup" | "Drafting" | "Active";

export interface AdminLeague {
  id: number;
  name: string;
  ownerName: string;
  ownerEmail: string;
  managerCount: number;
  status: AdminLeagueStatus;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  teamCount: number;
}

export function getAdminLeagues() {
  return fetchJSON<AdminLeague[]>("/admin/leagues");
}

export function getAdminUsers() {
  return fetchJSON<AdminUser[]>("/admin/users");
}
