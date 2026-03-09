import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  AI_PROVIDER: z.enum(["google", "openai", "deepseek"]).default("google"),
  GOOGLE_AI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  PORT: z.coerce.number().default(3000),
  CRON_SCHEDULE: z.string().default("*/15 * * * *"),
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
