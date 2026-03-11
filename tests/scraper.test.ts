import { describe, test, expect } from "bun:test";
import { PlaceholderScraper } from "../src/scraper/sources/placeholder";
import { CheerioWeiboScraper } from "../src/scraper/sources/cheerio-weibo";
import type { ScraperSource } from "../src/scraper/types";

describe("PlaceholderScraper", () => {
  test("defaults to weibo platform", () => {
    const scraper = new PlaceholderScraper();
    expect(scraper.platformName).toBe("weibo");
    expect(scraper.sourceName).toBe("placeholder");
  });

  test("accepts custom platform name (DI)", () => {
    const scraper = new PlaceholderScraper("douyin");
    expect(scraper.platformName).toBe("douyin");
  });

  test("implements ScraperSource interface", () => {
    const s: ScraperSource = new PlaceholderScraper();
    expect(typeof s.fetch).toBe("function");
  });

  test("returns non-empty items with required fields", async () => {
    const items = await new PlaceholderScraper().fetch();
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(typeof item.title).toBe("string");
      expect(item.title.length).toBeGreaterThan(0);
      expect(typeof item.url).toBe("string");
      expect(item.rank).toBeDefined();
      expect(item.heatValue).toBeDefined();
    }
  });

  test("ranks are sequential starting from 1", async () => {
    const items = await new PlaceholderScraper().fetch();
    for (let i = 0; i < items.length; i++) {
      expect(items[i].rank).toBe(i + 1);
    }
  });
});

describe("CheerioWeiboScraper", () => {
  test("has correct identifiers", () => {
    const scraper = new CheerioWeiboScraper();
    expect(scraper.platformName).toBe("weibo");
    expect(scraper.sourceName).toBe("cheerio-weibo");
  });

  test("implements ScraperSource interface", () => {
    const s: ScraperSource = new CheerioWeiboScraper();
    expect(typeof s.fetch).toBe("function");
  });
});
