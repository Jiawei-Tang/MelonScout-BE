import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, CircleSlash, Zap } from "lucide-react";
import type { HotSearchItem } from "@/lib/types";
import { toCNTime, voteHotSearch } from "@/lib/api";
import { Badge, Card, CardContent, CardHeader } from "@/components/ui";

interface MelonCardProps {
  item: HotSearchItem;
  platformLabel: string;
}

function scoreLabel(score: number | null) {
  if (score == null) return "待分析";
  if (score <= 20) return "基本真实";
  if (score <= 50) return "存在争议";
  if (score <= 70) return "可信存疑";
  return "高度误导";
}

function scoreColor(score: number | null) {
  if (score == null) return "#64748B";
  if (score <= 50) return "#10B981";
  if (score <= 70) return "#F59E0B";
  return "#EF4444";
}

function scoreTags(item: HotSearchItem): string[] {
  if (!item.analysis) return ["待分诊"];
  const tags: string[] = [];
  if (item.analysis.isClickbait) tags.push("标题党");
  if (item.analysis.category === "celebrity_scandal") tags.push("反转风险");
  if (item.analysis.category === "normal") tags.push("事实陈述");
  if (item.analysis.category === "clickbait") tags.push("夸张叙事");
  if (item.analysis.category === "policy") tags.push("政策类");
  if (tags.length === 0) tags.push("待核实");
  return tags;
}

export function MelonCard({ item, platformLabel }: MelonCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [votes, setVotes] = useState({
    up: item.analysis?.upVotes ?? 0,
    down: item.analysis?.downVotes ?? 0
  });
  const [voting, setVoting] = useState(false);
  const [votedAction, setVotedAction] = useState<"up" | "down" | null>(null);
  const score = item.analysis?.score ?? null;
  const isClickbait = item.analysis?.isClickbait ?? false;
  const stroke = useMemo(() => scoreColor(score), [score]);
  const percentage = score ?? 0;

  async function handleVote(action: "up" | "down") {
    if (!item.analysis || voting) return;
    const prevAction = votedAction;
    const nextAction = prevAction === action ? null : action;
    const prevVotes = votes;
    const nextVotes = { ...votes };

    if (prevAction === "up") nextVotes.up = Math.max(0, nextVotes.up - 1);
    if (prevAction === "down") nextVotes.down = Math.max(0, nextVotes.down - 1);
    if (nextAction === "up") nextVotes.up += 1;
    if (nextAction === "down") nextVotes.down += 1;

    setVotedAction(nextAction);
    setVotes(nextVotes);
    if (!nextAction) return;

    setVoting(true);
    try {
      await voteHotSearch(item.id, nextAction);
    } catch {
      setVotedAction(prevAction);
      setVotes(prevVotes);
    } finally {
      setVoting(false);
    }
  }

  return (
    <Card className={`border-l-4 border-l-detective-green transition hover:shadow-melon ${expanded ? "melon-cut" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Badge>
            {platformLabel} · #{item.rank ?? "-"}
          </Badge>
          <span className="text-xs text-slate-500 dark:text-slate-400">{toCNTime(item.createdAt)}</span>
        </div>
        <h3 className="mt-3 text-lg font-bold leading-snug text-slate-900 dark:text-slate-100">{item.title}</h3>
      </CardHeader>

      <CardContent>
        <div
          className={`flex items-start gap-3 rounded-lg p-3 ${
            isClickbait ? "bg-red-50 dark:bg-red-950/20" : "bg-emerald-50 dark:bg-emerald-950/20"
          }`}
        >
          <div className="relative h-14 w-14 shrink-0">
            <div
              className="h-14 w-14 rounded-full"
              style={{
                background: `conic-gradient(${stroke} ${percentage * 3.6}deg, rgba(148, 163, 184, 0.2) 0deg)`
              }}
            />
            <div className="absolute inset-[5px] grid place-items-center rounded-full bg-white text-xs font-bold dark:bg-slate-900">
              {score ?? "--"}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {isClickbait ? (
                <AlertCircle className="mt-0.5 shrink-0 text-red-500" size={18} />
              ) : (
                <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-500" size={18} />
              )}
              <span className={`font-bold ${isClickbait ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                侦探判定：{scoreLabel(score)}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {scoreTags(item).map((tag) => (
                <Badge key={tag} className="border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  [{tag}]
                </Badge>
              ))}
            </div>

            <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              <Zap size={14} className="mr-1 inline text-amber-500" />
              <strong>脱水结论：</strong>
              {item.analysis
                ? item.analysis.verdict ??
                  item.analysis.reason ??
                  (item.analysis.needsFactCheck ? "AI 正在调查中，稍后回来查看结论。" : item.analysis.triageReason)
                : "AI 正在调查中，稍后回来查看结论。"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-detective-green dark:text-slate-300"
          >
            卷宗详情
            <ChevronDown className={`transition ${expanded ? "rotate-180" : ""}`} size={16} />
          </button>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => void handleVote("up")}
              disabled={!item.analysis || voting}
              className={`rounded-md border px-2 py-1 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                votedAction === "up"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                  : "border-slate-300 hover:border-emerald-500 hover:text-emerald-600 dark:border-slate-700"
              }`}
            >
              我觉得准 (<span className="tabular-nums">{votes.up}</span>)
            </button>
            <button
              type="button"
              onClick={() => void handleVote("down")}
              disabled={!item.analysis || voting}
              className={`rounded-md border px-2 py-1 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                votedAction === "down"
                  ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300"
                  : "border-slate-300 hover:border-red-500 hover:text-red-600 dark:border-slate-700"
              }`}
            >
              AI 被骗了 (<span className="tabular-nums">{votes.down}</span>)
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
            <p>
              <strong>分诊原因：</strong>
              {item.analysis?.triageReason ?? "尚未分诊"}
            </p>
            <p className="mt-2 whitespace-pre-wrap">
              <strong>深度分析：</strong>
              {item.analysis?.deepAnalysis ?? <CircleSlash className="inline-block text-slate-400" size={14} />}
            </p>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-detective-green hover:underline"
              >
                查看原始链接
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
