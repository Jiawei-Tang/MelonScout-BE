import { describe, test, expect } from "bun:test";
import { CheerioWeiboScraper } from "../src/scraper/sources/cheerio-weibo";
import type { ScraperSource } from "../src/scraper/types";

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
