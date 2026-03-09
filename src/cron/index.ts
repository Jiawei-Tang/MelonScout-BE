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
      console.log(`📊 Scraped ${scraped} items`);

      const analyzed = await analyzeNewTitles();
      console.log(`🤖 Analyzed ${analyzed} titles`);
    } catch (err) {
      console.error("❌ Cron job failed:", err);
    }
    console.log(`✅ Cron job finished\n`);
  });
}
