import { pgTable, integer, real } from "drizzle-orm/pg-core";

export const payouts = pgTable("payouts", {
  position: integer("position").primaryKey(),
  pct: real("pct").notNull(),
  regularPoints: real("regular_points").notNull().default(0),
  majorPoints: real("major_points").notNull().default(0),
});
