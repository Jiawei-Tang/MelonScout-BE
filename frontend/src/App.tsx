import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getHotSearches, getPlatforms, getTopHighlights, getVisitStats} from "@/lib/api";
import type { HotSearchItem, Platform } from "@/lib/types";
import { MelonCard } from "@/components/melon-card";
import { EvidenceLab } from "@/components/evidence-lab";
import { TopHighlights } from "@/components/top-highlights";

type PlatformFilter = "all" | number;
const PAGE_SIZE = 20;
const QUERY_DAYS = 7;

function detectTheme() {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem("melon-theme") ?? "light";
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-detective-green/15 text-xl">🍉</div>
      <div>
        <p className="text-lg font-extrabold tracking-tight">瓜田侦探</p>
        <p className="text-xs text-slate-500 dark:text-slate-300">Melon Scout</p>
      </div>
    </div>
  );
}

export default function App() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [items, setItems] = useState<HotSearchItem[]>([]);
  const [highlights, setHighlights] = useState<Array<HotSearchItem & { compositeScore: number }>>([]);
  const [filter, setFilter] = useState<PlatformFilter>("all");
  const [onlyAnalyzed, setOnlyAnalyzed] = useState(false);
  const [onlyClickbait, setOnlyClickbait] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState(detectTheme);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [visitCount, setVisitCount] = useState<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("melon-theme", theme);
  }, [theme]);

  useEffect(() => {
    void getPlatforms()
      .then((res) => setPlatforms(res.data))
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    void getTopHighlights()
      .then((res) => setHighlights(res.data))
      .catch((err: Error) => setError(err.message));
  }, []);

  // 访问量统计逻辑
  useEffect(() => {
    const key = "melon-visit-stats-ts";
    const now = Date.now();
    const last = Number(localStorage.getItem(key) || 0);
    if (now - last > 3 * 60 * 1000) {
      getVisitStats(true).then((data) => {
        setVisitCount(data.count);
        localStorage.setItem(key, String(now));
      }).catch(() => setVisitCount(null));
    } else {
      getVisitStats(false).then((data) => setVisitCount(data.count)).catch(() => setVisitCount(null));
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setOffset(0);
    setHasMore(true);
    const params = {
      ...(filter === "all" ? {} : { platformId: filter }),
      limit: PAGE_SIZE,
      offset: 0,
      hasAnalysis: onlyAnalyzed ? true : undefined,
      onlyClickbait: onlyClickbait ? true : undefined,
      days: QUERY_DAYS
    };
    void getHotSearches(params)
      .then((res) => {
        setItems(res.data);
        setOffset(res.meta.nextOffset ?? 0);
        setHasMore(res.meta.hasMore);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filter, onlyAnalyzed, onlyClickbait]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const params = {
      ...(filter === "all" ? {} : { platformId: filter }),
      limit: PAGE_SIZE,
      offset,
      hasAnalysis: onlyAnalyzed ? true : undefined,
      onlyClickbait: onlyClickbait ? true : undefined,
      days: QUERY_DAYS
    };
    void getHotSearches(params)
      .then((res) => {
        setItems((prev) => {
          const ids = new Set(prev.map((item) => item.id));
          const append = res.data.filter((item) => !ids.has(item.id));
          return [...prev, ...append];
        });
        setOffset(res.meta.nextOffset ?? offset);
        setHasMore(res.meta.hasMore);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoadingMore(false));
  }, [filter, hasMore, loading, loadingMore, offset, onlyAnalyzed, onlyClickbait]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { threshold: 0.2 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore]);

  const stats = useMemo(() => {
    const inspected = items.length;
    const clickbait = items.filter((item) => (item.analysis?.score ?? 0) >= 51 || item.analysis?.isClickbait).length;
    return { inspected, clickbait };
  }, [items]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-3 lg:grid-cols-[280px_1fr_360px] lg:items-center">
          <Logo />

          <p className="rounded-lg bg-slate-100 px-4 py-2 text-center text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            今日已巡查 <strong>{stats.inspected.toLocaleString("zh-CN")}</strong> 块瓜，揪出{" "}
            <strong className="text-detective-red">{stats.clickbait.toLocaleString("zh-CN")}</strong> 个标题党
          </p>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-full px-3 py-1.5 text-sm ${
                filter === "all"
                  ? "bg-detective-green text-white"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100"
              }`}
            >
              全网
            </button>
            {platforms.map((platform) => (
              <button
                key={platform.id}
                type="button"
                onClick={() => setFilter(platform.id)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  filter === platform.id
                    ? "bg-detective-green text-white"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100"
                }`}
              >
                {platform.displayName}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              className="rounded-full border border-slate-300 p-2 dark:border-slate-700"
              aria-label="切换主题"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <TopHighlights items={highlights} platforms={platforms} />

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm text-slate-600 dark:text-slate-300">列表窗口：最近 {QUERY_DAYS} 天</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyAnalyzed((v) => !v)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  onlyAnalyzed
                    ? "bg-detective-green text-white"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100"
                }`}
              >
                {onlyAnalyzed ? "仅AI分析: 已开启" : "仅看AI分析"}
              </button>
              <button
                type="button"
                onClick={() => setOnlyClickbait((v) => !v)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  onlyClickbait
                    ? "bg-red-500 text-white"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-100"
                }`}
              >
                {onlyClickbait ? "仅标题党: 已开启" : "仅看标题党"}
              </button>
            </div>
          </div>

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
          {!loading && !error && items.length === 0 && <p className="text-sm text-slate-500">暂无热搜数据。</p>}
          {!loading && !error && (
            <div ref={loadMoreRef} className="py-3 text-center text-xs text-slate-500">
              {loadingMore ? "正在加载更多卷宗..." : hasMore ? "下滑自动加载更多" : "最近 7 天的卷宗已加载完成"}
            </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <EvidenceLab items={items} platforms={platforms} visitCount={visitCount} />
        </aside>
      </main>
    </div>
  );
}
