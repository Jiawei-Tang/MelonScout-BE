import { describe, test, expect } from "bun:test";
import { PlaceholderScraper } from "../src/scraper/sources/placeholder";

describe("PlaceholderScraper", () => {
  test("returns mock hot search items", async () => {
    const scraper = new PlaceholderScraper();
    const items = await scraper.fetch();
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].title).toBeDefined();
    expect(items[0].url).toBeDefined();
  });

  test("has correct platform name", () => {
    const scraper = new PlaceholderScraper();
    expect(scraper.platformName).toBe("weibo");
    expect(scraper.sourceName).toBe("placeholder");
  });
});
