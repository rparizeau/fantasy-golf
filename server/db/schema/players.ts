import { pgTable, integer, varchar } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: integer("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  ranking: integer("ranking").notNull(),
  country: varchar("country", { length: 10 }).notNull(),
});
