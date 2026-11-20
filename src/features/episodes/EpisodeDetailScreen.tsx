import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { Cover } from "@/components/Cover";
import { GateBadge } from "@/components/GateBadge";
import { Panel, PanelHeader } from "@/components/Panel";
import { PlatformTag } from "@/components/PlatformTag";
import type { EpisodeDetailData } from "@/lib/data/screens";
import { GATES, QUADRANT_LABEL } from "@/lib/domain/constants";
import { formatAge, formatCount, formatCountFull, formatKst, formatPct, formatRate } from "@/lib/domain/format";
import { avgWatchPct, engagedRatio, rewatchRatio } from "@/lib/domain/metrics";
import { DraftPanel } from "./DraftPanel";
import { RetroPanel } from "./RetroPanel";
import { TrendCharts } from "./TrendCharts";

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-2/60 px-3 py-2.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-lg font-bold tabular-nums", tone === "good" && "text-rano", tone === "bad" && "text-danger")}>{value}</dd>
      {sub ? <dd className="text-[11px] text-muted-foreground tabular-nums">{sub}</dd> : null}
    </div>
  );
}

const DEFINITIONS = [
  ["건너뛰기 비율", "릴스를 본 횟수 중 첫 3초 안에 넘긴 비율(게시 후 누적). 낮을수록 좋다. 1차 관문 기준 45% 이하."],
  ["저장률·공유율", "저장(공유) 수 ÷ 도달 계정 수. 2차 관문 기준 저장 1.0% 이상이면서 공유 0.5% 이상."],
  ["조회/도달", "한 계정이 평균 몇 번 봤는지. 1보다 크면 다시 보기가 있다."],
  ["판정 대기", "도달이 적으면 비율이 크게 흔들려 판정하지 않는다(1차는 도달 200 미만, 2차는 500 미만)."],
  ["유튜브 조회수", "YouTube Data API의 실시간 조회수. 2025년 3월부터 Shorts 조회수는 재생과 반복 재생을 모두 센다."],
  ["참여 조회율", "Analytics 참여 조회수 ÷ 같은 집계의 조회수. YouTube Studio의 '계속 시청함/이탈함'과는 다른 지표다(그 값은 공개 API가 주지 않는다). 게시 후 24~48시간 늦게 나온다."],
] as const;

