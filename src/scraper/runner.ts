import { and, eq, gte } from "drizzle-orm";
import { db, schema } from "../db";
import type { ScraperSource } from "./types";

function parseHeatValue(heatValue: string | null | undefined): number {
  if (heatValue == null || heatValue.trim() === "") return 0;
  const num = parseFloat(heatValue.replace(/[^0-9.]/g, "")) || 0;
  if (heatValue.includes("亿")) return num * 100_000_000;
  if (heatValue.includes("万")) return num * 10_000;
  return num;
}

export async function runPlatformScraper(
  platformName: string,
  scraper: ScraperSource,
): Promise<number> {
  console.log(
    `📡 Fetching [${platformName}] via ${scraper.sourceName}...`,
  );

  const items = await scraper.fetch();

  const platform = await db.query.platforms.findFirst({
    where: eq(schema.platforms.name, platformName),
  });

  if (!platform) {
    console.warn(`⚠️ Platform "${platformName}" not found in DB, skipping.`);
    return 0;
  }

  let inserted = 0;
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
      if (newHeat < existingHeat) continue;

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
      inserted++;
    }
  }

  console.log(`✅ [${platformName}] ${inserted} new, ${items.length} total`);
  return inserted;
}
