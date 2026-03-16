import { patchConsole } from "./logger";
import api from "./api";
import { appConfig, resolveEnv } from "./config";
import { startCronJobs } from "./cron";

patchConsole();

console.log("🍉 MelonScout Backend starting...");

const scraperEnabledEnv = resolveEnv("CRON_SCRAPER_ENABLED") ?? "true";
const aiAnalysisEnabledEnv = resolveEnv("AI_ANALYSIS_ENABLED") ?? "true";

const scraperEnabled = scraperEnabledEnv.toLowerCase() !== "false";
const aiAnalysisEnabled = aiAnalysisEnabledEnv.toLowerCase() !== "false";

console.log(
  `⚙️ Feature flags — scraper: ${scraperEnabled ? "ENABLED" : "DISABLED"}, AI analysis: ${aiAnalysisEnabled ? "ENABLED" : "DISABLED"}`,
);

startCronJobs({
  scraperEnabled,
  aiAnalysisEnabled,
});

export default {
  port: appConfig.server.port,
  fetch: api.fetch,
};

console.log(`🚀 Server running at http://localhost:${appConfig.server.port}`);
