import { pgTable, integer, varchar, jsonb } from "drizzle-orm/pg-core";
import { tournaments } from "./tournaments";

export const courses = pgTable("courses", {
  tournamentId: integer("tournament_id").primaryKey().references(() => tournaments.id),
  courseName: varchar("course_name", { length: 150 }).notNull(),
  holes: jsonb("holes").notNull().$type<number[]>(),
});
