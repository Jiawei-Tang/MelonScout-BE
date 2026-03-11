import { Flame } from "lucide-react";
import type { HotSearchItem } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui";

interface HotWordsCardProps {
  items: HotSearchItem[];
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
  return [...bucket.entries()].sort((a, b) => b[1] - a[1]);
}

export function HotWordsCard({ items }: HotWordsCardProps) {
  const words = extractHotWords(items);

  return (
    <Card>
      <CardHeader className="pb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
          <Flame size={16} className="text-detective-green" />
          热词云
        </h2>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex max-h-24 flex-wrap gap-2 overflow-hidden">
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
  );
}
