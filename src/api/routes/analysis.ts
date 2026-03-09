import { Hono } from "hono";
import { desc } from "drizzle-orm";
import { db, schema } from "../../db";
import { analyzeNewTitles } from "../../ai/analyzer";
import { runScraper } from "../../scraper";

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
  const count = await analyzeNewTitles();
  return c.json({ message: `Analyzed ${count} titles`, count });
});

app.post("/scrape", async (c) => {
  const scraped = await runScraper();
  const analyzed = await analyzeNewTitles();
  return c.json({
    message: `Scraped ${scraped} items, analyzed ${analyzed} titles`,
    scraped,
    analyzed,
  });
});

export default app;
