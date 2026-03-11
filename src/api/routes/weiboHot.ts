import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../../db";
import { appConfig, resolveEnv } from "../../config";
import { createScraper, runPlatformScraper } from "../../scraper";

const app = new Hono();

app.get("/", async (c) => {
  const weiboCfg = appConfig.platforms["weibo"];
  if (!weiboCfg) {
    return c.json({ error: "Platform 'weibo' not configured" }, 503);
  }

  const apiKeyEnv = weiboCfg.scraper.apiKeyEnv;
  if (apiKeyEnv && !resolveEnv(apiKeyEnv)) {
    return c.json({ error: `${apiKeyEnv} is not set` }, 503);
  }

  const scraper = createScraper("weibo", weiboCfg.scraper);
  const items = await scraper.fetch();

  const platform = await db.query.platforms.findFirst({
    where: eq(schema.platforms.name, "weibo"),
  });

  if (!platform) {
    return c.json({ error: "Platform 'weibo' not found in DB. Run: bun run db:seed" }, 503);
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
    result: { list, fetchedAt, saved: items.length },
  });
});

export default app;
