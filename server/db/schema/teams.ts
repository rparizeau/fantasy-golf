import { pgTable, integer, varchar, serial } from "drizzle-orm/pg-core";
import { leagues } from "./leagues.js";

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  teamId: integer("team_id").notNull(),
  teamName: varchar("team_name", { length: 100 }).notNull(),
  managerName: varchar("manager_name", { length: 100 }).notNull(),
  mulligansUsed: integer("mulligans_used").notNull().default(0),
  seasonEarnings: integer("season_earnings").notNull().default(0),
});
