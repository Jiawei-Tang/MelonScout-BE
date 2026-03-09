import { describe, test, expect } from "bun:test";
import { getTableName } from "drizzle-orm";
import { platforms, hotSearches, aiAnalysis } from "../src/db/schema";

describe("Database Schema: platforms", () => {
  test("table name is platforms", () => {
    expect(getTableName(platforms)).toBe("platforms");
  });

  test("has id, name, displayName columns", () => {
    expect(platforms.id).toBeDefined();
    expect(platforms.name).toBeDefined();
    expect(platforms.displayName).toBeDefined();
  });
});

describe("Database Schema: hotSearches", () => {
  test("table name is hot_searches", () => {
    expect(getTableName(hotSearches)).toBe("hot_searches");
  });

  test("has all required columns", () => {
    expect(hotSearches.id).toBeDefined();
    expect(hotSearches.platformId).toBeDefined();
    expect(hotSearches.title).toBeDefined();
    expect(hotSearches.url).toBeDefined();
    expect(hotSearches.heatValue).toBeDefined();
    expect(hotSearches.rank).toBeDefined();
    expect(hotSearches.createdAt).toBeDefined();
  });

  test("does not have removed description/source columns", () => {
    expect((hotSearches as any).description).toBeUndefined();
    expect((hotSearches as any).source).toBeUndefined();
  });
});

describe("Database Schema: aiAnalysis", () => {
  test("table name is ai_analysis", () => {
    expect(getTableName(aiAnalysis)).toBe("ai_analysis");
  });

  test("has Phase 1 columns", () => {
    expect(aiAnalysis.id).toBeDefined();
    expect(aiAnalysis.hotSearchId).toBeDefined();
    expect(aiAnalysis.isClickbait).toBeDefined();
    expect(aiAnalysis.score).toBeDefined();
    expect(aiAnalysis.reason).toBeDefined();
    expect(aiAnalysis.aiModel).toBeDefined();
    expect(aiAnalysis.updatedAt).toBeDefined();
  });

  test("has Phase 2 columns", () => {
    expect(aiAnalysis.deepAnalysis).toBeDefined();
    expect(aiAnalysis.verdict).toBeDefined();
    expect(aiAnalysis.deepAiModel).toBeDefined();
    expect(aiAnalysis.deepAnalyzedAt).toBeDefined();
  });
});
