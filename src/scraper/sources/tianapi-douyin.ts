import type { ScraperSource, RawHotSearchItem, RawHotSearchExtra } from "../types";

interface TianapiDouyinItem {
  word: string;
  label: number;
  hotindex: number;
}

interface TianapiDouyinResponse {
  code: number;
  msg: string;
  result?: { list: TianapiDouyinItem[] };
}

/**
 * 天行数据 抖音热搜 API (apis.tianapi.com/douyinhot).
 * 与微博共用 TIANAPI_API_KEY。
 */
export class TianapiDouyinScraper implements ScraperSource {
  readonly sourceName = "tianapi";
  readonly platformName = "douyin";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetch(): Promise<RawHotSearchItem[]> {
    const url = `https://apis.tianapi.com/douyinhot/index?key=${encodeURIComponent(this.apiKey)}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "MelonScout/1.0" },
    });

    if (!resp.ok) {
      throw new Error(`tianapi douyinhot returned ${resp.status}`);
    }

    const json = (await resp.json()) as TianapiDouyinResponse;
    if (json.code !== 200 || !json.result?.list?.length) {
      throw new Error(`tianapi douyinhot error: ${json.msg ?? "no list"}`);
    }

    return json.result.list.map((item, idx): RawHotSearchItem => {
      const heatValue = String(item.hotindex);
      const extra: RawHotSearchExtra = {
        source: "tianapi",
        label: item.label,
        hotindex: item.hotindex,
      };
      const searchUrl = `https://www.douyin.com/search/${encodeURIComponent(item.word)}`;
      return {
        title: item.word,
        url: searchUrl,
        heatValue,
        rank: idx + 1,
        extra,
      };
    });
  }
}
