import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import type { ScraperSource } from "./types";
import { PlaceholderScraper } from "./sources/placeholder";
import { VvhanScraper, SUPPORTED_PLATFORMS } from "./sources/vvhan";
import { CheerioWeiboScraper } from "./sources/cheerio-weibo";
import { TianapiWeiboScraper } from "./sources/tianapi-weibo";
import { config } from "../config";

function buildSources(): ScraperSource[] {
  switch (config.SCRAPER_SOURCE) {
    case "vvhan":
      return SUPPORTED_PLATFORMS.map((p) => new VvhanScraper(p));
    case "cheerio":
      return [new CheerioWeiboScraper()];
    case "tianapi":
      if (!config.TIANAPI_API_KEY) {
        console.warn("⚠️ TIANAPI_API_KEY not set, tianapi scraper will fail");
      }
      return [new TianapiWeiboScraper(config.TIANAPI_API_KEY ?? "")];
    case "placeholder":
    default:
      return [new PlaceholderScraper()];
  }
}

const sources: ScraperSource[] = buildSources();

export function registerSource(source: ScraperSource) {
  sources.push(source);
}

/** Fetch 微博热搜 from tianapi and save to DB. Returns saved count (0 if no key or no weibo platform). */
export async function fetchAndSaveWeiboHot(): Promise<{ saved: number; items: import("./types").RawHotSearchItem[] }> {
  if (!config.TIANAPI_API_KEY) {
    return { saved: 0, items: [] };
  }
  const scraper = new TianapiWeiboScraper(config.TIANAPI_API_KEY);
  const items = await scraper.fetch();
  const platform = await db.query.platforms.findFirst({
    where: eq(schema.platforms.name, "weibo"),
  });
  if (!platform) {
    return { saved: 0, items: [] };
  }
  for (const item of items) {
    await db.insert(schema.hotSearches).values({
      platformId: platform.id,
      title: item.title,
      url: item.url,
      heatValue: item.heatValue ?? null,
      rank: item.rank ?? null,
      extra: item.extra ?? null,
    });
  }
  return { saved: items.length, items };
}

export async function runScraper(): Promise<number> {
  let totalInserted = 0;

  for (const source of sources) {
    try {
      console.log(`📡 Fetching from [${source.platformName}] via ${source.sourceName}...`);
      const items = await source.fetch();

      const platform = await db.query.platforms.findFirst({
        where: eq(schema.platforms.name, source.platformName),
      });

      if (!platform) {
        console.warn(`⚠️ Platform "${source.platformName}" not found in DB, skipping.`);
        continue;
      }

      for (const item of items) {
        await db.insert(schema.hotSearches).values({
          platformId: platform.id,
          title: item.title,
          url: item.url,
          heatValue: item.heatValue ?? null,
          rank: item.rank ?? null,
          extra: item.extra ?? null,
        });
        totalInserted++;
      }

      console.log(`✅ Inserted ${items.length} items from [${source.platformName}]`);
    } catch (err) {
      console.error(`❌ Scraper error [${source.platformName}]:`, err);
    }
  }

  return totalInserted;
}
