import { Hono } from "hono";
import { desc } from "drizzle-orm";
import { db, schema } from "../../db";
import { analyzeNewTitles, phaseOneTriage, phaseTwoFactCheck } from "../../ai/analyzer";
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
  const { triaged, factChecked } = await analyzeNewTitles();
  return c.json({
    message: `Phase 1: triaged ${triaged}, Phase 2: fact-checked ${factChecked}`,
    triaged,
    factChecked,
  });
});

app.post("/trigger/triage", async (c) => {
  const triaged = await phaseOneTriage();
  return c.json({ message: `Phase 1: triaged ${triaged} titles`, triaged });
});

app.post("/trigger/factcheck", async (c) => {
  const factChecked = await phaseTwoFactCheck();
  return c.json({ message: `Phase 2: fact-checked ${factChecked} titles`, factChecked });
});

app.post("/scrape", async (c) => {
  const scraped = await runScraper();
  const { triaged, factChecked } = await analyzeNewTitles();
  return c.json({
    message: `Scraped ${scraped}, triaged ${triaged}, fact-checked ${factChecked}`,
    scraped,
    triaged,
    factChecked,
  });
});

export default app;
