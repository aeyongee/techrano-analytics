import { GATES, YT_GATES } from "@/lib/domain/constants";
import { deltaNear, type Delta } from "@/lib/domain/delta";
import { diagnose, diagnoseYt, type Diagnosis } from "@/lib/domain/diagnose";
import { episodeLabel, formatCount, formatPct, formatRate, formatSignedCount } from "@/lib/domain/format";
import { evaluateGates, evaluateYtGates, type GateResult, type YtGateResult } from "@/lib/domain/gates";
import { median } from "@/lib/domain/metrics";
import { valueAt } from "@/lib/domain/resample";
import type { ChannelTotals, EpisodeRaw, IgPoint, Quadrant, SyncRunRow, Verdict, YtPoint } from "@/lib/domain/types";
import type { Repository } from "./repository";

// ── 공통 ────────────────────────────────────────────────────────────

export interface EpisodeView extends EpisodeRaw {
  ageHours: number | null;
  gates: GateResult;
  ytGates: YtGateResult;
}

const EMPTY_IG = { views: null, reach: null, saved: null, shares: null, comments: null, likes: null, avgWatchMs: null, skipRate: null };

export function toView(e: EpisodeRaw, now: Date): EpisodeView {
  return {
    ...e,
    ageHours: e.postedAt ? (now.getTime() - Date.parse(e.postedAt)) / 3_600_000 : null,
    gates: evaluateGates(e.ig?.latest ?? EMPTY_IG),
    ytGates: evaluateYtGates(e.yt?.analytics ?? null),
  };
}

const byPostedDesc = (a: EpisodeView, b: EpisodeView) => Date.parse(b.postedAt ?? "0") - Date.parse(a.postedAt ?? "0");

export interface ShellStatus {
  now: string;
  lastSuccessAt: string | null;
  lastStatus: SyncRunRow["status"] | null;
}

export function buildShellStatus(runs: SyncRunRow[], now: Date): ShellStatus {
  const ok = runs.find((r) => r.status === "success" || r.status === "partial");
  return { now: now.toISOString(), lastSuccessAt: ok?.finishedAt ?? ok?.startedAt ?? null, lastStatus: runs[0]?.status ?? null };
}

// ── 홈 ─────────────────────────────────────────────────────────────
// 인스타와 유튜브는 알고리즘이 달라 탭을 나눠 따로 판정한다.

export interface KpiValue {
  value: number | null;
  /** 7일 증가(개수 지표) 또는 직전 5편 값(비율 지표) */
  compare: number | null;
}

type Benchmark = { key: string; epNo: number | null; title: string; viewsAtAge: number | null };

export interface LatestCard {
  episode: EpisodeView;
  igViewsDelta: Delta | null;
  skipDelta: Delta | null;
  ytViewsDelta: Delta | null;
  sparkline: { h: number; v: number }[];
  benchmarks: Benchmark[];
}

export interface YtLatestCard {
  episode: EpisodeView;
  viewsDelta: Delta | null;
  sparkline: { h: number; v: number }[];
  benchmarks: Benchmark[];
}

/** 관문 지도의 점. x·y 뜻은 플랫폼마다 다르다(인스타: 건너뛰기·저장+공유, 유튜브: 유효 조회 비율·평균 시청률). */
export interface QuadrantPoint {
  key: string;
  epNo: number | null;
  title: string;
  x: number;
  y: number;
  views: number;
  coverUrl: string | null;
  quadrant: Quadrant;
  /** 2차 관문 판정(인스타 확산, 유튜브 끝까지) */
  second: Verdict;
  /** 위쪽에 있지만 2차 관문 미달(인스타 △) */
  strictMismatch: boolean;
  facts: { label: string; value: string }[];
  note: string | null;
  isLatest: boolean;
}

type Excluded = { key: string; epNo: number | null; reason: string };

export interface IgHome {
  kpis: { views: KpiValue; reach: KpiValue; skipMedian: KpiValue; saveShareMedian: KpiValue };
  latest: LatestCard | null;
  /** 홈 맨 위 "지금 상황" 문장(최신 편 기준) */
  diagnosis: Diagnosis | null;
  quadrant: QuadrantPoint[];
  excluded: Excluded[];
  recent: EpisodeView[];
}

