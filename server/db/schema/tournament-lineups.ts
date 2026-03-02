import { pgTable, integer, primaryKey } from "drizzle-orm/pg-core";
import { teams } from "./teams";
import { tournaments } from "./tournaments";
import { players } from "./players";

export const tournamentLineups = pgTable("tournament_lineups", {
  teamPk: integer("team_pk").notNull().references(() => teams.id),
  tournamentId: integer("tournament_id").notNull().references(() => tournaments.id),
  playerId: integer("player_id").notNull().references(() => players.id),
}, (t) => [
  primaryKey({ columns: [t.teamPk, t.tournamentId, t.playerId] }),
]);
