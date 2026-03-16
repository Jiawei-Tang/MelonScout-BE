import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import type { ScraperSource } from "./types";

export async function runPlatformScraper(
  platformName: string,
  scraper: ScraperSource,
): Promise<number[]> {
  console.log(
    `📡 Fetching [${platformName}] via ${scraper.sourceName}...`,
  );

  const items = await scraper.fetch();

  const platform = await db.query.platforms.findFirst({
    where: eq(schema.platforms.name, platformName),
  });

  if (!platform) {
    console.warn(`⚠️ Platform "${platformName}" not found in DB, skipping.`);
    return [];
  }

  const rawIds: number[] = [];
  for (const item of items) {
    const [row] = await db
      .insert(schema.rawHotSearches)
      .values({
        platformId: platform.id,
        title: item.title,
        url: item.url,
        heatValue: item.heatValue ?? null,
        rank: item.rank ?? null,
        extra: item.extra ?? null,
      })
      .returning({ id: schema.rawHotSearches.id });
    rawIds.push(row.id);
  }

  console.log(`✅ [${platformName}] ${rawIds.length} raw items saved`);
  return rawIds;
}
