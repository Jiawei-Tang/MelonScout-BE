import { eq, sql } from "drizzle-orm";
import { db, schema } from "../db";
import { appConfig, resolveEnv } from "../config";
import { aiProvider } from "../ai";
import { createEmbeddingProvider } from "./embedding";
import { findExactTitle, findSimilar } from "./similarity";
import { SIMILARITY_SYSTEM_PROMPT, buildSimilarityPrompt } from "./prompts";
import type { PlatformRef } from "../db/schema";
import type { AISimilarityResult, EmbeddingProvider, IngestStats } from "./types";

function parseHeatValue(heatValue: string | null | undefined): number {
  if (heatValue == null || heatValue.trim() === "") return 0;
  const num = parseFloat(heatValue.replace(/[^0-9.]/g, "")) || 0;
  if (heatValue.includes("亿")) return num * 100_000_000;
  if (heatValue.includes("万")) return num * 10_000;
  return num;
}

function betterHeat(a: string | null | undefined, b: string | null | undefined): string | null {
  return parseHeatValue(a) >= parseHeatValue(b) ? (a ?? null) : (b ?? null);
}

function betterRank(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return Math.min(a, b);
}

function addPlatform(existing: PlatformRef[], platformId: number, platformName: string): PlatformRef[] {
  if (existing.some((p) => p.id === platformId)) return existing;
  return [...existing, { id: platformId, name: platformName }];
}

function parseJSON<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as T;
}

async function aiJudgeSimilarity(titleA: string, titleB: string): Promise<AISimilarityResult> {
  try {
    const result = await aiProvider.triage(
      `[SIMILARITY_CHECK]\n${buildSimilarityPrompt(titleA, titleB)}`,
    );
    return {
      isSame: result.needsFactCheck,
      factTitle: null,
      confidence: 0.5,
      reason: result.triageReason,
    };
  } catch {
    // Fallback: use a direct chat call if available
  }

  return { isSame: false, factTitle: null, confidence: 0, reason: "AI judgment failed" };
}

// Use DoubaoProvider's chat capability for similarity judgment
async function aiJudgeSimilarityChat(titleA: string, titleB: string): Promise<AISimilarityResult> {
  const cfg = appConfig.ai;
  const apiKey = resolveEnv(cfg.apiKeyEnv);
  if (!apiKey) {
    return { isSame: false, factTitle: null, confidence: 0, reason: "No AI API key" };
  }

  try {
    const resp = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model ?? "doubao-seed-2-0-pro-260215",
        messages: [
          { role: "system", content: SIMILARITY_SYSTEM_PROMPT },
          { role: "user", content: buildSimilarityPrompt(titleA, titleB) },
        ],
        temperature: 0.2,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`❌ AI similarity judge failed: ${resp.status} ${body}`);
      return { isSame: false, factTitle: null, confidence: 0, reason: "API error" };
    }

    const json = (await resp.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      return { isSame: false, factTitle: null, confidence: 0, reason: "Empty response" };
    }

    return parseJSON<AISimilarityResult>(content);
  } catch (err) {
    console.error("❌ AI similarity judge error:", err);
    return { isSame: false, factTitle: null, confidence: 0, reason: "Exception" };
  }
}

// ── Main ingest function ────────────────────────────────────────────

let _embeddingProvider: EmbeddingProvider | null = null;

function getEmbeddingProvider(): EmbeddingProvider {
  if (!_embeddingProvider) {
    const cfg = appConfig.ingest.embedding;
    _embeddingProvider = createEmbeddingProvider(
      cfg.provider,
      cfg.apiKeyEnv,
      cfg.endpointId,
      cfg.dimensions,
    );
    console.log(`🧮 Embedding provider: ${_embeddingProvider.modelName} (${_embeddingProvider.dimensions}d)`);
  }
  return _embeddingProvider;
}

