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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  extra: jsonb("extra").$type<HotSearchExtra>(),
});

export const aiAnalysis = pgTable("ai_analysis", {
  id: serial("id").primaryKey(),
  hotSearchId: integer("hot_search_id")
    .references(() => hotSearches.id)
    .unique(),

  // ── Phase 1: Triage — does this title need fact-checking? ──
  needsFactCheck: boolean("needs_fact_check"),
  triageReason: text("triage_reason"),
  category: varchar("category", { length: 50 }),
  aiModel: varchar("ai_model", { length: 50 }),
  updatedAt: timestamp("updated_at").defaultNow(),
  upVotes: integer("up_votes").default(0).notNull(),
  downVotes: integer("down_votes").default(0).notNull(),

  // ── Phase 2: Fact-check + Score (ALL fact-checked items get a score) ──
  isClickbait: boolean("is_clickbait"),
  score: integer("score"),
  reason: text("reason"),
  deepAnalysis: text("deep_analysis"),
  verdict: text("verdict"),
  deepAiModel: varchar("deep_ai_model", { length: 50 }),
  deepAnalyzedAt: timestamp("deep_analyzed_at"),
});
