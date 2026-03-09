import { eq, isNull, desc, lte } from "drizzle-orm";
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

/**
 * Analyze unanalyzed hot search titles.
 *
 * Strategy (per the user's cost-saving requirement):
 *   1. If ANALYSIS_TOP_N > 0, only analyze titles with rank ≤ N
 *      OR titles that match clickbait keyword patterns.
 *   2. If ANALYSIS_TOP_N == 0, analyze everything.
 */
export async function analyzeNewTitles(): Promise<number> {
  let query = db
    .select({
      id: schema.hotSearches.id,
      title: schema.hotSearches.title,
      rank: schema.hotSearches.rank,
    })
    .from(schema.hotSearches)
    .leftJoin(schema.aiAnalysis, eq(schema.hotSearches.id, schema.aiAnalysis.hotSearchId))
    .where(isNull(schema.aiAnalysis.id))
    .orderBy(desc(schema.hotSearches.createdAt))
    .$dynamic();

  const unanalyzed = await query;

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
      `🔍 Filtered: ${candidates.length} candidates from ${unanalyzed.length} unanalyzed (top ${topN} + keyword match, skipped ${skipped})`,
    );
  }

  console.log(`🤖 Analyzing ${candidates.length} titles with [${aiProvider.modelName}]...`);

  let analyzed = 0;
  for (const item of candidates) {
    try {
      const result = await aiProvider.analyze(item.title);

      await db.insert(schema.aiAnalysis).values({
        hotSearchId: item.id,
        isClickbait: result.isClickbait,
        score: result.score,
        reason: result.reason,
        aiModel: aiProvider.modelName,
      });

      analyzed++;
    } catch (err) {
      console.error(`❌ AI analysis failed for "${item.title}":`, err);
    }
  }

  console.log(`✅ AI analysis complete: ${analyzed}/${candidates.length} titles analyzed`);
  return analyzed;
}
