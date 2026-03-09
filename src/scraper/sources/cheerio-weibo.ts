import * as cheerio from "cheerio";
import type { ScraperSource, RawHotSearchItem } from "../types";

/**
 * Self-built cheerio scraper for Weibo hot search.
 * Parses the Weibo mobile hot search page HTML.
 * Falls back gracefully if the page structure changes.
 */
export class CheerioWeiboScraper implements ScraperSource {
  readonly platformName = "weibo";
  readonly sourceName = "cheerio-weibo";
  private readonly url = "https://s.weibo.com/top/summary";

  async fetch(): Promise<RawHotSearchItem[]> {
    const resp = await fetch(this.url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Cookie: "SUB=_2AkMTjUFaf8NxqwFRmP8Qz2_rb4x0zw",
      },
    });

    if (!resp.ok) {
      throw new Error(`Weibo returned HTTP ${resp.status}`);
    }

    const html = await resp.text();
    const $ = cheerio.load(html);
    const items: RawHotSearchItem[] = [];

    $("table tbody tr").each((_, el) => {
      const $el = $(el);
      const rankText = $el.find("td.td-01").text().trim();
      const rank = parseInt(rankText, 10);
      const $link = $el.find("td.td-02 a");
      const title = $link.text().trim();
      const href = $link.attr("href");
      const heat = $el.find("td.td-02 span").text().trim();

      if (title && !isNaN(rank)) {
        items.push({
          title,
          url: href ? `https://s.weibo.com${href}` : "",
          heatValue: heat || undefined,
          rank,
        });
      }
    });

    return items;
  }
}
