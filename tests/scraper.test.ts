import { describe, test, expect } from "bun:test";
import { PlaceholderScraper } from "../src/scraper/sources/placeholder";
import { CheerioWeiboScraper } from "../src/scraper/sources/cheerio-weibo";
import type { ScraperSource } from "../src/scraper/types";

describe("PlaceholderScraper", () => {
  const scraper = new PlaceholderScraper();

  test("implements ScraperSource interface", () => {
    const s: ScraperSource = scraper;
    expect(s.platformName).toBeDefined();
    expect(s.sourceName).toBeDefined();
    expect(typeof s.fetch).toBe("function");
  });

  test("has correct platform name and source name", () => {
    expect(scraper.platformName).toBe("weibo");
    expect(scraper.sourceName).toBe("placeholder");
  });

  test("returns non-empty array of items", async () => {
    const items = await scraper.fetch();
    expect(items.length).toBeGreaterThan(0);
  });

  test("each item has required fields", async () => {
    const items = await scraper.fetch();
    for (const item of items) {
      expect(typeof item.title).toBe("string");
      expect(item.title.length).toBeGreaterThan(0);
      expect(typeof item.url).toBe("string");
      expect(item.url.length).toBeGreaterThan(0);
    }
  });

  test("items have rank and heatValue", async () => {
    const items = await scraper.fetch();
    for (const item of items) {
      expect(item.rank).toBeDefined();
      expect(typeof item.rank).toBe("number");
      expect(item.heatValue).toBeDefined();
    }
  });

  test("ranks are sequential starting from 1", async () => {
    const items = await scraper.fetch();
    for (let i = 0; i < items.length; i++) {
      expect(items[i].rank).toBe(i + 1);
    }
  });

  test("includes diverse test scenarios", async () => {
    const items = await scraper.fetch();
    const titles = items.map((i) => i.title).join(" ");
    expect(titles).toContain("出轨");
    expect(titles).toContain("获");
    expect(titles).toContain("震惊");
  });
});

describe("CheerioWeiboScraper", () => {
  const scraper = new CheerioWeiboScraper();

  test("has correct platform name and source name", () => {
    expect(scraper.platformName).toBe("weibo");
    expect(scraper.sourceName).toBe("cheerio-weibo");
  });

  test("implements ScraperSource interface", () => {
    const s: ScraperSource = scraper;
    expect(typeof s.fetch).toBe("function");
    expect(s.platformName).toBe("weibo");
  });
});
