import { Sparkles, TrendingUp } from "lucide-react";
import type { HotSearchItem, Platform } from "@/lib/types";
import { Badge, Card, CardContent, CardHeader } from "@/components/ui";

interface TopHighlightsProps {
  items: Array<HotSearchItem & { compositeScore: number }>;
  platforms: Platform[];
}

export function TopHighlights({ items, platforms }: TopHighlightsProps) {
  if (items.length === 0) return null;

  return (
    <Card className="border-detective-green/40 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900">
      <CardHeader className="pb-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles size={18} className="text-detective-green" />
          重点卷宗 Top 3
        </h2>
        <p className="text-xs text-slate-500">标题党优先，其次按热度 + 更新时间 + 用户点赞综合排序（最近7天）</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, index) => {
          const platformLabel = platforms.find((p) => p.id === item.platformId)?.displayName ?? `平台${item.platformId}`;
          return (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge className="border-detective-green/40 text-detective-green">
                  #{index + 1} · {platformLabel}
                </Badge>
                <span className="text-xs text-slate-500">热度 {item.heatValue ?? "-"}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-semibold">{item.title}</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                <TrendingUp size={12} className="mr-1 inline" />
                {item.analysis?.verdict ?? item.analysis?.reason ?? "已分析"}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
