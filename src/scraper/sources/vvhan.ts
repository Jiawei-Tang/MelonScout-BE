import type { ScraperSource, RawHotSearchItem } from "../types";

interface VvhanResponse {
  success: boolean;
  data: Array<{
    title: string;
    url: string;
    hot: string | number;
    index: number;
  }>;
}

const PLATFORM_MAP: Record<string, string> = {
  weibo: "weiboHot",
  zhihu: "zhihuHot",
  baidu: "baiduRD",
  douyin: "douyinHot",
  bilibili: "bili",
  toutiao: "toutiao",
};

/**
 * 韩小韩 API (vvhan.com) hot list scraper.
 * Free, no key required. Supports weibo/zhihu/baidu/douyin/bilibili/toutiao.
 */
export class VvhanScraper implements ScraperSource {
  readonly sourceName = "vvhan";
  readonly platformName: string;
  private readonly endpoint: string;

  constructor(platformName: string) {
    const apiSlug = PLATFORM_MAP[platformName];
    if (!apiSlug) {
      throw new Error(`Unsupported platform for vvhan: ${platformName}`);
    }
    this.platformName = platformName;
    this.endpoint = `https://api.vvhan.com/api/hotlist/${apiSlug}`;
  }

  async fetch(): Promise<RawHotSearchItem[]> {
    const resp = await fetch(this.endpoint, {
      headers: { "User-Agent": "MelonScout/1.0" },
    });

    if (!resp.ok) {
      throw new Error(`vvhan API returned ${resp.status} for ${this.platformName}`);
    }

    const json = (await resp.json()) as VvhanResponse;
    if (!json.success || !Array.isArray(json.data)) {
      throw new Error(`vvhan API returned invalid data for ${this.platformName}`);
    }

    return json.data.map((item, idx) => ({
      title: item.title,
      url: item.url || "",
      heatValue: String(item.hot ?? ""),
      rank: item.index ?? idx + 1,
    }));
  }
}

export const SUPPORTED_PLATFORMS = Object.keys(PLATFORM_MAP);
