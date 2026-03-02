import { pgTable, integer, varchar } from "drizzle-orm/pg-core";

export const leagues = pgTable("leagues", {
  id: integer("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  rosterSize: integer("roster_size").notNull(),
  activeSize: integer("active_size").notNull(),
  reserveSize: integer("reserve_size").notNull(),
  mulligansPerSeason: integer("mulligans_per_season").notNull(),
});
