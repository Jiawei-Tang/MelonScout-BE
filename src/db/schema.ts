import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  varchar,
} from "drizzle-orm/pg-core";

export const platforms = pgTable("platforms", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  displayName: varchar("display_name", { length: 50 }).notNull(),
});

export const hotSearches = pgTable("hot_searches", {
  id: serial("id").primaryKey(),
  platformId: integer("platform_id").references(() => platforms.id),
  title: text("title").notNull(),
  url: text("url").notNull(),
  heatValue: varchar("heat_value", { length: 50 }),
  rank: integer("rank"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiAnalysis = pgTable("ai_analysis", {
  id: serial("id").primaryKey(),
  hotSearchId: integer("hot_search_id")
    .references(() => hotSearches.id)
    .unique(),
  isClickbait: boolean("is_clickbait").default(false),
  score: integer("score"),
  reason: text("reason"),
  aiModel: varchar("ai_model", { length: 50 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});
