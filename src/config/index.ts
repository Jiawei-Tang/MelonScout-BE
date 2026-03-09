import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),

  // AI
  AI_PROVIDER: z.enum(["google", "openai", "deepseek", "minimax"]).default("google"),
  GOOGLE_AI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  MINIMAX_API_KEY: z.string().optional(),

  // Scraper source: "cheerio" | "placeholder" | "tianapi"
  SCRAPER_SOURCE: z.enum(["cheerio", "placeholder", "tianapi"]).default("placeholder"),
  TIANAPI_API_KEY: z.string().optional(),

  // Phase 1 triage: only triage top N per scrape batch (0 = triage all)
  ANALYSIS_TOP_N: z.coerce.number().default(10),

  // Phase 2 fact-check: max items to deep-analyze per batch
  DEEP_ANALYSIS_MAX: z.coerce.number().default(5),

  PORT: z.coerce.number().default(3000),
  CRON_SCHEDULE: z.string().default("*/15 * * * *"),

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
