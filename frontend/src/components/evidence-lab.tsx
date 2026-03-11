import { Activity, BrainCircuit, Flame, ShieldAlert } from "lucide-react";
import type { HotSearchItem, Platform } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui";

interface EvidenceLabProps {
  items: HotSearchItem[];
  platforms: Platform[];
  visitCount: number | null;
}

function extractHotWords(items: HotSearchItem[]) {
  const bucket = new Map<string, number>();
  for (const item of items) {
    const chunks = item.title.match(/[\u4e00-\u9fa5A-Za-z0-9]{2,4}/g) ?? [];
    for (const chunk of chunks) {
      if (chunk.length < 2) continue;
      bucket.set(chunk, (bucket.get(chunk) ?? 0) + 1);
    }
  }
  return [...bucket.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16);
}

function topRiskPlatforms(items: HotSearchItem[], platforms: Platform[]) {
  const counter = new Map<number, { bad: number; all: number }>();
  for (const item of items) {
    const current = counter.get(item.platformId) ?? { bad: 0, all: 0 };
    current.all += 1;
    if ((item.analysis?.score ?? 0) >= 51 || item.analysis?.isClickbait) current.bad += 1;
    counter.set(item.platformId, current);
  }
  return [...counter.entries()]
    .map(([platformId, stat]) => {
      const platform = platforms.find((p) => p.id === platformId);
      return {
        name: platform?.displayName ?? `平台 ${platformId}`,
        ratio: stat.all ? Math.round((stat.bad / stat.all) * 100) : 0
      };
    })
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 4);
}

function activeModel(items: HotSearchItem[]) {
  for (const item of items) {
    if (item.analysis?.deepAiModel) return item.analysis.deepAiModel;
    if (item.analysis?.aiModel) return item.analysis.aiModel;
  }
  return "mock / 未上报";
}

export function EvidenceLab({ items, platforms, visitCount }: EvidenceLabProps) {
  const words = extractHotWords(items);
  const risks = topRiskPlatforms(items, platforms);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
            <Flame size={16} className="text-detective-green" />
            热词云
          </h2>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {words.length ? (
              words.map(([word, count]) => (
                <span
                  key={word}
                  className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {word} <span className="opacity-60">x{count}</span>
                </span>
              ))
            ) : (
              <p className="text-xs text-slate-500">等待数据刷新...</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
            <ShieldAlert size={16} className="text-detective-red" />
            避雷榜
          </h2>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="space-y-2">
            {risks.map((risk) => (
              <li key={risk.name} className="flex items-center justify-between text-sm">
                <span>{risk.name}</span>
                <span className="font-semibold text-detective-red">{risk.ratio}%</span>
              </li>
            ))}
            {risks.length === 0 && <li className="text-xs text-slate-500">暂无样本</li>}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
            项目动态
          </h2>
        </CardHeader>
        <CardContent className="space-y-2 pt-0 text-sm">
          <p className="flex items-center gap-1">
            <Activity size={16} className="text-emerald-500" />
            <span className="text-xs text-slate-500">总访问量：{visitCount === null ? "--" : visitCount.toLocaleString("zh-CN")}</span>
          </p>
          <p className="flex items-center gap-1">
            <BrainCircuit size={14} className="text-detective-green" />
            当前鉴瓜师：{activeModel(items)}
          </p>
          <p className="text-xs text-slate-500">后端每次巡查会同步更新热搜和 AI 分析结果。</p>
        </CardContent>
      </Card>
    </div>
  );
}
