import { Activity, BrainCircuit } from "lucide-react";
import type { HotSearchItem } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui";

interface ProjectStatusCardProps {
  items: HotSearchItem[];
  visitCount: number | null;
}

function activeModel(items: HotSearchItem[]) {
  for (const item of items) {
    if (item.analysis?.deepAiModel) return item.analysis.deepAiModel;
    if (item.analysis?.aiModel) return item.analysis.aiModel;
  }
  return "mock / 未上报";
}

export function ProjectStatusCard({ items, visitCount }: ProjectStatusCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">项目动态</h2>
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
  );
}
