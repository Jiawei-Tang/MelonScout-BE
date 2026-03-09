/** Source-specific extra data stored in hot_searches.extra (e.g. tianapi: hottag, hotwordnum). */
export type RawHotSearchExtra = Record<string, unknown>;

export interface RawHotSearchItem {
  title: string;
  url: string;
  heatValue?: string;
  rank?: number;
  extra?: RawHotSearchExtra;
}

export interface ScraperSource {
  readonly platformName: string;
  readonly sourceName: string;
  fetch(): Promise<RawHotSearchItem[]>;
}
