import {
  pgTable, pgEnum, integer, varchar, boolean, serial, date,
  jsonb, timestamp, primaryKey, index, unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums (7) ───────────────────────────────────────────────

export const rosterableTypeEnum = pgEnum("rosterable_type", [
  "draft_roster", "manager_roster", "tournament_roster",
]);

export const rosterStatusEnum = pgEnum("roster_status", [
  "rostered", "reserved",
]);

export const draftStatusEnum = pgEnum("draft_status", [
  "pending", "active", "complete",
]);

export const tradeStatusEnum = pgEnum("trade_status", [
  "proposed", "accepted", "rejected", "cancelled",
]);

export const waiverStatusEnum = pgEnum("waiver_status", [
  "pending", "approved", "rejected",
]);

export const simPhaseEnum = pgEnum("sim_phase", [
  "idle", "round1", "round2", "cut", "round3", "round4", "final",
]);

export const simPlayerStatusEnum = pgEnum("sim_player_status", [
  "active", "cut", "wd",
]);

export const pointSourceEnum = pgEnum("point_source", [
  "computed", "manual",
]);

export const scoringCategoryEnum = pgEnum("scoring_category", [
  "hole_outcome", "bonus",
]);

// ─── Tier 1: Standalone reference data ───────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  supabaseUserId: varchar("supabase_user_id", { length: 36 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  address: varchar("address", { length: 300 }),
  colorCode: varchar("color_code", { length: 10 }).notNull().default("#003C80"),
  holes: jsonb("holes").notNull().$type<number[]>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const golfers = pgTable("golfers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  ranking: integer("ranking").notNull(),
  origin: varchar("origin", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const scoringEvents = pgTable("scoring_events", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 30 }).notNull().unique(),
  label: varchar("label", { length: 50 }).notNull(),
  category: scoringCategoryEnum("category").notNull(),
  defaultPoints: integer("default_points").notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Tier 2: FK to Tier 1 ───────────────────────────────────

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull().references(() => courses.id),
  name: varchar("name", { length: 100 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  purse: integer("purse").notNull(),
  colorCode: varchar("color_code", { length: 10 }).notNull().default("#003C80"),
  isMajor: boolean("is_major").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const leagues = pgTable("leagues", {
  id: serial("id").primaryKey(),
  createdById: integer("created_by_id").notNull().references(() => users.id),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Tier 3: FK to Tier 1+2 ─────────────────────────────────

export const managers = pgTable("managers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  teamName: varchar("team_name", { length: 100 }),
  isCommissioner: boolean("is_commissioner").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("managers_user_league_uq").on(t.userId, t.leagueId),
]);

export const leagueSettings = pgTable("league_settings", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id).unique(),
  weekCount: integer("week_count").notNull().default(19),
  managerCount: integer("manager_count").notNull().default(10),
  rosterCount: integer("roster_count").notNull().default(8),
  lineupCount: integer("lineup_count").notNull().default(4),
  reserveCount: integer("reserve_count").notNull().default(4),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const leagueScoring = pgTable("league_scoring", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  scoringEventId: integer("scoring_event_id").notNull().references(() => scoringEvents.id),
  pointsVal: integer("points_val").notNull(),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => [
  unique("league_scoring_uq").on(t.leagueId, t.scoringEventId),
]);

export const leagueTournament = pgTable("league_tournament", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id),
  weekNumber: integer("week_number").notNull(),
  orderNumber: integer("order_number").notNull(),
  isLocked: boolean("is_locked").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("league_tournament_uq").on(t.leagueId, t.tournamentId),
]);

// ─── Tier 4: Roster system (polymorphic) ─────────────────────

export const draftRosters = pgTable("draft_rosters", {
  id: serial("id").primaryKey(),
  managerId: integer("manager_id").notNull().references(() => managers.id).unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const managerRosters = pgTable("manager_rosters", {
  id: serial("id").primaryKey(),
  managerId: integer("manager_id").notNull().references(() => managers.id).unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const tournamentRosters = pgTable("tournament_rosters", {
  id: serial("id").primaryKey(),
  leagueTournamentId: integer("league_tournament_id").notNull().references(() => leagueTournament.id),
  managerId: integer("manager_id").notNull().references(() => managers.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  unique("tournament_rosters_uq").on(t.leagueTournamentId, t.managerId),
]);

export const rosters = pgTable("rosters", {
  id: serial("id").primaryKey(),
  rosterableId: integer("rosterable_id").notNull(),
  rosterableType: rosterableTypeEnum("rosterable_type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("rosters_polymorphic_idx").on(t.rosterableId, t.rosterableType),
]);

export const golferRoster = pgTable("golfer_roster", {
  id: serial("id").primaryKey(),
  golferId: integer("golfer_id").notNull().references(() => golfers.id),
  rosterId: integer("roster_id").notNull().references(() => rosters.id),
  statusEnum: rosterStatusEnum("status_enum").notNull().default("rostered"),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("golfer_roster_uq").on(t.golferId, t.rosterId),
]);

// ─── Tier 5: Draft system ────────────────────────────────────

export const drafts = pgTable("drafts", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  statusEnum: draftStatusEnum("status_enum").notNull().default("pending"),
  currentPickNumber: integer("current_pick_number").notNull().default(0),
  roundCount: integer("round_count").notNull(),
  isSnake: boolean("is_snake").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const draftPicks = pgTable("draft_picks", {
  id: serial("id").primaryKey(),
  draftId: integer("draft_id").notNull().references(() => drafts.id),
  managerId: integer("manager_id").notNull().references(() => managers.id),
  golferId: integer("golfer_id").references(() => golfers.id),
  pickNumber: integer("pick_number").notNull(),
  roundNumber: integer("round_number").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("draft_picks_uq").on(t.draftId, t.pickNumber),
]);

// ─── Tier 6: Trades & waivers ────────────────────────────────

export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  proposedById: integer("proposed_by_id").notNull().references(() => managers.id),
  proposedToId: integer("proposed_to_id").notNull().references(() => managers.id),
  statusEnum: tradeStatusEnum("status_enum").notNull().default("proposed"),
  proposedAt: timestamp("proposed_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const golferTrade = pgTable("golfer_trade", {
  id: serial("id").primaryKey(),
  tradeId: integer("trade_id").notNull().references(() => trades.id),
  golferId: integer("golfer_id").notNull().references(() => golfers.id),
  fromManagerId: integer("from_manager_id").notNull().references(() => managers.id),
  toManagerId: integer("to_manager_id").notNull().references(() => managers.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const waivers = pgTable("waivers", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  managerId: integer("manager_id").notNull().references(() => managers.id),
  addGolferId: integer("add_golfer_id").notNull().references(() => golfers.id),
  dropGolferId: integer("drop_golfer_id").references(() => golfers.id),
  statusEnum: waiverStatusEnum("status_enum").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// ─── Tier 7: Sim/operational ─────────────────────────────────

export const simActive = pgTable("sim_active", {
  id: integer("id").primaryKey().default(1),
  activeTournamentId: integer("active_tournament_id").notNull().references(() => tournaments.id),
});

export const simTournaments = pgTable("sim_tournaments", {
  tournamentId: integer("tournament_id").primaryKey().references(() => tournaments.id),
  phase: simPhaseEnum("phase").notNull(),
  currentRound: integer("current_round").notNull().default(0),
  par: integer("par").notNull(),
  holePars: jsonb("hole_pars").$type<number[]>(),
  cutLine: integer("cut_line"),
  fieldSize: integer("field_size").notNull().default(100),
  overrides: jsonb("overrides").$type<Record<number, { score?: number; wd?: boolean }>>(),
  isEarningsAccumulated: boolean("is_earnings_accumulated").notNull().default(false),
  isPointsAccumulated: boolean("is_points_accumulated").notNull().default(false),
});

export const simPlayers = pgTable("sim_players", {
  tournamentId: integer("tournament_id").notNull().references(() => simTournaments.tournamentId),
  golferId: integer("golfer_id").notNull().references(() => golfers.id),
  name: varchar("name", { length: 100 }).notNull(),
  origin: varchar("origin", { length: 10 }).notNull(),
  ranking: integer("ranking").notNull(),
  rounds: jsonb("rounds").notNull().$type<number[]>(),
  holeScores: jsonb("hole_scores").$type<(number | null)[][]>(),
  total: integer("total").notNull().default(0),
  toPar: integer("to_par").notNull().default(0),
  position: integer("position").notNull().default(0),
  statusEnum: simPlayerStatusEnum("status_enum").notNull().default("active"),
}, (t) => [
  primaryKey({ columns: [t.tournamentId, t.golferId] }),
  index("sim_players_position_idx").on(t.tournamentId, t.position),
  index("sim_players_status_idx").on(t.tournamentId, t.statusEnum),
]);

// ─── Tier 8: Social ──────────────────────────────────────────

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  type: varchar("type", { length: 30 }).notNull(),
  message: varchar("message", { length: 500 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  managerId: integer("manager_id").notNull().references(() => managers.id),
  content: varchar("content", { length: 2000 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Tier 9: Points ─────────────────────────────────────────

export const managerPoints = pgTable("manager_points", {
  id: serial("id").primaryKey(),
  golferRosterId: integer("golfer_roster_id").notNull().references(() => golferRoster.id),
  scoringEventId: integer("scoring_event_id").references(() => scoringEvents.id),
  roundNumber: integer("round_number").notNull(),
  holeNumber: integer("hole_number").notNull(),
  holeScore: integer("hole_score").notNull(),
  holePar: integer("hole_par").notNull(),
  pointsVal: integer("points_val").notNull(),
  source: pointSourceEnum("source").notNull().default("computed"),
  isContested: boolean("is_contested").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("manager_points_golfer_roster_idx").on(t.golferRosterId),
]);

// ─── Relations ───────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  managers: many(managers),
  leagues: many(leagues),
}));

export const coursesRelations = relations(courses, ({ many }) => ({
  tournaments: many(tournaments),
}));

export const golfersRelations = relations(golfers, ({ many }) => ({
  golferRosters: many(golferRoster),
  draftPicks: many(draftPicks),
  simPlayers: many(simPlayers),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  course: one(courses, { fields: [tournaments.courseId], references: [courses.id] }),
  leagueTournaments: many(leagueTournament),
  simTournament: one(simTournaments, { fields: [tournaments.id], references: [simTournaments.tournamentId] }),
}));

export const leaguesRelations = relations(leagues, ({ one, many }) => ({
  createdBy: one(users, { fields: [leagues.createdById], references: [users.id] }),
  managers: many(managers),
  settings: one(leagueSettings),
  leagueScoring: many(leagueScoring),
  leagueTournaments: many(leagueTournament),
  drafts: many(drafts),
  trades: many(trades),
  waivers: many(waivers),
  activities: many(activities),
  messages: many(messages),
}));

export const managersRelations = relations(managers, ({ one, many }) => ({
  user: one(users, { fields: [managers.userId], references: [users.id] }),
  league: one(leagues, { fields: [managers.leagueId], references: [leagues.id] }),
  draftRoster: one(draftRosters),
  managerRoster: one(managerRosters),
  tournamentRosters: many(tournamentRosters),
  draftPicks: many(draftPicks),
  proposedTrades: many(trades, { relationName: "proposedByTrades" }),
  receivedTrades: many(trades, { relationName: "proposedToTrades" }),
  waivers: many(waivers),
  messages: many(messages),
}));

export const leagueSettingsRelations = relations(leagueSettings, ({ one }) => ({
  league: one(leagues, { fields: [leagueSettings.leagueId], references: [leagues.id] }),
}));

export const scoringEventsRelations = relations(scoringEvents, ({ many }) => ({
  leagueScoring: many(leagueScoring),
}));

export const leagueScoringRelations = relations(leagueScoring, ({ one }) => ({
  league: one(leagues, { fields: [leagueScoring.leagueId], references: [leagues.id] }),
  scoringEvent: one(scoringEvents, { fields: [leagueScoring.scoringEventId], references: [scoringEvents.id] }),
}));

export const leagueTournamentRelations = relations(leagueTournament, ({ one, many }) => ({
  league: one(leagues, { fields: [leagueTournament.leagueId], references: [leagues.id] }),
  tournament: one(tournaments, { fields: [leagueTournament.tournamentId], references: [tournaments.id] }),
  tournamentRosters: many(tournamentRosters),
}));

export const draftRostersRelations = relations(draftRosters, ({ one }) => ({
  manager: one(managers, { fields: [draftRosters.managerId], references: [managers.id] }),
}));

export const managerRostersRelations = relations(managerRosters, ({ one }) => ({
  manager: one(managers, { fields: [managerRosters.managerId], references: [managers.id] }),
}));

export const tournamentRostersRelations = relations(tournamentRosters, ({ one }) => ({
  leagueTournament: one(leagueTournament, { fields: [tournamentRosters.leagueTournamentId], references: [leagueTournament.id] }),
  manager: one(managers, { fields: [tournamentRosters.managerId], references: [managers.id] }),
}));

export const rostersRelations = relations(rosters, ({ many }) => ({
  golferRosters: many(golferRoster),
}));

export const golferRosterRelations = relations(golferRoster, ({ one, many }) => ({
  golfer: one(golfers, { fields: [golferRoster.golferId], references: [golfers.id] }),
  roster: one(rosters, { fields: [golferRoster.rosterId], references: [rosters.id] }),
  managerPoints: many(managerPoints),
}));

export const draftsRelations = relations(drafts, ({ one, many }) => ({
  league: one(leagues, { fields: [drafts.leagueId], references: [leagues.id] }),
  picks: many(draftPicks),
}));

export const draftPicksRelations = relations(draftPicks, ({ one }) => ({
  draft: one(drafts, { fields: [draftPicks.draftId], references: [drafts.id] }),
  manager: one(managers, { fields: [draftPicks.managerId], references: [managers.id] }),
  golfer: one(golfers, { fields: [draftPicks.golferId], references: [golfers.id] }),
}));

export const tradesRelations = relations(trades, ({ one, many }) => ({
  league: one(leagues, { fields: [trades.leagueId], references: [leagues.id] }),
  proposedBy: one(managers, { fields: [trades.proposedById], references: [managers.id], relationName: "proposedByTrades" }),
  proposedTo: one(managers, { fields: [trades.proposedToId], references: [managers.id], relationName: "proposedToTrades" }),
  golferTrades: many(golferTrade),
}));

export const golferTradeRelations = relations(golferTrade, ({ one }) => ({
  trade: one(trades, { fields: [golferTrade.tradeId], references: [trades.id] }),
  golfer: one(golfers, { fields: [golferTrade.golferId], references: [golfers.id] }),
  fromManager: one(managers, { fields: [golferTrade.fromManagerId], references: [managers.id], relationName: "fromManagerTrades" }),
  toManager: one(managers, { fields: [golferTrade.toManagerId], references: [managers.id], relationName: "toManagerTrades" }),
}));

export const waiversRelations = relations(waivers, ({ one }) => ({
  league: one(leagues, { fields: [waivers.leagueId], references: [leagues.id] }),
  manager: one(managers, { fields: [waivers.managerId], references: [managers.id] }),
  addGolfer: one(golfers, { fields: [waivers.addGolferId], references: [golfers.id], relationName: "addGolferWaivers" }),
  dropGolfer: one(golfers, { fields: [waivers.dropGolferId], references: [golfers.id], relationName: "dropGolferWaivers" }),
}));

export const simActiveRelations = relations(simActive, ({ one }) => ({
  activeTournament: one(tournaments, { fields: [simActive.activeTournamentId], references: [tournaments.id] }),
}));

export const simTournamentsRelations = relations(simTournaments, ({ one, many }) => ({
  tournament: one(tournaments, { fields: [simTournaments.tournamentId], references: [tournaments.id] }),
  players: many(simPlayers),
}));

export const simPlayersRelations = relations(simPlayers, ({ one }) => ({
  simTournament: one(simTournaments, { fields: [simPlayers.tournamentId], references: [simTournaments.tournamentId] }),
  golfer: one(golfers, { fields: [simPlayers.golferId], references: [golfers.id] }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  league: one(leagues, { fields: [activities.leagueId], references: [leagues.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  league: one(leagues, { fields: [messages.leagueId], references: [leagues.id] }),
  manager: one(managers, { fields: [messages.managerId], references: [managers.id] }),
}));

export const managerPointsRelations = relations(managerPoints, ({ one }) => ({
  golferRoster: one(golferRoster, { fields: [managerPoints.golferRosterId], references: [golferRoster.id] }),
  scoringEvent: one(scoringEvents, { fields: [managerPoints.scoringEventId], references: [scoringEvents.id] }),
}));
