import type { ScraperSource } from "./types";
import type { ScraperConfig } from "../config/schema";
import { resolveEnv } from "../config";
import { PlaceholderScraper } from "./sources/placeholder";
import { TianapiWeiboScraper } from "./sources/tianapi-weibo";
import { CheerioWeiboScraper } from "./sources/cheerio-weibo";

export function createScraper(
  platformName: string,
  scraperConfig: ScraperConfig,
): ScraperSource {
  switch (scraperConfig.type) {
    case "tianapi": {
      const envName = scraperConfig.apiKeyEnv ?? "TIANAPI_API_KEY";
      const apiKey = resolveEnv(envName);
      if (!apiKey) {
        console.warn(
          `⚠️ ${envName} not set for [${platformName}], tianapi scraper will fail`,
        );
      }
      return new TianapiWeiboScraper(apiKey ?? "");
    }

    case "cheerio":
      return new CheerioWeiboScraper();

    case "placeholder":
      return new PlaceholderScraper(platformName);

    default:
      throw new Error(
        `Unknown scraper type "${scraperConfig.type}" for platform "${platformName}"`,
      );
  }
}
