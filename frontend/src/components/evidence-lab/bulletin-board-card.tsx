import { Megaphone, Star } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { AdSpotBanner } from "@/components/evidence-lab/ad-spot-banner";

const GITHUB_URL = "https://github.com/Jiawei-Tang/MelonScout-BE";

export function BulletinBoardCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-100">
          <Megaphone size={16} className="text-detective-green" />
          瓜田布告栏
        </h2>
      </CardHeader>
      <CardContent className="space-y-3 pt-0 text-sm">
        <p className="text-xs text-slate-500">请给伯伯买只瓜，帮助瓜田继续成长</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => window.alert("谢谢金主爸爸，暂时还未开通支付，如果方便请去 GitHub 点个 Star 吧。")}
            className="rounded-md bg-detective-green px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            给伯伯买只瓜
          </button>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-detective-green hover:text-detective-green dark:border-slate-700 dark:text-slate-200"
          >
            <Star size={14} fill="yellow" stroke="gold" />
            去 GitHub 比个星
          </a>
        </div>
        <AdSpotBanner />
      </CardContent>
    </Card>
  );
}
