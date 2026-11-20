import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Cover } from "@/components/Cover";
import { GateBadge } from "@/components/GateBadge";
import { Panel, PanelHeader } from "@/components/Panel";
import type { EpisodeView } from "@/lib/data/builders";
import { formatAge, formatCount, formatPct } from "@/lib/domain/format";
import type { Platform } from "@/lib/domain/types";

/** 플랫폼별 한 줄 요약과 관문 */
function summaryOf(e: EpisodeView, platform: Platform) {
  if (platform === "yt") {
    const views = `조회 ${formatCount(e.yt?.latest?.views)}`;
    const watch = e.yt?.analytics ? `유효 조회 ${formatPct(e.ytGates.engagedRatio)} · 평균 시청 ${formatPct(e.ytGates.avgViewPct)}` : "Analytics 집계 대기";
    return { line: `${views} · ${watch}`, first: e.ytGates.hook, second: e.ytGates.finish };
  }
  return { line: `조회 ${formatCount(e.ig?.latest?.views)} · 건너뛰기 ${formatPct(e.ig?.latest?.skipRate)}`, first: e.gates.hook, second: e.gates.spread };
}

export function RecentEpisodes({ episodes, platform, basePath }: { episodes: EpisodeView[]; platform: Platform; basePath: string }) {
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
        {episodes.map((e) => {
          const sum = summaryOf(e, platform);
          return (
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
                  {formatAge(e.ageHours)} 전 · {sum.line}
                </span>
              </span>
              <span className="hidden gap-1.5 sm:flex xl:hidden 2xl:flex">
                <GateBadge label="1차" verdict={sum.first} />
                <GateBadge label="2차" verdict={sum.second} />
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
          );
        })}
      </ul>
    </Panel>
  );
}
