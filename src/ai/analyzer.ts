import { eq, isNull, isNotNull, desc, gte, and } from "drizzle-orm";
import { db, schema } from "../db";
import { aiProvider } from "./index";
import { config } from "../config";

const CLICKBAIT_KEYWORDS = [
  "震惊", "竟然", "真相", "速看", "独家揭秘", "内幕",
  "绝对想不到", "不知道的", "居然", "月入", "必看",
  "太可怕了", "细思极恐", "万万没想到", "赶紧看",
];

function matchesClickbaitPattern(title: string): boolean {
  return CLICKBAIT_KEYWORDS.some((kw) => title.includes(kw));
}

// ── Phase 1: Quick Score ───────────────────────────────────────────
//
// Scores all unanalyzed titles (filtered by top-N + keyword pattern).
// Stores isClickbait, score, reason into ai_analysis.

export async function phaseOneScore(): Promise<number> {
  const unanalyzed = await db
    .select({
      id: schema.hotSearches.id,
      title: schema.hotSearches.title,
      rank: schema.hotSearches.rank,
    })
    .from(schema.hotSearches)
    .leftJoin(schema.aiAnalysis, eq(schema.hotSearches.id, schema.aiAnalysis.hotSearchId))
    .where(isNull(schema.aiAnalysis.id))
    .orderBy(desc(schema.hotSearches.createdAt));

  const topN = config.ANALYSIS_TOP_N;
  const candidates =
    topN > 0
      ? unanalyzed.filter(
          (item) =>
            (item.rank !== null && item.rank <= topN) ||
            matchesClickbaitPattern(item.title),
        )
      : unanalyzed;

  const skipped = unanalyzed.length - candidates.length;
  if (skipped > 0) {
    console.log(
      `🔍 Phase 1 filter: ${candidates.length} candidates from ${unanalyzed.length} (top ${topN} + keyword match, skipped ${skipped})`,
    );
  }

  console.log(`📊 Phase 1: Scoring ${candidates.length} titles with [${aiProvider.modelName}]...`);

  let scored = 0;
  for (const item of candidates) {
    try {
      const result = await aiProvider.score(item.title);

      await db.insert(schema.aiAnalysis).values({
        hotSearchId: item.id,
        isClickbait: result.isClickbait,
        score: result.score,
        reason: result.reason,
        aiModel: aiProvider.modelName,
      });

      scored++;
    } catch (err) {
      console.error(`❌ Phase 1 score failed for "${item.title}":`, err);
    }
  }

  console.log(`✅ Phase 1 complete: ${scored}/${candidates.length} titles scored`);
  return scored;
}

// ── Phase 2: Deep Search Analysis ──────────────────────────────────
//
// Picks the top DEEP_ANALYSIS_MAX items with score >= DEEP_ANALYSIS_THRESHOLD
// that have NOT yet been deep-analyzed, then runs a thorough search analysis
// on each one sequentially.

export async function phaseTwoDeepAnalysis(): Promise<number> {
  const threshold = config.DEEP_ANALYSIS_THRESHOLD;
  const maxItems = config.DEEP_ANALYSIS_MAX;

  const candidates = await db
    .select({
      id: schema.aiAnalysis.id,
      hotSearchId: schema.aiAnalysis.hotSearchId,
      title: schema.hotSearches.title,
      score: schema.aiAnalysis.score,
      reason: schema.aiAnalysis.reason,
    })
    .from(schema.aiAnalysis)
    .innerJoin(schema.hotSearches, eq(schema.aiAnalysis.hotSearchId, schema.hotSearches.id))
    .where(
      and(
        gte(schema.aiAnalysis.score, threshold),
        isNull(schema.aiAnalysis.deepAnalyzedAt),
      ),
    )
    .orderBy(desc(schema.aiAnalysis.score))
    .limit(maxItems);

  if (candidates.length === 0) {
    console.log(`🔬 Phase 2: No items above threshold (${threshold}), skipping deep analysis`);
    return 0;
  }

  console.log(
    `🔬 Phase 2: Deep analyzing ${candidates.length} high-score items (threshold ≥${threshold}, max ${maxItems}) with [${aiProvider.modelName}]...`,
  );

  let analyzed = 0;
  for (const item of candidates) {
    try {
      console.log(`  🔎 Analyzing: [score=${item.score}] "${item.title}"`);

      const result = await aiProvider.deepAnalyze(
        item.title,
        item.score ?? 0,
        item.reason ?? "",
      );

      await db
        .update(schema.aiAnalysis)
        .set({
          deepAnalysis: result.deepAnalysis,
          verdict: result.verdict,
          deepAiModel: aiProvider.modelName,
          deepAnalyzedAt: new Date(),
        })
        .where(eq(schema.aiAnalysis.id, item.id));

      analyzed++;
    } catch (err) {
      console.error(`❌ Phase 2 deep analysis failed for "${item.title}":`, err);
    }
  }

  console.log(`✅ Phase 2 complete: ${analyzed}/${candidates.length} items deep-analyzed`);
  return analyzed;
}

// ── Combined: run both phases sequentially ─────────────────────────

export async function analyzeNewTitles(): Promise<{ scored: number; deepAnalyzed: number }> {
  const scored = await phaseOneScore();
  const deepAnalyzed = await phaseTwoDeepAnalysis();
  return { scored, deepAnalyzed };
}
