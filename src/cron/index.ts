import cron from "node-cron";
import { config } from "../config";
import { runScraper } from "../scraper";
import { analyzeNewTitles } from "../ai/analyzer";

export function startCronJobs() {
  console.log(`⏰ Scheduling scraper cron: "${config.CRON_SCHEDULE}"`);

  cron.schedule(config.CRON_SCHEDULE, async () => {
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
  });
}
