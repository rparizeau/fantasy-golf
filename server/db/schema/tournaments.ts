import { pgTable, integer, varchar, boolean } from "drizzle-orm/pg-core";

export const tournaments = pgTable("tournaments", {
  id: integer("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  course: varchar("course", { length: 150 }).notNull(),
  location: varchar("location", { length: 150 }).notNull(),
  purse: integer("purse").notNull(),
  par: integer("par").notNull(),
  isMajor: boolean("is_major").notNull().default(false),
  isCurrent: boolean("is_current").notNull().default(false),
  dateStart: varchar("date_start", { length: 20 }).notNull(),
  dateEnd: varchar("date_end", { length: 20 }).notNull(),
});
