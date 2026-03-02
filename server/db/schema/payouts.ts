import { pgTable, integer, real } from "drizzle-orm/pg-core";

export const payouts = pgTable("payouts", {
  position: integer("position").primaryKey(),
  pct: real("pct").notNull(),
});
