import { eq, isNull, desc, and } from "drizzle-orm";
import { db, schema } from "../db";
import { aiProvider } from "./index";
import { config } from "../config";

// ── Phase 1: Triage — 判断是否需要事实核查 ─────────────────────────
//
// For each unanalyzed title (filtered by top-N), ask AI: "Does this need
// fact-checking?" Stores needsFactCheck, triageReason, category.

export async function phaseOneTriage(): Promise<number> {
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
  const candidates = topN > 0
    ? unanalyzed.filter((item) => item.rank !== null && item.rank <= topN)
    : unanalyzed;

  const skipped = unanalyzed.length - candidates.length;
  if (skipped > 0) {
    console.log(`🔍 Phase 1: ${candidates.length} from ${unanalyzed.length} (top ${topN}, skipped ${skipped})`);
  }

  console.log(`🏥 Phase 1: Triaging ${candidates.length} titles with [${aiProvider.modelName}]...`);

  let triaged = 0;
  for (const item of candidates) {
    try {
      const result = await aiProvider.triage(item.title);

      await db.insert(schema.aiAnalysis).values({
        hotSearchId: item.id,
        needsFactCheck: result.needsFactCheck,
        triageReason: result.triageReason,
        category: result.category,
        aiModel: aiProvider.modelName,
      });

      const flag = result.needsFactCheck ? "🔴 需核查" : "🟢 正常";
      console.log(`  ${flag} [${result.category}] "${item.title}"`);
      triaged++;
    } catch (err) {
      console.error(`❌ Phase 1 triage failed for "${item.title}":`, err);
    }
  }

  console.log(`✅ Phase 1 complete: ${triaged}/${candidates.length} titles triaged`);
  return triaged;
}

// ── Phase 2: Fact-check + Score ────────────────────────────────────
//
// Takes items where needsFactCheck=true AND not yet fact-checked,
// limited to DEEP_ANALYSIS_MAX per batch. Runs thorough fact-check
// and ALWAYS writes a score (even for items determined to be true).

export async function phaseTwoFactCheck(): Promise<number> {
  const maxItems = config.DEEP_ANALYSIS_MAX;

  const candidates = await db
    .select({
      id: schema.aiAnalysis.id,
      hotSearchId: schema.aiAnalysis.hotSearchId,
      title: schema.hotSearches.title,
      category: schema.aiAnalysis.category,
      triageReason: schema.aiAnalysis.triageReason,
    })
    .from(schema.aiAnalysis)
    .innerJoin(schema.hotSearches, eq(schema.aiAnalysis.hotSearchId, schema.hotSearches.id))
    .where(
      and(
        eq(schema.aiAnalysis.needsFactCheck, true),
        isNull(schema.aiAnalysis.deepAnalyzedAt),
      ),
    )
    .orderBy(desc(schema.aiAnalysis.updatedAt))
    .limit(maxItems);

  if (candidates.length === 0) {
    console.log("🔬 Phase 2: No items pending fact-check, skipping");
    return 0;
  }

  console.log(
    `🔬 Phase 2: Fact-checking ${candidates.length} items (max ${maxItems}) with [${aiProvider.modelName}]...`,
  );

  let checked = 0;
  for (const item of candidates) {
    try {
      console.log(`  🔎 Checking: [${item.category}] "${item.title}"`);

      const result = await aiProvider.factCheck(
        item.title,
        item.category ?? "unknown",
        item.triageReason ?? "",
      );

      await db
        .update(schema.aiAnalysis)
        .set({
          isClickbait: result.isClickbait,
          score: result.score,
          reason: result.reason,
          deepAnalysis: result.deepAnalysis,
          verdict: result.verdict,
          deepAiModel: aiProvider.modelName,
          deepAnalyzedAt: new Date(),
        })
        .where(eq(schema.aiAnalysis.id, item.id));

      const emoji = result.isClickbait ? "🚨" : "✅";
      console.log(`    ${emoji} score=${result.score} "${result.verdict}"`);
      checked++;
    } catch (err) {
      console.error(`❌ Phase 2 fact-check failed for "${item.title}":`, err);
    }
  }

  console.log(`✅ Phase 2 complete: ${checked}/${candidates.length} items fact-checked`);
  return checked;
}

// ── Combined ───────────────────────────────────────────────────────

export async function analyzeNewTitles(): Promise<{ triaged: number; factChecked: number }> {
  const triaged = await phaseOneTriage();
  const factChecked = await phaseTwoFactCheck();
  return { triaged, factChecked };
}
