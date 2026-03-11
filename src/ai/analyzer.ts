import { eq, isNull, desc, and } from "drizzle-orm";
import { db, schema } from "../db";
import { aiProvider } from "./index";
import type { AnalysisConfig } from "../config/schema";

function lowRiskScoreByCategory(category: string | null | undefined): number {
  switch (category) {
    case "normal":
      return 8;
    case "policy":
      return 15;
    case "data_claim":
      return 18;
    default:
      return 12;
  }
}

function lowRiskReason(triageReason: string | null | undefined): string {
  return triageReason?.trim() || "分诊判断为常规话题，无需进一步事实核查。";
}

// ── Phase 1: Triage ────────────────────────────────────────────────

export async function phaseOneTriage(
  platformName: string,
  platformId: number,
  topN: number,
): Promise<number> {
  const unanalyzed = await db
    .select({
      id: schema.hotSearches.id,
      title: schema.hotSearches.title,
      rank: schema.hotSearches.rank,
    })
    .from(schema.hotSearches)
    .leftJoin(schema.aiAnalysis, eq(schema.hotSearches.id, schema.aiAnalysis.hotSearchId))
    .where(
      and(
        eq(schema.hotSearches.platformId, platformId),
        isNull(schema.aiAnalysis.id),
      ),
    )
    .orderBy(desc(schema.hotSearches.createdAt));

  const candidates = topN > 0
    ? unanalyzed.filter((item) => item.rank !== null && item.rank <= topN)
    : unanalyzed;

  if (candidates.length === 0) return 0;

  const skipped = unanalyzed.length - candidates.length;
  if (skipped > 0) {
    console.log(`🔍 [${platformName}] Triage: ${candidates.length}/${unanalyzed.length} (top ${topN})`);
  }

  console.log(`🏥 [${platformName}] Triaging ${candidates.length} titles with [${aiProvider.modelName}]...`);

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
        isClickbait: result.needsFactCheck ? null : false,
        score: result.needsFactCheck ? null : lowRiskScoreByCategory(result.category),
        reason: result.needsFactCheck ? null : lowRiskReason(result.triageReason),
        verdict: result.needsFactCheck ? null : "初筛通过：该话题争议较低，当前无明显标题党风险。",
      });

      const flag = result.needsFactCheck ? "🔴" : "🟢";
      console.log(`  ${flag} [${result.category}] "${item.title}"`);
      triaged++;
    } catch (err) {
      console.error(`❌ Triage failed for "${item.title}":`, err);
    }
  }

  console.log(`✅ [${platformName}] Triage done: ${triaged}/${candidates.length}`);
  return triaged;
}

// ── Phase 2: Fact-check ────────────────────────────────────────────

export async function phaseTwoFactCheck(
  platformName: string,
  platformId: number,
  maxItems: number,
): Promise<number> {
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
        eq(schema.hotSearches.platformId, platformId),
        eq(schema.aiAnalysis.needsFactCheck, true),
        isNull(schema.aiAnalysis.deepAnalyzedAt),
      ),
    )
    .orderBy(desc(schema.aiAnalysis.updatedAt))
    .limit(maxItems);

  if (candidates.length === 0) return 0;

  console.log(
    `🔬 [${platformName}] Fact-checking ${candidates.length} items (max ${maxItems}) with [${aiProvider.modelName}]...`,
  );

  let checked = 0;
  for (const item of candidates) {
    try {
      console.log(`  🔎 [${item.category}] "${item.title}"`);

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
          updatedAt: new Date(),
          deepAnalyzedAt: new Date(),
        })
        .where(eq(schema.aiAnalysis.id, item.id));

      const emoji = result.isClickbait ? "🚨" : "✅";
      console.log(`    ${emoji} score=${result.score} "${result.verdict}"`);
      checked++;
    } catch (err) {
      console.error(`❌ Fact-check failed for "${item.title}":`, err);
    }
  }

  console.log(`✅ [${platformName}] Fact-check done: ${checked}/${candidates.length}`);
  return checked;
}

// ── Run analysis for a specific platform ───────────────────────────

export async function runAnalysisForPlatform(
  platformName: string,
  analysisConfig: AnalysisConfig,
): Promise<{ triaged: number; factChecked: number }> {
  const platform = await db.query.platforms.findFirst({
    where: eq(schema.platforms.name, platformName),
  });

  if (!platform) {
    console.warn(`⚠️ Platform "${platformName}" not found in DB, skipping analysis`);
    return { triaged: 0, factChecked: 0 };
  }

  const triaged = await phaseOneTriage(platformName, platform.id, analysisConfig.topN);
  const factChecked = await phaseTwoFactCheck(platformName, platform.id, analysisConfig.deepAnalysisMax);
  return { triaged, factChecked };
}

// ── Run analysis for all enabled platforms ──────────────────────────

export async function runAllAnalysis(
  platforms: Array<{ name: string; analysis: AnalysisConfig }>,
): Promise<{ triaged: number; factChecked: number }> {
  let totalTriaged = 0;
  let totalFactChecked = 0;

  for (const { name, analysis } of platforms) {
    const { triaged, factChecked } = await runAnalysisForPlatform(name, analysis);
    totalTriaged += triaged;
    totalFactChecked += factChecked;
  }

  return { triaged: totalTriaged, factChecked: totalFactChecked };
}