export interface YtHome {
  kpis: { views: KpiValue; engagedMedian: KpiValue; avgViewPctMedian: KpiValue; subsRecent: KpiValue };
  latest: YtLatestCard | null;
  diagnosis: Diagnosis | null;
  quadrant: QuadrantPoint[];
  excluded: Excluded[];
  recent: EpisodeView[];
}

export interface DashboardData {
  mode: Repository["mode"];
  now: string;
  ig: IgHome;
  yt: YtHome;
}

const labelOf = (e: EpisodeView) => (episodeLabel(e) === "초안" ? "새 편" : `${e.epNo}편`);

function benchmarksAt(eps: EpisodeView[], latest: EpisodeView, age: number, seriesOf: (e: EpisodeView) => { hours: number; value: number | null }[] | null): Benchmark[] {
  return eps
    .filter((e) => e.isBenchmark && e.id !== latest.id)
    .flatMap((b) => {
      const series = seriesOf(b);
      return series ? [{ key: b.key, epNo: b.epNo, title: b.title, viewsAtAge: valueAt(series, age, { maxGapHours: 6, anchorZero: true }) }] : [];
    })
    .slice(0, 3);
}

function buildIgHome(eps: EpisodeView[], posted: EpisodeView[], input: DashboardInput, hasWeekAgo: boolean): IgHome {
  const latest = posted[0] ?? null;

  // 비율 KPI: 최근 5편과 그 앞 5편의 중앙값
  const withIg = posted.filter((e) => e.ig?.latest);
  const recent5 = withIg.slice(0, 5);
  const prev5 = withIg.slice(5, 10);
  const skip = (xs: EpisodeView[]) => median(xs.map((e) => e.ig!.latest!.skipRate));
  const ss = (xs: EpisodeView[]) => median(xs.map((e) => e.gates.saveShareRate));

  let latestCard: LatestCard | null = null;
  if (latest) {
    const ig = latest.ig ? input.igSeries[latest.ig.mediaId] ?? [] : [];
    const yt = latest.yt ? input.ytSeries[latest.yt.videoId] ?? [] : [];
    const igAge = ig.at(-1)?.hours ?? latest.ageHours ?? 0;
    latestCard = {
      episode: latest,
      igViewsDelta: deltaNear(ig.map((p) => ({ capturedAt: p.capturedAt, value: p.views }))),
      skipDelta: deltaNear(ig.map((p) => ({ capturedAt: p.capturedAt, value: p.skipRate }))),
      ytViewsDelta: deltaNear(yt.map((p) => ({ capturedAt: p.capturedAt, value: p.views }))),
      sparkline: ig.filter((p) => p.views !== null).map((p) => ({ h: p.hours, v: p.views! })),
      benchmarks: benchmarksAt(eps, latest, igAge, (b) =>
        b.ig ? (input.igSeries[b.ig.mediaId] ?? []).map((p) => ({ hours: p.hours, value: p.views })) : null,
      ),
    };
  }

  const quadrant: QuadrantPoint[] = [];
  const excluded: Excluded[] = [];
  for (const e of eps) {
    const m = e.ig?.latest;
    if (!m) continue;
    const g = e.gates;
    if (g.quadrant && m.skipRate !== null && g.saveShareRate !== null) {
      const saveRate = g.saveRate ?? 0;
      quadrant.push({
        key: e.key,
        epNo: e.epNo,
        title: e.title,
        x: m.skipRate,
        y: g.saveShareRate,
        views: m.views ?? 0,
        coverUrl: e.coverUrl,
        quadrant: g.quadrant,
        second: g.spread,
        strictMismatch: g.strictMismatch,
        facts: [
          { label: "건너뛰기", value: formatPct(m.skipRate) },
          { label: "저장", value: formatRate(g.saveRate) },
          { label: "공유", value: formatRate(g.shareRate) },
          { label: "조회", value: formatCount(m.views) },
        ],
        note: g.strictMismatch
          ? `△ 저장+공유 합은 선 위지만 ${saveRate < GATES.spread.minSaveRate ? "저장" : "공유"}이 기준에 못 미쳐 2차 관문은 미달이다.`
          : null,
        isLatest: e.id === latest?.id,
      });
    } else {
      const reason =
        m.skipRate === null
          ? "건너뛰기 값 없음"
          : (m.reach ?? 0) < GATES.minReachHook
            ? `도달 ${GATES.minReachHook} 미만`
            : `도달 ${GATES.minReachSpread} 미만(2차 판정 대기)`;
      excluded.push({ key: e.key, epNo: e.epNo, reason });
    }
  }

  const { totalsNow: now, totalsWeekAgo: ago } = input;
  return {
    kpis: {
      views: { value: now.igViews, compare: hasWeekAgo ? now.igViews - ago.igViews : null },
      reach: { value: now.igReach, compare: hasWeekAgo ? now.igReach - ago.igReach : null },
      skipMedian: { value: skip(recent5), compare: skip(prev5) },
      saveShareMedian: { value: ss(recent5), compare: ss(prev5) },
    },
    latest: latestCard,
    diagnosis: latestCard
      ? diagnose({
          label: labelOf(latestCard.episode),
          gates: latestCard.episode.gates,
          skipRate: latestCard.episode.ig?.latest?.skipRate ?? null,
          views: latestCard.episode.ig?.latest?.views ?? null,
          ageHours: latestCard.episode.ageHours,
          viewsDelta: latestCard.igViewsDelta,
          benchmarks: latestCard.benchmarks,
          retroMissing: !latestCard.episode.retro72h,
        })
      : null,
    quadrant,
    excluded,
    recent: posted.slice(0, 5),
  };
}

