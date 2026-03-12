import { Menu, Moon, Sun, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getHotSearches,
  getPlatforms,
  getTopHighlights,
  getVisitStats,
} from "@/lib/api";
import type { HotSearchItem, Platform } from "@/lib/types";
import { MelonCard } from "@/components/melon-card";
import { HighlightsMelonCard } from "@/components/highlights-melon-card";
import { EvidenceLab } from "@/components/evidence-lab";
import { HotSearchList } from "@/components/hot-search-list";
import { AppFooter } from "@/components/app-footer";

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
      <div className="grid h-10 w-10 place-items-center rounded-full bg-detective-green/15 text-xl">
        🍉
      </div>
      <div>
        <p className="text-lg font-extrabold tracking-tight">瓜田侦探</p>
        <p className="text-xs text-slate-500 dark:text-slate-300">
          Melon Scout
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [items, setItems] = useState<HotSearchItem[]>([]);
  const [highlights, setHighlights] = useState<HotSearchItem[]>([]);
  const [filter, setFilter] = useState<PlatformFilter>("all");
  const [onlyAnalyzed, setOnlyAnalyzed] = useState(false);
  const [onlyClickbait, setOnlyClickbait] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState(detectTheme);
  const [isLabOpen, setIsLabOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [visitCount, setVisitCount] = useState<number | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);

  const scrollToFooter = () => {
    const target = footerRef.current;
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("melon-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!isLabOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isLabOpen]);

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
      getVisitStats(true)
        .then((data) => {
          setVisitCount(data.count);
          localStorage.setItem(key, String(now));
        })
        .catch(() => setVisitCount(null));
    } else {
      getVisitStats(false)
        .then((data) => setVisitCount(data.count))
        .catch(() => setVisitCount(null));
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
      days: QUERY_DAYS,
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
      days: QUERY_DAYS,
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
  }, [
    filter,
    hasMore,
    loading,
    loadingMore,
    offset,
    onlyAnalyzed,
    onlyClickbait,
  ]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { threshold: 0.2 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchKeyword(searchInput.trim().toLowerCase());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filteredItems = useMemo(() => {
    if (!searchKeyword) return items;
    return items.filter((item) =>
      item.title.toLowerCase().includes(searchKeyword),
    );
  }, [items, searchKeyword]);

  const stats = useMemo(() => {
    const inspected = filteredItems.length;
    const clickbait = filteredItems.filter(
      (item) => (item.analysis?.score ?? 0) >= 51 || item.analysis?.isClickbait,
    ).length;
    return { inspected, clickbait };
  }, [filteredItems]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-3 lg:grid-cols-[280px_1fr_360px] lg:items-center">
          <Logo />

          <p className="rounded-lg bg-slate-100 px-4 py-2 text-center text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            今日已巡查{" "}
            <strong>{stats.inspected.toLocaleString("zh-CN")}</strong>{" "}
            块瓜，揪出{" "}
            <strong className="text-detective-red">
              {stats.clickbait.toLocaleString("zh-CN")}
            </strong>{" "}
            个标题党
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
              onClick={() =>
                setTheme((prev) => (prev === "dark" ? "light" : "dark"))
              }
              className="rounded-full border border-slate-300 p-2 dark:border-slate-700"
              aria-label="切换主题"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl p-4 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
        <div className="space-y-4">
          {highlights.length > 0 && (
            <div className="space-y-2 select-none">
              <p className="text-sm font-semibold text-detective-green">
                重点卷宗 Top 3（最近 7 天）
              </p>
              {highlights.map((item) => {
                const platformLabel =
                  platforms.find((p) => p.id === item.platformId)
                    ?.displayName ?? `平台${item.platformId}`;
                return (
                  <HighlightsMelonCard
                    key={`highlight-${item.id}`}
                    item={item}
                    platformLabel={platformLabel}
                  />
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-1 items-center gap-2">
              <p className="shrink-0 text-sm text-slate-600 dark:text-slate-300">
                列表窗口：最近 {QUERY_DAYS} 天
              </p>
              <div className="relative w-full max-w-xs">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    scrollToFooter();
                  }}
                  placeholder="你在挑哪只瓜？"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 pr-9 text-sm text-slate-700 outline-none ring-detective-green/30 placeholder:text-slate-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput("")}
                    className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    aria-label="清空"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setOnlyAnalyzed((v) => !v);
                  scrollToFooter();
                }}
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
                onClick={() => {
                  setOnlyClickbait((v) => !v);
                  scrollToFooter();
                }}
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

          <HotSearchList
            items={filteredItems}
            platforms={platforms}
            loading={loading}
            error={error}
            loadingMore={loadingMore}
            hasMore={hasMore}
            searchKeyword={searchKeyword}
            loadMoreRef={loadMoreRef}
          />

          <div ref={footerRef}>
            <AppFooter />
          </div>
        </div>

        <aside className="hidden lg:sticky lg:top-28 lg:block lg:self-start lg:mt-[-4px] mt-6">
          <EvidenceLab
            items={items}
            platforms={platforms}
            visitCount={visitCount}
          />
        </aside>
      </main>

      <button
        type="button"
        onClick={() => setIsLabOpen(true)}
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-1 rounded-full bg-detective-green px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 lg:hidden"
      >
        <Menu size={16} />
        瓜田菜单
      </button>

      {isLabOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setIsLabOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-2xl border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                瓜田侧栏
              </p>
              <button
                type="button"
                onClick={() => setIsLabOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="关闭侧栏"
              >
                <X size={16} />
              </button>
            </div>
            <EvidenceLab
              items={items}
              platforms={platforms}
              visitCount={visitCount}
            />
          </div>
        </div>
      )}
    </div>
  );
}
