import { pgTable, integer, varchar, jsonb, primaryKey, index } from "drizzle-orm/pg-core";
import { simTournaments } from "./sim-tournaments.js";
import { players } from "./players.js";

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