export function EpisodeDetailScreen({ data, basePath }: { data: EpisodeDetailData; basePath: string }) {
  const { episode: e } = data;
  const ig = e.ig?.latest;
  const yt = e.yt;
  const a = yt?.analytics ?? null;
  const g = e.gates;
  const live = data.mode === "live";
  const watchPct = avgWatchPct(ig?.avgWatchMs ?? null, e.lengthSec);

  return (
    <div className="flex flex-col gap-4 xl:gap-5">
      <div>
        <Link href={`${basePath}/episodes`} className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden />편 목록
        </Link>
        <div className="mt-3 flex gap-4">
        <Cover src={e.coverUrl} alt={e.title} size="lg" className="xl:w-[120px]" />
        <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-surface-2 px-2 py-0.5 text-sm font-bold tabular-nums">{e.epNo !== null ? `${e.epNo}편` : "초안"}</span>
          {e.isBenchmark ? <span className="rounded-full bg-sky/12 px-2 py-0.5 text-xs font-semibold text-sky">기준편</span> : null}
          {e.series ? <span className="text-xs text-muted-foreground">{[e.series, e.topic].filter(Boolean).join(" · ")}</span> : null}
        </div>
        <h1 className="mt-1.5 text-xl font-bold leading-snug xl:text-2xl">{e.title}</h1>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
          {e.ig ? (
            <span className="inline-flex items-center gap-1">
              <PlatformTag platform="ig" /> {formatKst(e.ig.postedAt)}
            </span>
          ) : null}
          {yt ? (
            <span className="inline-flex items-center gap-1">
              <PlatformTag platform="yt" />
              {yt.publishedAt ? formatKst(yt.publishedAt) : yt.scheduledAt ? `예약 ${formatKst(yt.scheduledAt)}` : "비공개"}
            </span>
          ) : null}
          {e.postedAt ? <span>게시 후 {formatAge(e.ageHours)}</span> : null}
          {live && e.ig?.permalink ? (
            <a href={e.ig.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-sky hover:underline">
              릴스 <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : null}
          {live && yt?.videoId ? (
            <a href={`https://youtube.com/shorts/${yt.videoId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-sky hover:underline">
              쇼츠 <ExternalLink className="size-3" aria-hidden />
            </a>
          ) : null}
        </p>
        </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12 xl:gap-5">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-8 xl:gap-5">
          <DraftPanel episode={e} nextEpNo={data.nextEpNo} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Panel className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold">1차 관문 · 3초 훅</h2>
                <GateBadge label="1차" verdict={g.hook} />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums">{formatPct(ig?.skipRate)}</p>
              <p className="text-xs text-muted-foreground">건너뛰기 · 기준 {GATES.hook.maxSkipRate}% 이하</p>
            </Panel>
            <Panel className="p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold">2차 관문 · 확산</h2>
                <GateBadge label="2차" verdict={g.spread} />
              </div>
              <p className="mt-2 flex gap-4 text-2xl font-bold tabular-nums">
                <span className={cn(g.save === "pass" && "text-rano", g.save === "fail" && "text-danger")}>{formatRate(g.saveRate)}</span>
                <span className={cn(g.share === "pass" && "text-rano", g.share === "fail" && "text-danger")}>{formatRate(g.shareRate)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                저장 {GATES.spread.minSaveRate}% · 공유 {GATES.spread.minShareRate}% 이상
                {g.quadrant ? ` · 사분면: ${QUADRANT_LABEL[g.quadrant]}${g.strictMismatch ? " △" : ""}` : ""}
              </p>
            </Panel>
          </div>

          <Panel>
            <PanelHeader title={<span className="inline-flex items-center gap-2"><PlatformTag platform="ig" />인스타 릴스</span>} hint={ig ? `${formatKst(ig.capturedAt)} 수집` : "아직 수집 전"} />
            <dl className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 xl:grid-cols-4 xl:p-5">
              <Metric label="조회" value={formatCountFull(ig?.views)} />
              <Metric label="도달" value={formatCountFull(ig?.reach)} />
              <Metric label="조회/도달" value={(() => { const r = rewatchRatio(ig?.views ?? null, ig?.reach ?? null); return r === null ? "—" : r.toFixed(2); })()} />
              <Metric label="건너뛰기" value={formatPct(ig?.skipRate)} tone={g.hook === "pass" ? "good" : g.hook === "fail" ? "bad" : undefined} />
              <Metric
                label="평균 시청"
                value={ig?.avgWatchMs ? `${(ig.avgWatchMs / 1000).toFixed(1)}초` : "—"}
                sub={watchPct !== null ? `길이의 ${watchPct.toFixed(0)}%` : undefined}
              />
              <Metric label="저장" value={formatCountFull(ig?.saved)} sub={formatRate(g.saveRate)} />
              <Metric label="공유" value={formatCountFull(ig?.shares)} sub={formatRate(g.shareRate)} />
              <Metric label="좋아요 · 댓글" value={`${formatCount(ig?.likes)} · ${formatCount(ig?.comments)}`} />
            </dl>
          </Panel>

          <Panel>
            <PanelHeader
              title={<span className="inline-flex items-center gap-2"><PlatformTag platform="yt" />유튜브 쇼츠</span>}
              hint={a ? `Analytics 기준 ${formatKst(a.capturedAt)} 수집` : yt?.privacy === "private" ? "예약 공개 전이라 수집하지 않는다" : "Analytics 집계 대기(게시 후 24~48시간)"}
            />
            <dl className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 xl:grid-cols-4 xl:p-5">
              <Metric label="조회(실시간)" value={formatCountFull(yt?.latest?.views)} />
              <Metric label="좋아요 · 댓글" value={`${formatCount(yt?.latest?.likes)} · ${formatCount(yt?.latest?.comments)}`} />
              <Metric label="참여 조회율" value={formatPct(engagedRatio(a))} sub={a ? `참여 조회 ${formatCount(a.engagedViews)}` : "집계 대기"} />
              <Metric label="평균 시청" value={a?.avgViewDurationSec != null ? `${a.avgViewDurationSec}초` : "—"} sub={a?.avgViewPct != null ? `길이의 ${a.avgViewPct.toFixed(0)}%` : undefined} />
              <Metric label="공유" value={formatCountFull(a?.shares)} />
              <Metric label="구독 증가" value={formatCountFull(a?.subscribersGained)} />
            </dl>
          </Panel>

          <TrendCharts ig={data.ig} yt={data.yt} live={(e.ageHours ?? 999) < 168} />

          <details className="rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-block xl:px-5">
            <summary className="cursor-pointer font-semibold">지표 정의</summary>
            <dl className="mt-3 flex flex-col gap-2.5">
              {DEFINITIONS.map(([term, desc]) => (
                <div key={term}>
                  <dt className="text-xs font-semibold">{term}</dt>
                  <dd className="text-xs leading-relaxed text-muted-foreground">{desc}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>

        <div className="xl:col-span-4">
          <div className="xl:sticky xl:top-8">
            <RetroPanel episode={e} />
          </div>
        </div>
      </div>
    </div>
  );
}
