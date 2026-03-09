import type { ScraperSource, RawHotSearchItem, RawHotSearchExtra } from "../types";

interface TianapiWeiboItem {
  hotword: string;
  hotwordnum: string;
  hottag: string;
}

interface TianapiResponse {
  code: number;
  msg: string;
  result?: { list: TianapiWeiboItem[] };
}

/**
 * 天行数据 微博热搜 API (apis.tianapi.com).
 * Requires TIANAPI_API_KEY in env.
 */
export class TianapiWeiboScraper implements ScraperSource {
  readonly sourceName = "tianapi";
  readonly platformName = "weibo";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetch(): Promise<RawHotSearchItem[]> {
    const url = `https://apis.tianapi.com/weibohot/index?key=${encodeURIComponent(this.apiKey)}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "MelonScout/1.0" },
    });

    if (!resp.ok) {
      throw new Error(`tianapi weibohot returned ${resp.status}`);
    }

    const json = (await resp.json()) as TianapiResponse;
    if (json.code !== 200 || !json.result?.list?.length) {
      throw new Error(`tianapi weibohot error: ${json.msg ?? "no list"}`);
    }

    return json.result.list.map((item, idx): RawHotSearchItem => {
      const heatValue = item.hotwordnum?.trim() ? item.hotwordnum.trim().slice(0, 50) : undefined;
      const extra: RawHotSearchExtra = {
        source: "tianapi",
        hottag: item.hottag || undefined,
        hotwordnum: item.hotwordnum ?? undefined,
      };
      const searchUrl = `https://s.weibo.com/weibo?q=${encodeURIComponent(item.hotword)}`;
      return {
        title: item.hotword,
        url: searchUrl,
        heatValue,
        rank: idx + 1,
        extra,
      };
    });
  }
}
