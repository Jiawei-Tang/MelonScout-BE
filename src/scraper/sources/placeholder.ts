import type { ScraperSource, RawHotSearchItem } from "../types";

/**
 * Placeholder scraper — returns mock data for development.
 * Replace with real API integrations (e.g. weibo, zhihu, baidu) later.
 */
export class PlaceholderScraper implements ScraperSource {
  readonly platformName = "weibo";
  readonly sourceName = "placeholder";

  async fetch(): Promise<RawHotSearchItem[]> {
    return [
      {
        title: "某明星深夜发文引发热议",
        url: "https://example.com/1",
        heatValue: "9999万",
        rank: 1,
      },
      {
        title: "重大科学突破：新型材料或将改变世界",
        url: "https://example.com/2",
        heatValue: "8888万",
        rank: 2,
      },
      {
        title: "震惊！你绝对想不到这件事的真相",
        url: "https://example.com/3",
        heatValue: "7777万",
        rank: 3,
      },
      {
        title: "教育部发布2026年高考新政策",
        url: "https://example.com/4",
        heatValue: "6666万",
        rank: 4,
      },
      {
        title: "网友实测：这个方法真的能月入过万？",
        url: "https://example.com/5",
        heatValue: "5555万",
        rank: 5,
      },
    ];
  }
}
