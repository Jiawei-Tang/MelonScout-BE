import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import type { ScraperSource } from "./types";
import { PlaceholderScraper } from "./sources/placeholder";
import { VvhanScraper, SUPPORTED_PLATFORMS } from "./sources/vvhan";
import { CheerioWeiboScraper } from "./sources/cheerio-weibo";
import { config } from "../config";

function buildSources(): ScraperSource[] {
  switch (config.SCRAPER_SOURCE) {
    case "vvhan":
      return SUPPORTED_PLATFORMS.map((p) => new VvhanScraper(p));
    case "cheerio":
      return [new CheerioWeiboScraper()];
    case "placeholder":
    default:
      return [new PlaceholderScraper()];
  }
}

const sources: ScraperSource[] = buildSources();

export function registerSource(source: ScraperSource) {
  sources.push(source);
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
