import type { ScraperSource, RawHotSearchItem } from "../types";

/**
 * Placeholder scraper — returns mock data for development/testing.
 */
export class PlaceholderScraper implements ScraperSource {
  readonly platformName = "weibo";
  readonly sourceName = "placeholder";

  async fetch(): Promise<RawHotSearchItem[]> {
    return [
      { title: "某明星深夜发文引发热议", url: "https://example.com/1", heatValue: "9999万", rank: 1 },
      { title: "重大科学突破：新型材料或将改变世界", url: "https://example.com/2", heatValue: "8888万", rank: 2 },
      { title: "震惊！你绝对想不到这件事的真相", url: "https://example.com/3", heatValue: "7777万", rank: 3 },
      { title: "教育部发布2026年高考新政策", url: "https://example.com/4", heatValue: "6666万", rank: 4 },
      { title: "网友实测：这个方法真的能月入过万？", url: "https://example.com/5", heatValue: "5555万", rank: 5 },
      { title: "竟然有人靠这个副业月入十万", url: "https://example.com/6", heatValue: "4444万", rank: 6 },
      { title: "今年考研人数再创新高", url: "https://example.com/7", heatValue: "3333万", rank: 7 },
      { title: "速看！这条新规明天就生效了", url: "https://example.com/8", heatValue: "2222万", rank: 8 },
      { title: "多地出台房产新政", url: "https://example.com/9", heatValue: "1111万", rank: 9 },
      { title: "国际油价大幅波动引市场关注", url: "https://example.com/10", heatValue: "999万", rank: 10 },
      { title: "独家揭秘：你所不知道的行业内幕", url: "https://example.com/11", heatValue: "888万", rank: 11 },
      { title: "某地发生地震 当地紧急响应", url: "https://example.com/12", heatValue: "777万", rank: 12 },
    ];
  }
}
