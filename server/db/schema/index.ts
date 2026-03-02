import {
  pgTable, integer, varchar, boolean, real, serial,
  jsonb, timestamp, primaryKey, index,
} from "drizzle-orm/pg-core";

// --- Managers (Auth) ---

export const managers = pgTable("managers", {
  id: serial("id").primaryKey(),
  supabaseUserId: varchar("supabase_user_id", { length: 36 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// --- Seed Data (read-only) ---

export const players = pgTable("players", {
  id: integer("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  ranking: integer("ranking").notNull(),
  country: varchar("country", { length: 10 }).notNull(),
});

export const tournaments = pgTable("tournaments", {
  id: integer("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  course: varchar("course", { length: 150 }).notNull(),
  location: varchar("location", { length: 150 }).notNull(),
  purse: integer("purse").notNull(),
  par: integer("par").notNull(),
  isMajor: boolean("is_major").notNull().default(false),
  isCurrent: boolean("is_current").notNull().default(false),
  dateStart: varchar("date_start", { length: 20 }).notNull(),
  dateEnd: varchar("date_end", { length: 20 }).notNull(),
});

export const courses = pgTable("courses", {
  tournamentId: integer("tournament_id").primaryKey().references(() => tournaments.id),
  courseName: varchar("course_name", { length: 150 }).notNull(),
  holes: jsonb("holes").notNull().$type<number[]>(),
});

export const payouts = pgTable("payouts", {
  position: integer("position").primaryKey(),
  pct: real("pct").notNull(),
});

// --- League Management ---

export const leagues = pgTable("leagues", {
  id: integer("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  rosterSize: integer("roster_size").notNull(),
  activeSize: integer("active_size").notNull(),
  reserveSize: integer("reserve_size").notNull(),
  mulligansPerSeason: integer("mulligans_per_season").notNull(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  teamId: integer("team_id").notNull(),
  teamName: varchar("team_name", { length: 100 }).notNull(),
  managerName: varchar("manager_name", { length: 100 }).notNull(),
  managerId: integer("manager_id").references(() => managers.id),
  mulligansUsed: integer("mulligans_used").notNull().default(0),
  seasonEarnings: integer("season_earnings").notNull().default(0),
});

export const teamRosters = pgTable("team_rosters", {
  teamPk: integer("team_pk").notNull().references(() => teams.id),
  playerId: integer("player_id").notNull().references(() => players.id),
  slot: varchar("slot", { length: 10 }).notNull().$type<"roster" | "reserve">(),
}, (t) => [
  primaryKey({ columns: [t.teamPk, t.playerId] }),
]);

export const tournamentLineups = pgTable("tournament_lineups", {
  teamPk: integer("team_pk").notNull().references(() => teams.id),
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id),
  playerId: integer("player_id").notNull().references(() => players.id),
}, (t) => [
  primaryKey({ columns: [t.teamPk, t.tournamentId, t.playerId] }),
]);

// --- Sim State ---

export const simActive = pgTable("sim_active", {
  id: integer("id").primaryKey().default(1),
  activeTournamentId: integer("active_tournament_id").notNull(),
});

export const simTournaments = pgTable("sim_tournaments", {
  tournamentId: integer("tournament_id").primaryKey().references(() => tournaments.id),
  phase: varchar("phase", { length: 20 }).notNull().$type<"idle" | "round1" | "round2" | "cut" | "round3" | "round4" | "final">(),
  currentRound: integer("current_round").notNull().default(0),
  par: integer("par").notNull(),
  holePars: jsonb("hole_pars").$type<number[]>(),
  cutLine: integer("cut_line"),
  fieldSize: integer("field_size").notNull().default(100),
  overrides: jsonb("overrides").$type<Record<number, { score?: number; wd?: boolean }>>(),
  earningsAccumulated: boolean("earnings_accumulated").notNull().default(false),
});

export const simPlayers = pgTable("sim_players", {
  tournamentId: integer("tournament_id").notNull().references(() => simTournaments.tournamentId),
  playerId: integer("player_id").notNull().references(() => players.id),
  name: varchar("name", { length: 100 }).notNull(),
  country: varchar("country", { length: 10 }).notNull(),
  ranking: integer("ranking").notNull(),
  rounds: jsonb("rounds").notNull().$type<number[]>(),
  holeScores: jsonb("hole_scores").$type<(number | null)[][]>(),
  total: integer("total").notNull().default(0),
  toPar: integer("to_par").notNull().default(0),
  position: integer("position").notNull().default(0),
  status: varchar("status", { length: 10 }).notNull().$type<"active" | "cut" | "wd">().default("active"),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.playerId] }),
  index("sim_players_position_idx").on(t.tournamentId, t.position),
  index("sim_players_status_idx").on(t.tournamentId, t.status),
]);

// --- Social ---

export const waiverClaims = pgTable("waiver_claims", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  teamId: integer("team_id").notNull(),
  addPlayerId: integer("add_player_id").notNull(),
  dropPlayerId: integer("drop_player_id"),
  faabBid: integer("faab_bid").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const activityFeed = pgTable("activity_feed", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  type: varchar("type", { length: 30 }).notNull(),
  message: varchar("message", { length: 500 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  teamId: integer("team_id").notNull(),
  teamName: varchar("team_name", { length: 100 }).notNull(),
  message: varchar("message", { length: 2000 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
