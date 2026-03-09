export interface RawHotSearchItem {
  title: string;
  url: string;
  description?: string;
  heatValue?: string;
  rank?: number;
}

export interface ScraperSource {
  readonly platformName: string;
  readonly sourceName: string;
  fetch(): Promise<RawHotSearchItem[]>;
}
