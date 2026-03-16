import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
  varchar,
  jsonb,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export type HotSearchExtra = Record<string, unknown>;

export type PlatformRef = { id: number; name: string };

export const platforms = pgTable("platforms", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  displayName: varchar("display_name", { length: 50 }).notNull(),
});

// ── Raw hot searches: append-only, no dedup ─────────────────────────

export const rawHotSearches = pgTable("raw_hot_searches", {
  id: serial("id").primaryKey(),
  platformId: integer("platform_id").references(() => platforms.id),
  title: text("title").notNull(),
  url: text("url").notNull(),
  heatValue: varchar("heat_value", { length: 50 }),
  rank: integer("rank"),
  extra: jsonb("extra").$type<HotSearchExtra>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  hotSearchId: integer("hot_search_id").references(() => hotSearches.id),
});

// ── Formal hot searches: deduplicated, multi-platform ───────────────
//    Note: `embedding vector(2048)` column managed via raw SQL (pgvector).

export const hotSearches = pgTable("hot_searches", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  platforms: jsonb("platforms").$type<PlatformRef[]>().notNull().default([]),
  sourceCount: integer("source_count").notNull().default(1),
  maxHeatValue: varchar("max_heat_value", { length: 50 }),
  maxRank: integer("max_rank"),
  representativeUrl: text("representative_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ── AI analysis (unchanged, 1:1 with formal hot_searches) ───────────

export const aiAnalysis = pgTable("ai_analysis", {
  id: serial("id").primaryKey(),
  hotSearchId: integer("hot_search_id")
    .references(() => hotSearches.id)
    .unique(),

  needsFactCheck: boolean("needs_fact_check"),
  triageReason: text("triage_reason"),
  category: varchar("category", { length: 50 }),
  aiModel: varchar("ai_model", { length: 50 }),
  updatedAt: timestamp("updated_at").defaultNow(),
  upVotes: integer("up_votes").default(0).notNull(),
  downVotes: integer("down_votes").default(0).notNull(),

  isClickbait: boolean("is_clickbait"),
  score: integer("score"),
  reason: text("reason"),
  deepAnalysis: text("deep_analysis"),
  verdict: text("verdict"),
  deepAiModel: varchar("deep_ai_model", { length: 50 }),
  deepAnalyzedAt: timestamp("deep_analyzed_at"),
});

// ── Relations (for Drizzle relational queries) ──────────────────────

export const rawHotSearchesRelations = relations(rawHotSearches, ({ one }) => ({
  platform: one(platforms, {
    fields: [rawHotSearches.platformId],
    references: [platforms.id],
  }),
  hotSearch: one(hotSearches, {
    fields: [rawHotSearches.hotSearchId],
    references: [hotSearches.id],
  }),
}));

export const hotSearchesRelations = relations(hotSearches, ({ many, one }) => ({
  sources: many(rawHotSearches),
  analysis: one(aiAnalysis, {
    fields: [hotSearches.id],
    references: [aiAnalysis.hotSearchId],
  }),
}));

export * from "./visitStats";
