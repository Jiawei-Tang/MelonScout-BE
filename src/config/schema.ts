import { z } from "zod";

const scraperConfigSchema = z.object({
  type: z.enum(["tianapi", "cheerio", "placeholder"]),
  apiKeyEnv: z.string().optional(),
  cron: z.string(),
});

const analysisConfigSchema = z.object({
  topN: z.number().default(10),
  deepAnalysisMax: z.number().default(5),
});

const platformConfigSchema = z.object({
  displayName: z.string(),
  enabled: z.boolean().default(false),
  scraper: scraperConfigSchema,
  analysis: analysisConfigSchema,
});

const ingestConfigSchema = z.object({
  enabled: z.boolean().default(false),
  embedding: z.object({
    provider: z.enum(["doubao", "openai"]).default("doubao"),
    apiKeyEnv: z.string().default("DOUBAO_API_KEY"),
    endpointId: z.string().optional(),
    dimensions: z.number().default(2048),
  }).default({}),
  thresholds: z.object({
    autoMerge: z.number().default(0.85),
    aiJudge: z.number().default(0.70),
  }).default({}),
  windowDays: z.number().default(3),
  neighborsLimit: z.number().default(5),
}).default({});

export const appConfigSchema = z.object({
  server: z.object({
    port: z.number().default(3000),
  }),
  database: z.object({
    urlEnv: z.string().default("DATABASE_URL"),
  }),
  ai: z.object({
    provider: z.enum(["google", "openai", "deepseek", "minimax", "doubao"]),
    apiKeyEnv: z.string(),
    model: z.string().optional(),
    analysisCron: z.string(),
  }),
  logging: z.object({
    dir: z.string().default("./logs"),
    dirEnv: z.string().optional(),
    level: z.enum(["info", "warn", "error"]).default("info"),
  }).default({ dir: "./logs", level: "info" }),
  platforms: z.record(z.string(), platformConfigSchema),
  startup: z.object({
    fetchThresholdHours: z.number().default(6),
  }),
  ingest: ingestConfigSchema,
});

export type AppConfig = z.infer<typeof appConfigSchema>;
export type PlatformConfig = z.infer<typeof platformConfigSchema>;
export type ScraperConfig = z.infer<typeof scraperConfigSchema>;
export type AnalysisConfig = z.infer<typeof analysisConfigSchema>;
export type IngestConfig = z.infer<typeof ingestConfigSchema>;