function buildYtHome(eps: EpisodeView[], posted: EpisodeView[], input: DashboardInput, hasWeekAgo: boolean): YtHome {
  const withYt = posted.filter((e) => e.yt);
  const latest = withYt[0] ?? null;

  // 비율 KPI: Analytics가 들어온 편 중 최근 5편과 그 앞 5편
  const withA = withYt.filter((e) => e.yt?.analytics);
  const recent5 = withA.slice(0, 5);
  const prev5 = withA.slice(5, 10);
  const engaged = (xs: EpisodeView[]) => median(xs.map((e) => e.ytGates.engagedRatio));
  const pct = (xs: EpisodeView[]) => median(xs.map((e) => e.ytGates.avgViewPct));
  const subs = (xs: EpisodeView[]) => (xs.length ? xs.reduce((n, e) => n + (e.yt!.analytics!.subscribersGained ?? 0), 0) : null);

  let latestCard: YtLatestCard | null = null;
  if (latest) {
    const yt = input.ytSeries[latest.yt!.videoId] ?? [];
    const age = yt.at(-1)?.hours ?? latest.ageHours ?? 0;
    latestCard = {
      episode: latest,
      viewsDelta: deltaNear(yt.map((p) => ({ capturedAt: p.capturedAt, value: p.views }))),
      sparkline: yt.filter((p) => p.views !== null).map((p) => ({ h: p.hours, v: p.views! })),
      benchmarks: benchmarksAt(eps, latest, age, (b) =>
        b.yt ? (input.ytSeries[b.yt.videoId] ?? []).map((p) => ({ hours: p.hours, value: p.views })) : null,
      ),
    };
  }

  const quadrant: QuadrantPoint[] = [];
  const excluded: Excluded[] = [];
  for (const e of eps) {
    if (!e.yt) continue;
    const g = e.ytGates;
    const a = e.yt.analytics;
    if (g.quadrant && g.engagedRatio !== null && g.avgViewPct !== null) {
      quadrant.push({
        key: e.key,
        epNo: e.epNo,
        title: e.title,
        x: g.engagedRatio,
        y: g.avgViewPct,
        views: e.yt.latest?.views ?? a?.views ?? 0,
        coverUrl: e.coverUrl,
        quadrant: g.quadrant,
        second: g.finish,
        strictMismatch: false,
        facts: [
          { label: "유효 조회", value: formatPct(g.engagedRatio) },
          { label: "평균 시청", value: formatPct(g.avgViewPct) },
          { label: "조회", value: formatCount(e.yt.latest?.views ?? a?.views) },
          { label: "구독", value: formatSignedCount(a?.subscribersGained ?? 0) },
        ],
        note: null,
        isLatest: e.id === latest?.id,
      });
    } else if (e.postedAt) {
      excluded.push({ key: e.key, epNo: e.epNo, reason: a ? `조회 ${YT_GATES.minViews} 미만` : "Analytics 집계 대기" });
    }
  }

  const { totalsNow: now, totalsWeekAgo: ago } = input;
  return {
    kpis: {
      views: { value: now.ytViews, compare: hasWeekAgo ? now.ytViews - ago.ytViews : null },
      engagedMedian: { value: engaged(recent5), compare: engaged(prev5) },
      avgViewPctMedian: { value: pct(recent5), compare: pct(prev5) },
      subsRecent: { value: subs(recent5), compare: subs(prev5) },
    },
    latest: latestCard,
    diagnosis: latestCard
      ? diagnoseYt({
          label: labelOf(latestCard.episode),
          gates: latestCard.episode.ytGates,
          hasAnalytics: !!latestCard.episode.yt?.analytics,
          views: latestCard.episode.yt?.latest?.views ?? null,
          ageHours: latestCard.episode.ageHours,
          viewsDelta: latestCard.viewsDelta,
          benchmarks: latestCard.benchmarks,
          retroMissing: !latestCard.episode.retro72h,
        })
      : null,
    quadrant,
    excluded,
    recent: withYt.slice(0, 5),
  };
}

