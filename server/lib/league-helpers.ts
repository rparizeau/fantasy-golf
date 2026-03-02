import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getActiveTournamentId } from "../sim/engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LEAGUE_STATE_PATH = join(__dirname, "..", "state", "league-state.json");

// --- Interfaces ---

export interface Team {
  teamId: number;
  teamName: string;
  managerName: string;
  roster: number[];
  tournamentLineups: Record<string, number[]>;
  reserve: number[];
  mulligansUsed: number;
  seasonEarnings: number;
}

export interface League {
  id: number;
  name: string;
  settings: { rosterSize: number; activeSize: number; reserveSize: number; mulligansPerSeason: number };
  teams: Team[];
  waiverClaims: unknown[];
  activityFeed: unknown[];
  chatMessages: unknown[];
}

export interface LeagueState {
  leagues: Record<string, League>;
  version: number;
}

// --- Migration ---

function migrateV1toV2(raw: any): LeagueState {
  const currentTournamentId = String(getActiveTournamentId());

  for (const league of Object.values(raw.leagues) as any[]) {
    for (const team of league.teams) {
      if (team.activeLineup && !team.tournamentLineups) {
        team.tournamentLineups = { [currentTournamentId]: [...team.activeLineup] };
        delete team.activeLineup;
      }
    }
  }
  raw.version = 2;
  writeFileSync(LEAGUE_STATE_PATH, JSON.stringify(raw, null, 2));
  return raw as LeagueState;
}

// --- Load / Save ---

export function loadLeagueState(): LeagueState {
  const raw = JSON.parse(readFileSync(LEAGUE_STATE_PATH, "utf-8"));
  if ((raw.version || 1) < 2) {
    return migrateV1toV2(raw);
  }
  return raw as LeagueState;
}

export function saveLeagueState(state: LeagueState): void {
  writeFileSync(LEAGUE_STATE_PATH, JSON.stringify(state, null, 2));
}

// --- Per-Tournament Lineup Helpers ---

export function getLineup(team: Team, tournamentId: number): number[] {
  return team.tournamentLineups[String(tournamentId)] || [];
}

export function setLineupForTournament(team: Team, tournamentId: number, lineup: number[]): void {
  team.tournamentLineups[String(tournamentId)] = lineup;
}
