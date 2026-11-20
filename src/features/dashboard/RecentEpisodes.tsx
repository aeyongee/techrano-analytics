import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Cover } from "@/components/Cover";
import { GateBadge } from "@/components/GateBadge";
import { Panel, PanelHeader } from "@/components/Panel";
import type { EpisodeView } from "@/lib/data/builders";
import { formatAge, formatCount, formatPct } from "@/lib/domain/format";

export function RecentEpisodes({ episodes, basePath }: { episodes: EpisodeView[]; basePath: string }) {
  return (
    <Panel aria-labelledby="recent-title">
      <PanelHeader
        title={<span id="recent-title">최근 편</span>}
        action={
          <Link href={`${basePath}/episodes`} className="text-xs font-semibold text-sky hover:underline">
            전체 보기
          </Link>
        }
      />
      <ul className="mt-2 divide-y divide-border">
        {episodes.map((e) => (
          <li key={e.key}>
            <Link
              href={`${basePath}/episodes/${e.key}`}
              className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40 xl:px-5"
            >
              <Cover src={e.coverUrl} alt={e.title} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold text-muted-foreground tabular-nums">{e.epNo !== null ? `${e.epNo}편` : "초안"}</span>
                <span className="block truncate text-sm font-semibold">{e.title}</span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {formatAge(e.ageHours)} 전 · 조회 {formatCount(e.ig?.latest?.views)} · 건너뛰기 {formatPct(e.ig?.latest?.skipRate)}
                </span>
              </span>
              <span className="hidden gap-1.5 sm:flex xl:hidden 2xl:flex">
                <GateBadge label="1차" verdict={e.gates.hook} />
                <GateBadge label="2차" verdict={e.gates.spread} />
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
