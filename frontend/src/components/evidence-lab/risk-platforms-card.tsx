import { ShieldAlert } from "lucide-react";
import type { HotSearchItem, Platform } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui";

interface RiskPlatformsCardProps {
  items: HotSearchItem[];
  platforms: Platform[];
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

export function RiskPlatformsCard({ items, platforms }: RiskPlatformsCardProps) {
  const risks = topRiskPlatforms(items, platforms);

  return (
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
  );
}
