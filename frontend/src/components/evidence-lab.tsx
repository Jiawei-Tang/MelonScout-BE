import type { HotSearchItem, Platform } from "@/lib/types";
import { BulletinBoardCard } from "@/components/evidence-lab/bulletin-board-card";
import { HotWordsCard } from "@/components/evidence-lab/hot-words-card";
import { ProjectStatusCard } from "@/components/evidence-lab/project-status-card";
import { RiskPlatformsCard } from "@/components/evidence-lab/risk-platforms-card";

interface EvidenceLabProps {
  items: HotSearchItem[];
  platforms: Platform[];
  visitCount: number | null;
}

export function EvidenceLab({ items, platforms, visitCount }: EvidenceLabProps) {
  return (
    <div className="space-y-3">
      <BulletinBoardCard />
      <ProjectStatusCard items={items} visitCount={visitCount} />
      <HotWordsCard items={items} />
      <RiskPlatformsCard items={items} platforms={platforms} />
    </div>
  );
}
