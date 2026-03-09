import { describe, test, expect } from "bun:test";
import { PlaceholderScraper } from "../src/scraper/sources/placeholder";
import { VvhanScraper, SUPPORTED_PLATFORMS } from "../src/scraper/sources/vvhan";
import { CheerioWeiboScraper } from "../src/scraper/sources/cheerio-weibo";
import type { RawHotSearchItem, ScraperSource } from "../src/scraper/types";

// ── PlaceholderScraper ─────────────────────────────────────────────

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

  test("items conform to RawHotSearchItem (no extra fields)", async () => {
    const items = await scraper.fetch();
    const allowedKeys = new Set(["title", "url", "heatValue", "rank"]);
    for (const item of items) {
      for (const key of Object.keys(item)) {
        expect(allowedKeys.has(key)).toBe(true);
      }
    }
  });

  test("ranks are sequential starting from 1", async () => {
    const items = await scraper.fetch();
    for (let i = 0; i < items.length; i++) {
      expect(items[i].rank).toBe(i + 1);
    }
  });
});

// ── VvhanScraper ───────────────────────────────────────────────────

describe("VvhanScraper", () => {
  test("supports 6 platforms", () => {
    expect(SUPPORTED_PLATFORMS.length).toBe(6);
    expect(SUPPORTED_PLATFORMS).toContain("weibo");
    expect(SUPPORTED_PLATFORMS).toContain("zhihu");
    expect(SUPPORTED_PLATFORMS).toContain("baidu");
    expect(SUPPORTED_PLATFORMS).toContain("douyin");
    expect(SUPPORTED_PLATFORMS).toContain("bilibili");
    expect(SUPPORTED_PLATFORMS).toContain("toutiao");
  });

  test("throws for unsupported platform", () => {
    expect(() => new VvhanScraper("fakePlatform")).toThrow("Unsupported platform");
    expect(() => new VvhanScraper("")).toThrow();
  });

  test("constructs valid scrapers for each platform", () => {
    for (const p of SUPPORTED_PLATFORMS) {
      const scraper = new VvhanScraper(p);
      expect(scraper.platformName).toBe(p);
      expect(scraper.sourceName).toBe("vvhan");
    }
  });

  test("implements ScraperSource interface", () => {
    const scraper: ScraperSource = new VvhanScraper("weibo");
    expect(typeof scraper.fetch).toBe("function");
  });
});

// ── CheerioWeiboScraper ────────────────────────────────────────────

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
