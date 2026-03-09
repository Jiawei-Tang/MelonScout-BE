import { describe, test, expect } from "bun:test";
import { PlaceholderScraper } from "../src/scraper/sources/placeholder";
import { VvhanScraper, SUPPORTED_PLATFORMS } from "../src/scraper/sources/vvhan";

describe("PlaceholderScraper", () => {
  test("returns mock hot search items", async () => {
    const scraper = new PlaceholderScraper();
    const items = await scraper.fetch();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].title).toBeDefined();
    expect(items[0].url).toBeDefined();
    expect(items[0].rank).toBeDefined();
  });

  test("has correct platform name", () => {
    const scraper = new PlaceholderScraper();
    expect(scraper.platformName).toBe("weibo");
    expect(scraper.sourceName).toBe("placeholder");
  });

  test("items do not have description field", async () => {
    const scraper = new PlaceholderScraper();
    const items = await scraper.fetch();
    for (const item of items) {
      expect(item).not.toHaveProperty("description");
    }
  });
});

describe("VvhanScraper", () => {
  test("supports expected platforms", () => {
    expect(SUPPORTED_PLATFORMS).toContain("weibo");
    expect(SUPPORTED_PLATFORMS).toContain("zhihu");
    expect(SUPPORTED_PLATFORMS).toContain("baidu");
    expect(SUPPORTED_PLATFORMS).toContain("douyin");
    expect(SUPPORTED_PLATFORMS).toContain("bilibili");
    expect(SUPPORTED_PLATFORMS).toContain("toutiao");
  });

  test("throws for unsupported platform", () => {
    expect(() => new VvhanScraper("fakePlatform")).toThrow("Unsupported platform");
  });

  test("constructs valid scrapers for each platform", () => {
    for (const p of SUPPORTED_PLATFORMS) {
      const scraper = new VvhanScraper(p);
      expect(scraper.platformName).toBe(p);
      expect(scraper.sourceName).toBe("vvhan");
    }
  });
});
