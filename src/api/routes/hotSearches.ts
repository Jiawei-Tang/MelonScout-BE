import { Hono } from "hono";
import { and, desc, eq, gte, sql, isNotNull } from "drizzle-orm";
import { db, schema } from "../../db";

const app = new Hono();

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 30;
const MAX_DAYS = 7;
const DEFAULT_DAYS = 7;

const heatValueNum = sql<number>`
  COALESCE(
    CASE
      WHEN ${schema.hotSearches.heatValue} IS NULL THEN 0
      WHEN ${schema.hotSearches.heatValue} LIKE '%亿%' THEN COALESCE(NULLIF(REGEXP_REPLACE(${schema.hotSearches.heatValue}, '[^0-9\\.]', '', 'g'), ''), '0')::numeric * 100000000
      WHEN ${schema.hotSearches.heatValue} LIKE '%万%' THEN COALESCE(NULLIF(REGEXP_REPLACE(${schema.hotSearches.heatValue}, '[^0-9\\.]', '', 'g'), ''), '0')::numeric * 10000
      ELSE COALESCE(NULLIF(REGEXP_REPLACE(${schema.hotSearches.heatValue}, '[^0-9\\.]', '', 'g'), ''), '0')::numeric
    END,
    0
  )
`;

const effectiveUpdatedAt = sql<Date>`COALESCE(${schema.aiAnalysis.updatedAt}, ${schema.hotSearches.createdAt})`;
const updatedDay = sql<Date>`DATE_TRUNC('day', ${effectiveUpdatedAt})`;

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

app.get("/", async (c) => {
  const platformId = c.req.query("platformId");
  const hasAnalysisRaw = c.req.query("hasAnalysis");
  const hasAnalysis = hasAnalysisRaw === "true" ? true : hasAnalysisRaw === "false" ? false : null;
  const limit = Math.min(parsePositiveInt(c.req.query("limit"), DEFAULT_LIMIT), MAX_LIMIT);
  const offset = Number(c.req.query("offset")) || 0;
  const days = Math.min(parsePositiveInt(c.req.query("days"), DEFAULT_DAYS), MAX_DAYS);
  const windowStartIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const whereConds = [gte(effectiveUpdatedAt, windowStartIso)];
  if (platformId) whereConds.push(eq(schema.hotSearches.platformId, Number(platformId)));
  if (hasAnalysis === true) whereConds.push(isNotNull(schema.aiAnalysis.id));

  const rows = await db
    .select({
      id: schema.hotSearches.id,
      platformId: schema.hotSearches.platformId,
      title: schema.hotSearches.title,
      url: schema.hotSearches.url,
      heatValue: schema.hotSearches.heatValue,
      rank: schema.hotSearches.rank,
      createdAt: schema.hotSearches.createdAt,
      extra: schema.hotSearches.extra,
      analysis: {
        id: schema.aiAnalysis.id,
        needsFactCheck: schema.aiAnalysis.needsFactCheck,
        triageReason: schema.aiAnalysis.triageReason,
        category: schema.aiAnalysis.category,
        aiModel: schema.aiAnalysis.aiModel,
        isClickbait: schema.aiAnalysis.isClickbait,
        score: schema.aiAnalysis.score,
        reason: schema.aiAnalysis.reason,
        deepAnalysis: schema.aiAnalysis.deepAnalysis,
        verdict: schema.aiAnalysis.verdict,
        deepAiModel: schema.aiAnalysis.deepAiModel,
        updatedAt: schema.aiAnalysis.updatedAt,
        upVotes: schema.aiAnalysis.upVotes,
        downVotes: schema.aiAnalysis.downVotes,
        deepAnalyzedAt: schema.aiAnalysis.deepAnalyzedAt,
      },
    })
    .from(schema.hotSearches)
    .leftJoin(schema.aiAnalysis, eq(schema.hotSearches.id, schema.aiAnalysis.hotSearchId))
    .where(and(...whereConds))
    .orderBy(desc(updatedDay), desc(heatValueNum), desc(effectiveUpdatedAt))
    .limit(limit)
    .offset(offset);

  const nextRows = await db
    .select({ id: schema.hotSearches.id })
    .from(schema.hotSearches)
    .leftJoin(schema.aiAnalysis, eq(schema.hotSearches.id, schema.aiAnalysis.hotSearchId))
    .where(and(...whereConds))
    .orderBy(desc(updatedDay), desc(heatValueNum), desc(effectiveUpdatedAt))
    .limit(1)
    .offset(offset + limit);

  return c.json({
    data: rows,
    meta: {
      limit,
      offset,
      days,
      hasAnalysis,
      hasMore: nextRows.length > 0,
      nextOffset: nextRows.length > 0 ? offset + limit : null
    }
  });
});

