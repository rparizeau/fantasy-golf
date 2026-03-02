import { pgTable, integer, varchar, timestamp, serial } from "drizzle-orm/pg-core";
import { leagues } from "./leagues.ts";

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  teamId: integer("team_id").notNull(),
  teamName: varchar("team_name", { length: 100 }).notNull(),
  message: varchar("message", { length: 2000 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
