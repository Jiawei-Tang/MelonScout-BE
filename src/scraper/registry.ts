import type { ScraperSource } from "./types";
import type { ScraperConfig } from "../config/schema";
import { resolveEnv } from "../config";
import { TianapiWeiboScraper } from "./sources/tianapi-weibo";
import { TianapiDouyinScraper } from "./sources/tianapi-douyin";
import { TianapiBaiduScraper } from "./sources/tianapi-baidu";
import { CheerioWeiboScraper } from "./sources/cheerio-weibo";

export function createScraper(
  platformName: string,
  scraperConfig: ScraperConfig,
): ScraperSource | undefined {
  switch (scraperConfig.type) {
    case "tianapi": {
      const envName = scraperConfig.apiKeyEnv ?? "TIANAPI_API_KEY";
      const apiKey = resolveEnv(envName);
      if (!apiKey) {
        console.warn(
          `⚠️ ${envName} not set for [${platformName}], tianapi scraper will fail`,
        );
      }
      if (platformName === "douyin") {
        return new TianapiDouyinScraper(apiKey ?? "");
      }
      if (platformName === "baidu") {
        return new TianapiBaiduScraper(apiKey ?? "");
      }
      return new TianapiWeiboScraper(apiKey ?? "");
    }

    case "cheerio":
      return new CheerioWeiboScraper();

    default:
      console.warn(
        `Unknown scraper type "${scraperConfig.type}" for platform "${platformName}"`,
      );
      return undefined;
  }
}
