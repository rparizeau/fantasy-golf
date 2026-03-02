import { pgTable, integer, varchar, jsonb, boolean } from "drizzle-orm/pg-core";
import { tournaments } from "./tournaments";

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
