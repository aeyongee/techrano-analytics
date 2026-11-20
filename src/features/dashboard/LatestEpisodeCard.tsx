import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { GateBadges } from "@/components/GateBadge";
import { Panel } from "@/components/Panel";
import { PlatformTag } from "@/components/PlatformTag";
import type { LatestCard } from "@/lib/data/builders";
import { formatAge, formatCount, formatCountFull, formatDuration, formatPct, formatRate, formatSignedCount } from "@/lib/domain/format";
import { Sparkline } from "./Sparkline";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

export function LatestEpisodeCard({ card, basePath }: { card: LatestCard; basePath: string }) {
  const { episode: e, igViewsDelta, skipDelta, ytViewsDelta } = card;
  const ig = e.ig?.latest;
  const yt = e.yt;
  const href = `${basePath}/episodes/${e.key}`;
  return (
    <Panel className="flex h-full flex-col gap-4 p-4 xl:p-5" aria-labelledby="latest-title">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-md bg-rano px-1.5 py-0.5 font-bold text-primary-foreground">최신 편</span>
        {e.status === "draft" ? (
          <span className="rounded-md bg-amber/15 px-1.5 py-0.5 font-semibold text-amber">
            초안{e.autoPaired ? " · 자동 짝" : ""}
          </span>
        ) : (
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-semibold">{e.epNo}편</span>
        )}
        <span className="ml-auto text-muted-foreground tabular-nums">게시 후 {formatAge(e.ageHours)}</span>
      </div>

      <div>
        <h2 id="latest-title" className="text-lg font-bold leading-snug">
          {e.title}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{[e.series, e.topic].filter(Boolean).join(" · ") || "계열 미입력"}</p>
      </div>

      <div className="flex min-h-[88px] flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><PlatformTag platform="ig" />조회</span>
          <span className="text-[34px] font-bold leading-none tracking-tight tabular-nums">{formatCount(ig?.views)}</span>
          {igViewsDelta ? (
            <span className="text-sm font-semibold text-rano tabular-nums">
              {formatSignedCount(igViewsDelta.abs)} <span className="font-normal text-muted-foreground">/ {formatDuration(igViewsDelta.windowMinutes)}</span>
            </span>
          ) : null}
        </div>
        {card.sparkline.length >= 2 ? (
          <Sparkline points={card.sparkline} label={`게시 후 조회수 흐름, 현재 ${formatCountFull(ig?.views)}회`} />
        ) : (
          <p className="grid min-h-14 flex-1 place-items-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            수집이 두 번 이상 쌓이면 게시 후 흐름이 그려진다
          </p>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-3">
        <Stat label="건너뛰기">
          {formatPct(ig?.skipRate)}
          {skipDelta && Math.abs(skipDelta.abs) >= 0.05 ? (
            <span className="block text-[11px] font-normal text-muted-foreground">
              {formatDuration(skipDelta.windowMinutes)} 전 {formatPct(skipDelta.from)}
            </span>
          ) : null}
        </Stat>
        <Stat label="저장률">{formatRate(e.gates.saveRate)}</Stat>
        <Stat label="공유율">{formatRate(e.gates.shareRate)}</Stat>
      </dl>

      <GateBadges hook={e.gates.hook} spread={e.gates.spread} />

      {card.benchmarks.length ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          같은 {formatAge(e.ageHours)} 시점:{" "}
          {card.benchmarks.map((b, i) => (
            <span key={b.key}>
              {i ? " · " : ""}
              <span className="text-foreground">{b.epNo}편</span> {b.viewsAtAge === null ? "기록 없음" : formatCount(b.viewsAtAge)}
            </span>
          ))}
        </p>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3 text-xs tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <PlatformTag platform="yt" />
          <span className="font-semibold">{formatCountFull(yt?.latest?.views)}</span>
          {ytViewsDelta ? <span className="text-rano">{formatSignedCount(ytViewsDelta.abs)}</span> : null}
        </span>
        <span className="text-muted-foreground">{yt?.analytics ? "Analytics 반영됨" : "Analytics 집계 대기(24~48시간)"}</span>
        <Link href={href} className="ml-auto inline-flex items-center gap-1 font-semibold text-sky hover:underline">
          상세 보기 <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </Panel>
  );
}
