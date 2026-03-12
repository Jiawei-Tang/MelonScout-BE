import type { RefObject } from "react";
import type { HotSearchItem, Platform } from "@/lib/types";
import { MelonCard } from "@/components/melon-card";

export interface HotSearchListProps {
  items: HotSearchItem[];
  platforms: Platform[];
  loading: boolean;
  error: string | null;
  loadingMore: boolean;
  hasMore: boolean;
  searchKeyword: string;
  loadMoreRef: RefObject<HTMLDivElement>;
}

export function HotSearchList({
  items,
  platforms,
  loading,
  error,
  loadingMore,
  hasMore,
  searchKeyword,
  loadMoreRef,
}: HotSearchListProps) {
  return (
    <div className="h-[66vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30">
      <div className="space-y-4 p-2">
        {loading && <p className="text-sm text-slate-500">正在翻查卷宗...</p>}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-300">
            请求失败：{error}
          </p>
        )}
        {!loading &&
          !error &&
          items.map((item) => {
            const platformLabel = platforms.find((p) => p.id === item.platformId)?.displayName ?? `平台${item.platformId}`;
            return <MelonCard key={item.id} item={item} platformLabel={platformLabel} />;
          })}
        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-slate-500">{searchKeyword ? "没有匹配的热搜结果。" : "暂无热搜数据。"}</p>
        )}
        {!loading && !error && (
          <div ref={loadMoreRef} className="py-3 text-center text-xs text-slate-500">
            {loadingMore ? "正在加载更多卷宗..." : hasMore ? "下滑自动加载更多" : "最近 7 天的卷宗已加载完成"}
          </div>
        )}
      </div>
    </div>
  );
}
