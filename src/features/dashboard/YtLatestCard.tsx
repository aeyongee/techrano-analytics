import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { GateBadges } from "@/components/GateBadge";
import { Panel } from "@/components/Panel";
import { PlatformTag } from "@/components/PlatformTag";
import type { YtLatestCard as Card } from "@/lib/data/builders";
import { formatAge, formatCount, formatCountFull, formatDuration, formatKst, formatPct, formatSignedCount } from "@/lib/domain/format";
import { Sparkline } from "./Sparkline";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

/** 유튜브 탭의 최신 편. 조회·좋아요·댓글은 바로, 시청 지표는 Analytics가 들어온 뒤에 채워진다. */
export function YtLatestCard({ card, basePath }: { card: Card; basePath: string }) {
  const { episode: e, viewsDelta } = card;
  const yt = e.yt!;
  const latest = yt.latest;
  const a = yt.analytics;
  const href = `${basePath}/episodes/${e.key}`;
  return (
    <Panel className="flex h-full flex-col gap-4 p-4 xl:p-5" aria-labelledby="yt-latest-title">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-md bg-rano px-1.5 py-0.5 font-bold text-primary-foreground">최신 편</span>
        {e.status === "draft" ? (
          <span className="rounded-md bg-amber/15 px-1.5 py-0.5 font-semibold text-amber">초안{e.autoPaired ? " · 자동 짝" : ""}</span>
        ) : (
          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-semibold">{e.epNo}편</span>
        )}
        <span className="ml-auto text-muted-foreground tabular-nums">게시 후 {formatAge(e.ageHours)}</span>
      </div>

      <div>
        <h2 id="yt-latest-title" className="text-lg font-bold leading-snug">
          {e.title}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{[e.series, e.topic].filter(Boolean).join(" · ") || "계열 미입력"}</p>
      </div>

      <div className="flex min-h-[88px] flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><PlatformTag platform="yt" />조회</span>
          <span className="text-[34px] font-bold leading-none tracking-tight tabular-nums">{formatCount(latest?.views)}</span>
          {viewsDelta ? (
            <span className="text-sm font-semibold text-rano tabular-nums">
              {formatSignedCount(viewsDelta.abs)} <span className="font-normal text-muted-foreground">/ {formatDuration(viewsDelta.windowMinutes)}</span>
            </span>
          ) : null}
        </div>
        {card.sparkline.length >= 2 && card.sparkline[card.sparkline.length - 1].h - card.sparkline[0].h >= 1 ? (
          <Sparkline points={card.sparkline} label={`게시 후 유튜브 조회수 흐름, 현재 ${formatCountFull(latest?.views)}회`} />
        ) : (
          <p className="grid min-h-14 flex-1 place-items-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
            수집이 한 시간 넘게 쌓이면 조회 흐름이 그려진다
          </p>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-3">
        <Stat label="유효 조회 비율">{formatPct(e.ytGates.engagedRatio)}</Stat>
        <Stat label="평균 시청률">{formatPct(e.ytGates.avgViewPct)}</Stat>
        <Stat label="이 편으로 구독">{a?.subscribersGained === null || a?.subscribersGained === undefined ? "—" : formatSignedCount(a.subscribersGained)}</Stat>
      </dl>

      <GateBadges hook={e.ytGates.hook} spread={e.ytGates.finish} labels={["1차 초반", "2차 끝까지"]} />

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
        <span className="text-muted-foreground">
          {a ? `Analytics ${formatKst(a.capturedAt)} 기준` : "유효 조회·평균 시청은 집계 대기(24~48시간)"}
        </span>
        <Link href={href} className="ml-auto inline-flex items-center gap-1 font-semibold text-sky hover:underline">
          상세 보기 <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </Panel>
  );
}
