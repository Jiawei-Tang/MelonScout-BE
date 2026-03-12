import type { ScraperSource, RawHotSearchItem, RawHotSearchExtra } from "../types";

interface TianapiBaiduItem {
  brief: string;
  index: string;
  trend: string;
  keyword: string;
}

interface TianapiBaiduResponse {
  code: number;
  msg: string;
  result?: { list: TianapiBaiduItem[] };
}

/**
 * 天行数据 百度热搜 API (apis.tianapi.com/nethot).
 * Requires TIANAPI_API_KEY in env.
 */
export class TianapiBaiduScraper implements ScraperSource {
  readonly sourceName = "tianapi";
  readonly platformName = "baidu";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetch(): Promise<RawHotSearchItem[]> {
    const url = `https://apis.tianapi.com/nethot/index?key=${encodeURIComponent(this.apiKey)}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "MelonScout/1.0" },
    });

    if (!resp.ok) {
      throw new Error(`tianapi nethot returned ${resp.status}`);
    }

    const json = (await resp.json()) as TianapiBaiduResponse;
    if (json.code !== 200 || !json.result?.list?.length) {
      throw new Error(`tianapi nethot error: ${json.msg ?? "no list"}`);
    }

    return json.result.list.map((item, idx): RawHotSearchItem => {
      const extra: RawHotSearchExtra = {
        source: "tianapi",
        brief: item.brief,
        trend: item.trend,
        index: item.index,
      };
      const searchUrl = `https://www.baidu.com/s?wd=${encodeURIComponent(item.keyword)}`;
      return {
        title: item.keyword,
        url: searchUrl,
        heatValue: item.index?.trim() ? item.index.trim().slice(0, 50) : undefined,
        rank: idx + 1,
        extra,
      };
    });
  }
}

