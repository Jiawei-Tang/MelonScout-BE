import type { HighlightsResponse, HotSearchResponse, PlatformsResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

async function requestJSON<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as T;
}

export function getPlatforms() {
  return requestJSON<PlatformsResponse>("/api/platforms");
}

export function getHotSearches(params: {
  platformId?: number;
  limit?: number;
  offset?: number;
  hasAnalysis?: boolean;
  onlyClickbait?: boolean;
  days?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.platformId != null) searchParams.set("platformId", String(params.platformId));
  if (params.limit != null) searchParams.set("limit", String(params.limit));
  if (params.offset != null) searchParams.set("offset", String(params.offset));
  searchParams.set("days", String(params.days ?? 7));
  if (params.hasAnalysis === true) searchParams.set("hasAnalysis", "true");
  if (params.onlyClickbait === true) searchParams.set("onlyClickbait", "true");
  const qs = searchParams.toString();
  return requestJSON<HotSearchResponse>(`/api/hot-searches${qs ? `?${qs}` : ""}`);
}

export function getTopHighlights() {
  return requestJSON<HighlightsResponse>("/api/hot-searches/highlights/top?days=7");
}

export function voteHotSearch(id: number, action: "up" | "down") {
  return fetch(`${API_BASE_URL}/api/hot-searches/${id}/votes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action })
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Vote ${response.status}: ${await response.text()}`);
    return (await response.json()) as { data: { hotSearchId: number; upVotes: number; downVotes: number } };
  });
}

export function toCNTime(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
