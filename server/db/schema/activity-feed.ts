import { pgTable, integer, varchar, timestamp, serial } from "drizzle-orm/pg-core";
import { leagues } from "./leagues.ts";

export const activityFeed = pgTable("activity_feed", {
  id: serial("id").primaryKey(),
  leagueId: integer("league_id").notNull().references(() => leagues.id),
  type: varchar("type", { length: 30 }).notNull(),
  message: varchar("message", { length: 500 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
