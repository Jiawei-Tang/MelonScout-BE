import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  varchar,
  jsonb,
} from "drizzle-orm/pg-core";

/** Extra payload per source, e.g. { source, hottag, hotwordnum } for tianapi */
export type HotSearchExtra = Record<string, unknown>;

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
  /** When this row was fetched (same as createdAt for new rows; explicit for clarity). */
  createdAt: timestamp("created_at").defaultNow().notNull(),
  /** Source-specific JSON, e.g. tianapi: { source, hottag, hotwordnum }. */
  extra: jsonb("extra").$type<HotSearchExtra>(),
});

export const aiAnalysis = pgTable("ai_analysis", {
  id: serial("id").primaryKey(),
  hotSearchId: integer("hot_search_id")
    .references(() => hotSearches.id)
    .unique(),

  // ── Phase 1: quick score ──
  isClickbait: boolean("is_clickbait").default(false),
  score: integer("score"),
  reason: text("reason"),
  aiModel: varchar("ai_model", { length: 50 }),
  updatedAt: timestamp("updated_at").defaultNow(),

  // ── Phase 2: deep search analysis (only for high-score items) ──
  deepAnalysis: text("deep_analysis"),
  verdict: text("verdict"),
  deepAiModel: varchar("deep_ai_model", { length: 50 }),
  deepAnalyzedAt: timestamp("deep_analyzed_at"),
});
