import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const visitStats = pgTable("visit_stats", {
  id: serial("id").primaryKey(),
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type VisitStats = {
  id: number;
  count: number;
  updatedAt: Date;
};
