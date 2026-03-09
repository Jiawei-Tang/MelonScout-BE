import cron from "node-cron";
import { desc, isNull, eq, and } from "drizzle-orm";
import { config } from "../config";
import { db, schema } from "../db";
import { runScraper } from "../scraper";
import { analyzeNewTitles } from "../ai/analyzer";

const THRESHOLD_MS = config.STARTUP_FETCH_THRESHOLD_HOURS * 60 * 60 * 1000;

async function runJob() {
  console.log(`\n🔄 [${new Date().toISOString()}] Cron job started`);
  try {
    const scraped = await runScraper();
    console.log(`📡 Scraped ${scraped} items`);

    const { triaged, factChecked } = await analyzeNewTitles();
    console.log(`🏥 Phase 1: triaged ${triaged} | 🔬 Phase 2: fact-checked ${factChecked}`);
  } catch (err) {
    console.error("❌ Cron job failed:", err);
  }
  console.log(`✅ Cron job finished\n`);
}

async function countPendingWork(): Promise<{ untriaged: number; unchecked: number }> {
  const [untriagedRow] = await db
    .select({ count: schema.hotSearches.id })
    .from(schema.hotSearches)
    .leftJoin(schema.aiAnalysis, eq(schema.hotSearches.id, schema.aiAnalysis.hotSearchId))
    .where(isNull(schema.aiAnalysis.id));
  const untriaged = untriagedRow ? 1 : 0;

  const untriagedAll = await db
    .select({ id: schema.hotSearches.id })
    .from(schema.hotSearches)
    .leftJoin(schema.aiAnalysis, eq(schema.hotSearches.id, schema.aiAnalysis.hotSearchId))
    .where(isNull(schema.aiAnalysis.id));

  const uncheckedAll = await db
    .select({ id: schema.aiAnalysis.id })
    .from(schema.aiAnalysis)
    .where(
      and(
        eq(schema.aiAnalysis.needsFactCheck, true),
        isNull(schema.aiAnalysis.deepAnalyzedAt),
      ),
    );

  return { untriaged: untriagedAll.length, unchecked: uncheckedAll.length };
}

export function startCronJobs() {
  console.log(
    `⏰ Scheduling scraper cron: "${config.CRON_SCHEDULE}" (startup threshold: ${config.STARTUP_FETCH_THRESHOLD_HOURS}h)`,
  );

  void (async () => {
    const [latest] = await db
      .select({ createdAt: schema.hotSearches.createdAt })
      .from(schema.hotSearches)
      .orderBy(desc(schema.hotSearches.createdAt))
      .limit(1);

    const lastAt = latest?.createdAt ? new Date(latest.createdAt).getTime() : 0;
    const now = Date.now();
    const dataFresh = lastAt > 0 && now - lastAt < THRESHOLD_MS;

    if (dataFresh) {
      console.log(
        `⏭️ Last fetch was ${Math.round((now - lastAt) / 60000)}min ago (< ${config.STARTUP_FETCH_THRESHOLD_HOURS}h), skip scraping`,
      );

      const { untriaged, unchecked } = await countPendingWork();
      if (untriaged > 0 || unchecked > 0) {
        console.log(
          `🔎 Startup: found pending work — ${untriaged} untriaged, ${unchecked} awaiting fact-check. Running analysis...`,
        );
        try {
          const { triaged, factChecked } = await analyzeNewTitles();
          console.log(`✅ Startup analysis done: triaged ${triaged}, fact-checked ${factChecked}`);
        } catch (err) {
          console.error("❌ Startup analysis failed:", err);
        }
      } else {
        console.log("✅ No pending analysis work, all caught up");
      }
      return;
    }

    console.log("🚀 Startup: data stale or empty, running full scrape + analysis...");
    await runJob();
  })();

  cron.schedule(config.CRON_SCHEDULE, runJob);
}
