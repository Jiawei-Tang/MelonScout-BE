import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../../db";
import { TianapiWeiboScraper } from "../../scraper/sources/tianapi-weibo";
import { config } from "../../config";

const app = new Hono();

/**
 * GET /api/weibo-hot
 * Fetches 微博热搜 from 天行数据 (tianapi), saves to DB under platform "weibo", returns the list.
 * Requires TIANAPI_API_KEY in .env.
 */
app.get("/", async (c) => {
  if (!config.TIANAPI_API_KEY) {
    return c.json(
      { error: "TIANAPI_API_KEY is not configured" },
      503,
    );
  }

  const scraper = new TianapiWeiboScraper(config.TIANAPI_API_KEY);
  const items = await scraper.fetch();

  const platform = await db.query.platforms.findFirst({
    where: eq(schema.platforms.name, "weibo"),
  });

  if (!platform) {
    return c.json(
      { error: "Platform 'weibo' not found in DB. Run: bun run db:seed" },
      503,
    );
  }

  const fetchedAt = new Date().toISOString();

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

  const list = items.map((item) => ({
    hotword: item.title,
    hotwordnum: (item.extra as { hotwordnum?: string })?.hotwordnum ?? item.heatValue ?? "",
    hottag: (item.extra as { hottag?: string })?.hottag ?? "",
    rank: item.rank,
    heatValue: item.heatValue,
  }));

  return c.json({
    code: 200,
    msg: "success",
    result: {
      list,
      fetchedAt,
      saved: items.length,
    },
  });
});

export default app;
