import type { ScraperSource, RawHotSearchItem } from "../types";

export class PlaceholderScraper implements ScraperSource {
  readonly platformName: string;
  readonly sourceName = "placeholder";

  constructor(platformName: string = "weibo") {
    this.platformName = platformName;
  }

  async fetch(): Promise<RawHotSearchItem[]> {
    return [
      { title: "某顶流明星深夜被拍到疑似出轨", url: "https://example.com/1", heatValue: "9999万", rank: 1 },
      { title: "小米一体化压铸铝三角梁获2025国际压铸大赛最佳结构奖", url: "https://example.com/2", heatValue: "8888万", rank: 2 },
      { title: "震惊！你绝对想不到这件事的真相", url: "https://example.com/3", heatValue: "7777万", rank: 3 },
      { title: "教育部发布2026年高考新政策", url: "https://example.com/4", heatValue: "6666万", rank: 4 },
      { title: "网友实测：这个方法真的能月入过万？", url: "https://example.com/5", heatValue: "5555万", rank: 5 },
      { title: "某知名演员被曝吸毒被警方带走", url: "https://example.com/6", heatValue: "4444万", rank: 6 },
      { title: "今年考研人数再创新高", url: "https://example.com/7", heatValue: "3333万", rank: 7 },
      { title: "华为荣获全球通信技术创新金奖", url: "https://example.com/8", heatValue: "2222万", rank: 8 },
      { title: "热播剧《繁花》大结局收视率破纪录", url: "https://example.com/9", heatValue: "1111万", rank: 9 },
      { title: "国际油价大幅波动引市场关注", url: "https://example.com/10", heatValue: "999万", rank: 10 },
    ];
  }
}
