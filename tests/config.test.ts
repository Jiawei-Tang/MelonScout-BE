import { describe, test, expect } from "bun:test";
import { appConfigSchema } from "../src/config/schema";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("melonscout.config.json", () => {
  const raw = JSON.parse(readFileSync(resolve(import.meta.dir, "../melonscout.config.json"), "utf-8"));

  test("validates against schema", () => {
    const result = appConfigSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  test("has server.port", () => {
    expect(raw.server.port).toBe(3000);
  });

  test("has ai config with provider and apiKeyEnv", () => {
    expect(raw.ai.provider).toBeDefined();
    expect(raw.ai.apiKeyEnv).toBeDefined();
    expect(raw.ai.analysisCron).toBeDefined();
  });

  test("has at least one platform", () => {
    expect(Object.keys(raw.platforms).length).toBeGreaterThan(0);
  });

  test("weibo platform has scraper and analysis config", () => {
    const weibo = raw.platforms.weibo;
    expect(weibo).toBeDefined();
    expect(weibo.scraper.type).toBeDefined();
    expect(weibo.scraper.cron).toBeDefined();
    expect(weibo.analysis.topN).toBeGreaterThan(0);
    expect(weibo.analysis.deepAnalysisMax).toBeGreaterThan(0);
  });

  test("each platform has required structure", () => {
    for (const [name, platform] of Object.entries(raw.platforms) as [string, any][]) {
      expect(platform.displayName).toBeDefined();
      expect(typeof platform.enabled).toBe("boolean");
      expect(platform.scraper.type).toBeDefined();
      expect(platform.scraper.cron).toBeDefined();
      expect(typeof platform.analysis.topN).toBe("number");
      expect(typeof platform.analysis.deepAnalysisMax).toBe("number");
    }
  });
});