export async function ingestRawItems(rawIds: number[]): Promise<IngestStats> {
  const stats: IngestStats = {
    total: rawIds.length,
    exactMatched: 0,
    autoMerged: 0,
    aiMerged: 0,
    created: 0,
    failed: 0,
  };

  const cfg = appConfig.ingest;
  const embeddingProvider = getEmbeddingProvider();

  for (const rawId of rawIds) {
    try {
      const raw = await db.query.rawHotSearches.findFirst({
        where: eq(schema.rawHotSearches.id, rawId),
      });
      if (!raw || raw.hotSearchId) continue; // already ingested

      const platform = raw.platformId
        ? (await db.query.platforms.findFirst({
            where: eq(schema.platforms.id, raw.platformId),
          })) ?? null
        : null;
      const platformName = platform?.name ?? "unknown";

      // ── Step 0: Exact title match ──────────────────────────
      const exact = await findExactTitle(raw.title, cfg.windowDays);
      if (exact) {
        await mergeIntoExisting(exact.id, raw, platform, 1.0);
        stats.exactMatched++;
        continue;
      }

      // ── Step 1: Generate embedding ─────────────────────────
      const embedding = await embeddingProvider.embed(raw.title);

      // ── Step 2: Vector KNN search ──────────────────────────
      const neighbors = await findSimilar(embedding, cfg.windowDays, cfg.neighborsLimit);
      const best = neighbors[0];

      // ── Step 3: Threshold decision ─────────────────────────
      if (best && best.similarity >= cfg.thresholds.autoMerge) {
        await mergeIntoExisting(best.id, raw, platform, best.similarity);
        console.log(`  🔗 [${platformName}] "${raw.title}" → merged (sim=${best.similarity.toFixed(3)})`);
        stats.autoMerged++;
      } else if (best && best.similarity >= cfg.thresholds.aiJudge) {
        const aiResult = await aiJudgeSimilarityChat(raw.title, best.title);
        if (aiResult.isSame) {
          await mergeIntoExisting(best.id, raw, platform, best.similarity, aiResult.factTitle ?? undefined);
          console.log(`  🤖 [${platformName}] "${raw.title}" → AI merged (sim=${best.similarity.toFixed(3)})`);
          stats.aiMerged++;
        } else {
          await createNewHotSearch(raw, platform, embedding);
          console.log(`  🆕 [${platformName}] "${raw.title}" (AI: different event)`);
          stats.created++;
        }
      } else {
        await createNewHotSearch(raw, platform, embedding);
        stats.created++;
      }
    } catch (err) {
      console.error(`❌ Ingest failed for raw #${rawId}:`, err);
      stats.failed++;
    }
  }

  return stats;
}

// ── Helpers ─────────────────────────────────────────────────────────

async function mergeIntoExisting(
  hotSearchId: number,
  raw: { id: number; heatValue: string | null; rank: number | null; url: string },
  platform: { id: number; name: string } | null,
  similarity: number,
  newTitle?: string,
): Promise<void> {
  // Backfill raw → formal link
  await db
    .update(schema.rawHotSearches)
    .set({ hotSearchId })
    .where(eq(schema.rawHotSearches.id, raw.id));

  // Update formal hot search aggregates
  const existing = await db.query.hotSearches.findFirst({
    where: eq(schema.hotSearches.id, hotSearchId),
  });
  if (!existing) return;

  const updates: Record<string, unknown> = {
    sourceCount: sql`${schema.hotSearches.sourceCount} + 1`,
    updatedAt: new Date(),
  };

  if (platform) {
    updates.platforms = addPlatform(
      existing.platforms as PlatformRef[],
      platform.id,
      platform.name,
    );
  }

  const newHeat = betterHeat(raw.heatValue, existing.maxHeatValue);
  if (newHeat !== existing.maxHeatValue) {
    updates.maxHeatValue = newHeat;
    updates.representativeUrl = raw.url;
  }

  const newRank = betterRank(raw.rank, existing.maxRank);
  if (newRank !== existing.maxRank) {
    updates.maxRank = newRank;
  }

  if (newTitle) {
    updates.title = newTitle;
  }

  await db
    .update(schema.hotSearches)
    .set(updates)
    .where(eq(schema.hotSearches.id, hotSearchId));
}

async function createNewHotSearch(
  raw: { id: number; title: string; url: string; heatValue: string | null; rank: number | null },
  platform: { id: number; name: string } | null,
  embedding: number[],
): Promise<void> {
  const platformRefs: PlatformRef[] = platform
    ? [{ id: platform.id, name: platform.name }]
    : [];

  const vecLiteral = `[${embedding.join(",")}]`;

  const [inserted] = await db
    .insert(schema.hotSearches)
    .values({
      title: raw.title,
      platforms: platformRefs,
      sourceCount: 1,
      maxHeatValue: raw.heatValue,
      maxRank: raw.rank,
      representativeUrl: raw.url,
    })
    .returning({ id: schema.hotSearches.id });

  // Set embedding via raw SQL (Drizzle doesn't handle vector type)
  await db.execute(
    sql`UPDATE hot_searches SET embedding = ${vecLiteral}::vector WHERE id = ${inserted.id}`,
  );

  // Backfill raw → formal link
  await db
    .update(schema.rawHotSearches)
    .set({ hotSearchId: inserted.id })
    .where(eq(schema.rawHotSearches.id, raw.id));
}
