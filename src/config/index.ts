import { readFileSync } from "fs";
import { resolve } from "path";
import { appConfigSchema, type AppConfig, type PlatformConfig } from "./schema";

function findConfigPath(): string {
  const candidates = [
    resolve(process.cwd(), "melonscout.config.json"),
    resolve(import.meta.dir, "../../melonscout.config.json"),
  ];
  for (const p of candidates) {
    try {
      readFileSync(p, "utf-8");
      return p;
    } catch {}
  }
  throw new Error(
    `melonscout.config.json not found. Searched: ${candidates.join(", ")}`,
  );
}

function loadAppConfig(): AppConfig {
  const configPath = findConfigPath();
  console.log(`📄 Loading config from ${configPath}`);
  const raw = JSON.parse(readFileSync(configPath, "utf-8"));
  const result = appConfigSchema.safeParse(raw);
  if (!result.success) {
    console.error("❌ Invalid melonscout.config.json:");
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const appConfig = loadAppConfig();

export function resolveEnv(envName: string): string | undefined {
  return process.env[envName]?.trim() || undefined;
}

export function requireEnv(envName: string, context: string): string {
  const val = resolveEnv(envName);
  if (!val) {
    throw new Error(`Environment variable ${envName} is required for ${context}`);
  }
  return val;
}

export function getEnabledPlatforms(): Array<[string, PlatformConfig]> {
  return Object.entries(appConfig.platforms).filter(([, p]) => p.enabled);
}

export function getDatabaseUrl(): string {
  return requireEnv(appConfig.database.urlEnv, "database connection");
}

export { type AppConfig, type PlatformConfig } from "./schema";
