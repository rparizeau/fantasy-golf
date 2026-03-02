import { pgTable, integer } from "drizzle-orm/pg-core";

export const simActive = pgTable("sim_active", {
  id: integer("id").primaryKey().default(1),
  activeTournamentId: integer("active_tournament_id").notNull(),
});
