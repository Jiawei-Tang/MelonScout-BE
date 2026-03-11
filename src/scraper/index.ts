import { and, eq, gte } from "drizzle-orm";
import { db, schema } from "../db";
import type { ScraperSource } from "./types";
import { PlaceholderScraper } from "./sources/placeholder";
import { CheerioWeiboScraper } from "./sources/cheerio-weibo";
import { TianapiWeiboScraper } from "./sources/tianapi-weibo";
import { config } from "../config";

function buildSources(): ScraperSource[] {
  switch (config.SCRAPER_SOURCE) {
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

/** Parse heatValue string (e.g. "123万", "1.2亿") to numeric for comparison. */
function parseHeatValue(heatValue: string | null | undefined): number {
  if (heatValue == null || heatValue.trim() === "") return 0;
  const num = parseFloat(heatValue.replace(/[^0-9.]/g, "")) || 0;
  if (heatValue.includes("亿")) return num * 100_000_000;
  if (heatValue.includes("万")) return num * 10_000;
  return num;
}

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
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

        const existing = await db.query.hotSearches.findFirst({
          where: and(
            eq(schema.hotSearches.platformId, platform.id),
            eq(schema.hotSearches.title, item.title),
            gte(schema.hotSearches.createdAt, threeDaysAgo),
          ),
        });

        if (existing) {
          const existingHeat = parseHeatValue(existing.heatValue);
          const newHeat = parseHeatValue(item.heatValue);
          if (newHeat < existingHeat) {
            continue;
          }
          await db
            .update(schema.hotSearches)
            .set({
              heatValue: item.heatValue ?? existing.heatValue,
              rank: item.rank ?? existing.rank,
              extra: item.extra ?? existing.extra,
            })
            .where(eq(schema.hotSearches.id, existing.id));
        } else {
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
      }

      console.log(`✅ Inserted ${items.length} items from [${source.platformName}]`);
    } catch (err) {
      console.error(`❌ Scraper error [${source.platformName}]:`, err);
    }
  }

  return totalInserted;
}
