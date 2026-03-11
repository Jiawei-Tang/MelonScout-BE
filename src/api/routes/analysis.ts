import { Hono } from "hono";
import { desc } from "drizzle-orm";
import { db, schema } from "../../db";
import { appConfig, getEnabledPlatforms } from "../../config";
import { runAllAnalysis } from "../../ai/analyzer";
import { createScraper, runPlatformScraper } from "../../scraper";

const app = new Hono();

app.get("/", async (c) => {
  const limit = Math.min(Number(c.req.query("limit")) || 50, 200);
  const offset = Number(c.req.query("offset")) || 0;

  const results = await db
    .select()
    .from(schema.aiAnalysis)
    .orderBy(desc(schema.aiAnalysis.updatedAt))
    .limit(limit)
    .offset(offset);

  return c.json({ data: results, meta: { limit, offset } });
});

app.post("/trigger", async (c) => {
  const enabledPlatforms = getEnabledPlatforms();
  const platforms = enabledPlatforms.map(([name, cfg]) => ({ name, analysis: cfg.analysis }));
  const { triaged, factChecked } = await runAllAnalysis(platforms);
  return c.json({
    message: `Triaged ${triaged}, fact-checked ${factChecked}`,
    triaged,
    factChecked,
  });
});

app.post("/scrape", async (c) => {
  const enabledPlatforms = getEnabledPlatforms();

  let totalScraped = 0;
  for (const [name, cfg] of enabledPlatforms) {
    try {
      const scraper = createScraper(name, cfg.scraper);
      totalScraped += await runPlatformScraper(name, scraper);
    } catch (err) {
      console.error(`❌ Scrape failed [${name}]:`, err);
    }
  }

  const platforms = enabledPlatforms.map(([name, cfg]) => ({ name, analysis: cfg.analysis }));
  const { triaged, factChecked } = await runAllAnalysis(platforms);

  return c.json({
    message: `Scraped ${totalScraped}, triaged ${triaged}, fact-checked ${factChecked}`,
    scraped: totalScraped,
    triaged,
    factChecked,
  });
});

export default app;
