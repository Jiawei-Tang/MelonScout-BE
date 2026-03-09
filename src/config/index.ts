import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),

  // AI
  AI_PROVIDER: z.enum(["google", "openai", "deepseek", "minimax"]).default("google"),
  GOOGLE_AI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  MINIMAX_API_KEY: z.string().optional(),

  // Scraper source: "vvhan" | "cheerio" | "placeholder" | "tianapi"
  SCRAPER_SOURCE: z.enum(["vvhan", "cheerio", "placeholder", "tianapi"]).default("placeholder"),
  TIANAPI_API_KEY: z.string().optional(),

  // Phase 1: only score top N per scrape batch (0 = score all)
  ANALYSIS_TOP_N: z.coerce.number().default(10),

  // Phase 2: score threshold to trigger deep analysis (0-100)
  DEEP_ANALYSIS_THRESHOLD: z.coerce.number().default(60),
  // Phase 2: max items to deep-analyze per batch
  DEEP_ANALYSIS_MAX: z.coerce.number().default(5),

  PORT: z.coerce.number().default(3000),
  CRON_SCHEDULE: z.string().default("*/15 * * * *"),

  // Startup: if last weibo hot fetch is older than this (hours), fetch once and run AI analysis
  STARTUP_FETCH_THRESHOLD_HOURS: z.coerce.number().default(1),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Invalid environment variables:");
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof envSchema>;
