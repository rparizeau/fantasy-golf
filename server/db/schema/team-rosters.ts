import { pgTable, integer, varchar, primaryKey } from "drizzle-orm/pg-core";
import { teams } from "./teams.ts";
import { players } from "./players.ts";

export const teamRosters = pgTable("team_rosters", {
  teamPk: integer("team_pk").notNull().references(() => teams.id),
  playerId: integer("player_id").notNull().references(() => players.id),
  slot: varchar("slot", { length: 10 }).notNull().$type<"roster" | "reserve">(),
}, (t) => [
  primaryKey({ columns: [t.teamPk, t.playerId] }),
]);
