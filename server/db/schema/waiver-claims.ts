import { pgTable, integer, timestamp, serial } from "drizzle-orm/pg-core";
import { leagues } from "./leagues.js";

export const waiverClaims = pgTable("waiver_claims", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  teamId: integer("team_id").notNull(),
  addPlayerId: integer("add_player_id").notNull(),
  dropPlayerId: integer("drop_player_id"),
  faabBid: integer("faab_bid").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