interface DashboardInput {
  mode: Repository["mode"];
  episodes: EpisodeRaw[];
  igSeries: Record<string, IgPoint[]>;
  ytSeries: Record<string, YtPoint[]>;
  totalsNow: ChannelTotals;
  totalsWeekAgo: ChannelTotals;
  now: Date;
}

export function buildDashboard(input: DashboardInput): DashboardData {
  const eps = input.episodes.filter((e) => e.status !== "archived").map((e) => toView(e, input.now));
  const posted = eps.filter((e) => e.postedAt).sort(byPostedDesc);
  const hasWeekAgo = input.totalsWeekAgo.igViews > 0 || input.totalsWeekAgo.ytViews > 0;
  return {
    mode: input.mode,
    now: input.now.toISOString(),
    ig: buildIgHome(eps, posted, input, hasWeekAgo),
    yt: buildYtHome(eps, posted, input, hasWeekAgo),
  };
}

export async function loadDashboard(repo: Repository): Promise<DashboardData> {
  const now = repo.now();
  const episodes = await repo.listEpisodes();
  const views = episodes.map((e) => toView(e, now)).filter((e) => e.postedAt && e.status !== "archived").sort(byPostedDesc);
  const latest = views[0];
  const focus = [latest, ...views.filter((e) => e.isBenchmark && e.id !== latest?.id)].filter(Boolean);
  const maxHours = Math.max(72, Math.ceil(latest?.ageHours ?? 0) + 1);
  const [igSeries, ytSeries, totalsNow, totalsWeekAgo] = await Promise.all([
    repo.getIgSeries(focus.flatMap((e) => (e.ig ? [e.ig.mediaId] : [])), maxHours),
    repo.getYtSeries(focus.flatMap((e) => (e.yt ? [e.yt.videoId] : [])), maxHours),
    repo.getChannelTotals(now),
    repo.getChannelTotals(new Date(now.getTime() - 7 * 24 * 3_600_000)),
  ]);
  return buildDashboard({ mode: repo.mode, episodes, igSeries, ytSeries, totalsNow, totalsWeekAgo, now });
}

export async function loadShellStatus(repo: Repository): Promise<ShellStatus> {
  return buildShellStatus(await repo.listSyncRuns(10), repo.now());
}