app.get("/:id", async (c) => {
  const id = Number(c.req.param("id"));
  const result = await db
    .select({
      id: schema.hotSearches.id,
      platformId: schema.hotSearches.platformId,
      title: schema.hotSearches.title,
      url: schema.hotSearches.url,
      heatValue: schema.hotSearches.heatValue,
      rank: schema.hotSearches.rank,
      createdAt: schema.hotSearches.createdAt,
      extra: schema.hotSearches.extra,
      analysis: {
        id: schema.aiAnalysis.id,
        needsFactCheck: schema.aiAnalysis.needsFactCheck,
        triageReason: schema.aiAnalysis.triageReason,
        category: schema.aiAnalysis.category,
        aiModel: schema.aiAnalysis.aiModel,
        isClickbait: schema.aiAnalysis.isClickbait,
        score: schema.aiAnalysis.score,
        reason: schema.aiAnalysis.reason,
        deepAnalysis: schema.aiAnalysis.deepAnalysis,
        verdict: schema.aiAnalysis.verdict,
        deepAiModel: schema.aiAnalysis.deepAiModel,
        updatedAt: schema.aiAnalysis.updatedAt,
        upVotes: schema.aiAnalysis.upVotes,
        downVotes: schema.aiAnalysis.downVotes,
        deepAnalyzedAt: schema.aiAnalysis.deepAnalyzedAt,
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

app.get("/highlights/top", async (c) => {
  const days = Math.min(parsePositiveInt(c.req.query("days"), DEFAULT_DAYS), MAX_DAYS);
  const windowStartIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const rows = await db
    .select({
      id: schema.hotSearches.id,
      platformId: schema.hotSearches.platformId,
      title: schema.hotSearches.title,
      url: schema.hotSearches.url,
      heatValue: schema.hotSearches.heatValue,
      rank: schema.hotSearches.rank,
      createdAt: schema.hotSearches.createdAt,
      extra: schema.hotSearches.extra,
      analysis: {
        id: schema.aiAnalysis.id,
        needsFactCheck: schema.aiAnalysis.needsFactCheck,
        triageReason: schema.aiAnalysis.triageReason,
        category: schema.aiAnalysis.category,
        aiModel: schema.aiAnalysis.aiModel,
        isClickbait: schema.aiAnalysis.isClickbait,
        score: schema.aiAnalysis.score,
        reason: schema.aiAnalysis.reason,
        deepAnalysis: schema.aiAnalysis.deepAnalysis,
        verdict: schema.aiAnalysis.verdict,
        deepAiModel: schema.aiAnalysis.deepAiModel,
        updatedAt: schema.aiAnalysis.updatedAt,
        upVotes: schema.aiAnalysis.upVotes,
        downVotes: schema.aiAnalysis.downVotes,
        deepAnalyzedAt: schema.aiAnalysis.deepAnalyzedAt
      },
      compositeScore: sql<number>`
        (
          LN(1 + ${heatValueNum})
          + LEAST(2.0, (${schema.aiAnalysis.upVotes} * 0.22))
          - LEAST(1.0, (${schema.aiAnalysis.downVotes} * 0.1))
          + (24.0 / (EXTRACT(EPOCH FROM (NOW() - ${effectiveUpdatedAt})) / 3600 + 2.0))
        )
      `
    })
    .from(schema.hotSearches)
    .innerJoin(schema.aiAnalysis, eq(schema.hotSearches.id, schema.aiAnalysis.hotSearchId))
    .where(and(gte(effectiveUpdatedAt, windowStartIso), isNotNull(schema.aiAnalysis.score)))
    .orderBy(
      desc(sql`(
        LN(1 + ${heatValueNum})
        + LEAST(2.0, (${schema.aiAnalysis.upVotes} * 0.22))
        - LEAST(1.0, (${schema.aiAnalysis.downVotes} * 0.1))
        + (24.0 / (EXTRACT(EPOCH FROM (NOW() - ${effectiveUpdatedAt})) / 3600 + 2.0))
      )`),
      desc(effectiveUpdatedAt)
    )
    .limit(3);

  return c.json({ data: rows, meta: { days, size: rows.length } });
});

app.post("/:id/votes", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return c.json({ error: "Invalid id" }, 400);
  }

  const body = await c.req.json<{ action?: "up" | "down" }>().catch(() => null);
  const action = body?.action;
  if (action !== "up" && action !== "down") {
    return c.json({ error: "Invalid action, expected up|down" }, 400);
  }

  const target = await db
    .select({
      analysisId: schema.aiAnalysis.id,
      upVotes: schema.aiAnalysis.upVotes,
      downVotes: schema.aiAnalysis.downVotes
    })
    .from(schema.aiAnalysis)
    .where(eq(schema.aiAnalysis.hotSearchId, id))
    .limit(1);

  if (target.length === 0) {
    return c.json({ error: "AI analysis not found for this hot search" }, 404);
  }

  const current = target[0];
  const nextUp = action === "up" ? current.upVotes + 1 : current.upVotes;
  const nextDown = action === "down" ? current.downVotes + 1 : current.downVotes;

  await db
    .update(schema.aiAnalysis)
    .set({ upVotes: nextUp, downVotes: nextDown, updatedAt: new Date() })
    .where(eq(schema.aiAnalysis.id, current.analysisId));

  return c.json({ data: { hotSearchId: id, upVotes: nextUp, downVotes: nextDown } });
});

export default app;
