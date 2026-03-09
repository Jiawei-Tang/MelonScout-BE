import cron from "node-cron";
import { desc } from "drizzle-orm";
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

    const { scored, deepAnalyzed } = await analyzeNewTitles();
    console.log(`📊 Phase 1: scored ${scored} | 🔬 Phase 2: deep-analyzed ${deepAnalyzed}`);
  } catch (err) {
    console.error("❌ Cron job failed:", err);
  }
  console.log(`✅ Cron job finished\n`);
}

/**
 * 启动时检查「所有热搜」里最新的一条 created_at：
 * - 若从未有数据，或距离现在 ≥ 阈值（默认 1 小时），则立即跑一次 runJob（抓取所有源 + AI 分析）
 * - 否则不跑，等待第一个 CRON_SCHEDULE 周期
 */
export function startCronJobs() {
  console.log(
    `⏰ Scheduling scraper cron: "${config.CRON_SCHEDULE}" (startup: run now if last hot search > ${config.STARTUP_FETCH_THRESHOLD_HOURS}h ago)`,
  );

  void (async () => {
    const [latest] = await db
      .select({ createdAt: schema.hotSearches.createdAt })
      .from(schema.hotSearches)
      .orderBy(desc(schema.hotSearches.createdAt))
      .limit(1);

    const lastAt = latest?.createdAt ? new Date(latest.createdAt).getTime() : 0;
    const now = Date.now();

    if (lastAt > 0 && now - lastAt < THRESHOLD_MS) {
      console.log(
        `⏭️ Last hot search fetch was ${Math.round(
          (now - lastAt) / 60000,
        )}min ago (< ${config.STARTUP_FETCH_THRESHOLD_HOURS}h), skip startup run`,
      );
      return;
    }

    console.log("🚀 Startup: last hot search fetch exceeded threshold (or none), running once now...");
    await runJob();
  })();

  cron.schedule(config.CRON_SCHEDULE, runJob);
}
