export interface Platform {
  id: number;
  name: string;
  displayName: string;
}

export interface Analysis {
  id?: number;
  needsFactCheck: boolean;
  triageReason: string;
  category: string;
  aiModel?: string;
  deepAiModel?: string;
  updatedAt?: string | null;
  upVotes?: number;
  downVotes?: number;
  isClickbait: boolean | null;
  score: number | null;
  reason: string | null;
  deepAnalysis: string | null;
  verdict: string | null;
  deepAnalyzedAt: string | null;
}

export interface HotSearchItem {
  id: number;
  platformId: number;
  title: string;
  url: string;
  heatValue: string | null;
  rank: number | null;
  createdAt: string;
  extra: unknown;
  analysis: Analysis | null;
}

export interface HotSearchResponse {
  data: HotSearchItem[];
  meta: {
    limit: number;
    offset: number;
    days: number;
    hasAnalysis: boolean | null;
    hasMore: boolean;
    nextOffset: number | null;
  };
}

export interface PlatformsResponse {
  data: Platform[];
}

export interface HighlightsResponse {
  data: Array<HotSearchItem & { compositeScore: number }>;
  meta: {
    days: number;
    size: number;
  };
}
