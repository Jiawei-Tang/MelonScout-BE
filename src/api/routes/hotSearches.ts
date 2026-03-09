import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "../../db";

const app = new Hono();

app.get("/", async (c) => {
  const platformId = c.req.query("platformId");
  const limit = Math.min(Number(c.req.query("limit")) || 50, 200);
  const offset = Number(c.req.query("offset")) || 0;

  let query = db
    .select({
      id: schema.hotSearches.id,
      platformId: schema.hotSearches.platformId,
      title: schema.hotSearches.title,
      url: schema.hotSearches.url,
      description: schema.hotSearches.description,
      heatValue: schema.hotSearches.heatValue,
      rank: schema.hotSearches.rank,
      source: schema.hotSearches.source,
      createdAt: schema.hotSearches.createdAt,
      analysis: {
        isClickbait: schema.aiAnalysis.isClickbait,
        score: schema.aiAnalysis.score,
        reason: schema.aiAnalysis.reason,
        aiModel: schema.aiAnalysis.aiModel,
      },
    })
    .from(schema.hotSearches)
    .leftJoin(schema.aiAnalysis, eq(schema.hotSearches.id, schema.aiAnalysis.hotSearchId))
    .orderBy(desc(schema.hotSearches.createdAt))
    .limit(limit)
    .offset(offset);

  if (platformId) {
    query = query.where(eq(schema.hotSearches.platformId, Number(platformId))) as typeof query;
  }

  const results = await query;
  return c.json({ data: results, meta: { limit, offset } });
});

app.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const result = await db
    .select({
      id: schema.hotSearches.id,
      platformId: schema.hotSearches.platformId,
      title: schema.hotSearches.title,
      url: schema.hotSearches.url,
      description: schema.hotSearches.description,
      heatValue: schema.hotSearches.heatValue,
      rank: schema.hotSearches.rank,
      source: schema.hotSearches.source,
      createdAt: schema.hotSearches.createdAt,
      analysis: {
        id: schema.aiAnalysis.id,
        isClickbait: schema.aiAnalysis.isClickbait,
        score: schema.aiAnalysis.score,
        reason: schema.aiAnalysis.reason,
        aiModel: schema.aiAnalysis.aiModel,
        updatedAt: schema.aiAnalysis.updatedAt,
      },
    })
    .from(schema.hotSearches)
    .leftJoin(schema.aiAnalysis, eq(schema.hotSearches.id, schema.aiAnalysis.hotSearchId))
    .where(eq(schema.hotSearches.id, id));

  if (result.length === 0) {
    return c.json({ error: "Hot search not found" }, 404);
  }

  return c.json({ data: result[0] });
});

export default app;
