import cron from "node-cron";
import { desc, isNull, eq, and } from "drizzle-orm";
import { appConfig, getEnabledPlatforms } from "../config";
import { db, schema } from "../db";
import { createScraper, runPlatformScraper } from "../scraper";
import { runAllAnalysis, runAnalysisForPlatform } from "../ai/analyzer";

const THRESHOLD_MS = appConfig.startup.fetchThresholdHours * 60 * 60 * 1000;

async function checkStartup() {
  const enabledPlatforms = getEnabledPlatforms();
  if (enabledPlatforms.length === 0) {
    console.log("⚠️ No platforms enabled, skipping startup check");
    return;
  }

  const [latest] = await db
    .select({ createdAt: schema.hotSearches.createdAt })
    .from(schema.hotSearches)
    .orderBy(desc(schema.hotSearches.createdAt))
    .limit(1);

  const lastAt = latest?.createdAt ? new Date(latest.createdAt).getTime() : 0;
  const now = Date.now();
  const dataFresh = lastAt > 0 && now - lastAt < THRESHOLD_MS;

  if (!dataFresh) {
    console.log("🚀 Startup: data stale or empty, running full scrape + analysis...");
    for (const [name, platformCfg] of enabledPlatforms) {
      try {
        const scraper = createScraper(name, platformCfg.scraper);
        if (!scraper) {
          console.warn(`⚠️ Scraper not found for platform "${name}"`);
          continue;
        }
        await runPlatformScraper(name, scraper);
      } catch (err) {
        console.error(`❌ Startup scrape failed [${name}]:`, err);
      }
    }
    const platforms = enabledPlatforms.map(([name, cfg]) => ({ name, analysis: cfg.analysis }));
    const { triaged, factChecked } = await runAllAnalysis(platforms);
    console.log(`✅ Startup done: triaged ${triaged}, fact-checked ${factChecked}`);
    return;
  }

  console.log(
    `⏭️ Last fetch ${Math.round((now - lastAt) / 60000)}min ago (< ${appConfig.startup.fetchThresholdHours}h), skip scraping`,
  );

  const untriagedRows = await db
    .select({ id: schema.hotSearches.id })
    .from(schema.hotSearches)
    .leftJoin(schema.aiAnalysis, eq(schema.hotSearches.id, schema.aiAnalysis.hotSearchId))
    .where(isNull(schema.aiAnalysis.id));

  const uncheckedRows = await db
    .select({ id: schema.aiAnalysis.id })
    .from(schema.aiAnalysis)
    .where(and(eq(schema.aiAnalysis.needsFactCheck, true), isNull(schema.aiAnalysis.deepAnalyzedAt)));

  if (untriagedRows.length > 0 || uncheckedRows.length > 0) {
    console.log(
      `🔎 Startup: ${untriagedRows.length} untriaged, ${uncheckedRows.length} awaiting fact-check`,
    );
    const platforms = enabledPlatforms.map(([name, cfg]) => ({ name, analysis: cfg.analysis }));
    const { triaged, factChecked } = await runAllAnalysis(platforms);
    console.log(`✅ Startup analysis done: triaged ${triaged}, fact-checked ${factChecked}`);
  } else {
    console.log("✅ All caught up, no pending work");
  }
}

export function startCronJobs() {
  const enabledPlatforms = getEnabledPlatforms();

  console.log(`⏰ Registering cron jobs for ${enabledPlatforms.length} platform(s)...`);

  // Per-platform scraper crons
  for (const [name, platformCfg] of enabledPlatforms) {
    if(name === "weibo") {
      continue;
    }
    const scraper = createScraper(name, platformCfg.scraper);
    const cronExpr = platformCfg.scraper.cron;

    console.log(`  📡 [${name}] scraper cron: "${cronExpr}"`);
    cron.schedule(cronExpr, async () => {
      console.log(`\n🔄 [${new Date().toISOString()}] Scraper [${name}] started`);
      try {
        if (scraper) {
          await runPlatformScraper(name, scraper);
        }
      } catch (err) {
        console.error(`❌ Scraper [${name}] failed:`, err);
      }
    });
  }

  // AI analysis cron (runs for all enabled platforms)
  const analysisCron = appConfig.ai.analysisCron;
  console.log(`  🤖 AI analysis cron: "${analysisCron}"`);
  cron.schedule(analysisCron, async () => {
    console.log(`\n🤖 [${new Date().toISOString()}] AI analysis started`);
    try {
      const platforms = enabledPlatforms.map(([name, cfg]) => ({ name, analysis: cfg.analysis }));
      const { triaged, factChecked } = await runAllAnalysis(platforms);
      console.log(`✅ AI analysis done: triaged ${triaged}, fact-checked ${factChecked}`);
    } catch (err) {
      console.error("❌ AI analysis failed:", err);
    }
  });

  // Startup check
  void checkStartup();
}
