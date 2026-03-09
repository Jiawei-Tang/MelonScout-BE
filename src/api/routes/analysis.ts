import { Hono } from "hono";
import { desc } from "drizzle-orm";
import { db, schema } from "../../db";
import { analyzeNewTitles, phaseOneScore, phaseTwoDeepAnalysis } from "../../ai/analyzer";
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
  const { scored, deepAnalyzed } = await analyzeNewTitles();
  return c.json({
    message: `Phase 1: scored ${scored} titles, Phase 2: deep-analyzed ${deepAnalyzed} titles`,
    scored,
    deepAnalyzed,
  });
});

app.post("/trigger/score", async (c) => {
  const scored = await phaseOneScore();
  return c.json({ message: `Phase 1: scored ${scored} titles`, scored });
});

app.post("/trigger/deep", async (c) => {
  const deepAnalyzed = await phaseTwoDeepAnalysis();
  return c.json({ message: `Phase 2: deep-analyzed ${deepAnalyzed} titles`, deepAnalyzed });
});

app.post("/scrape", async (c) => {
  const scraped = await runScraper();
  const { scored, deepAnalyzed } = await analyzeNewTitles();
  return c.json({
    message: `Scraped ${scraped}, scored ${scored}, deep-analyzed ${deepAnalyzed}`,
    scraped,
    scored,
    deepAnalyzed,
  });
});

export default app;
