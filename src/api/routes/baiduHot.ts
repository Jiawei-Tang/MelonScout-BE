import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../../db";
import { appConfig, resolveEnv } from "../../config";
import { createScraper } from "../../scraper";
import { internalOnly } from "../middleware/internalOnly";

const app = new Hono();
app.use("*", internalOnly());

app.get("/", async (c) => {
  const baiduCfg = appConfig.platforms["baidu"];
  if (!baiduCfg) {
    return c.json({ error: "Platform 'baidu' not configured" }, 503);
  }

  const apiKeyEnv = baiduCfg.scraper.apiKeyEnv;
  if (apiKeyEnv && !resolveEnv(apiKeyEnv)) {
    return c.json({ error: `${apiKeyEnv} is not set` }, 503);
  }

  const scraper = createScraper("baidu", baiduCfg.scraper);
  if (!scraper) {
    return c.json({ error: "Scraper not found" }, 503);
  }
  const items = await scraper.fetch();

  const platform = await db.query.platforms.findFirst({
    where: eq(schema.platforms.name, "baidu"),
  });

  if (!platform) {
    return c.json({ error: "Platform 'baidu' not found in DB. Run: bun run db:seed" }, 503);
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
    keyword: item.title,
    index: item.heatValue ?? "",
    trend: (item.extra as { trend?: string })?.trend ?? "",
    brief: (item.extra as { brief?: string })?.brief ?? "",
    rank: item.rank,
  }));

  return c.json({
    code: 200,
    msg: "success",
    result: { list, fetchedAt, saved: items.length },
  });
});

export default app;

