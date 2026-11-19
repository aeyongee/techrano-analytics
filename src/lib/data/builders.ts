import { GATES } from "@/lib/domain/constants";
import { deltaNear, type Delta } from "@/lib/domain/delta";
import { evaluateGates, type GateResult } from "@/lib/domain/gates";
import { median } from "@/lib/domain/metrics";
import { valueAt } from "@/lib/domain/resample";
import type { ChannelTotals, EpisodeRaw, IgPoint, Quadrant, SyncRunRow, YtPoint } from "@/lib/domain/types";
import type { Repository } from "./repository";

// ── 공통 ────────────────────────────────────────────────────────────

export interface EpisodeView extends EpisodeRaw {
  ageHours: number | null;
  gates: GateResult;
}

const EMPTY_IG = { views: null, reach: null, saved: null, shares: null, comments: null, likes: null, avgWatchMs: null, skipRate: null };

export function toView(e: EpisodeRaw, now: Date): EpisodeView {
  return {
    ...e,
    ageHours: e.postedAt ? (now.getTime() - Date.parse(e.postedAt)) / 3_600_000 : null,
    gates: evaluateGates(e.ig?.latest ?? EMPTY_IG),
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

export interface KpiValue {
  value: number | null;
  /** 7일 증가(개수 지표) 또는 직전 5편 값(비율 지표) */
  compare: number | null;
}

export interface LatestCard {
  episode: EpisodeView;
  igViewsDelta: Delta | null;
  skipDelta: Delta | null;
  ytViewsDelta: Delta | null;
  sparkline: { h: number; v: number }[];
  benchmarks: { key: string; epNo: number | null; title: string; viewsAtAge: number | null }[];
}

export interface QuadrantPoint {
  key: string;
  epNo: number | null;
  title: string;
  skipRate: number;
  saveShareRate: number;
  saveRate: number;
  shareRate: number;
  views: number;
  quadrant: Quadrant;
  strictMismatch: boolean;
  spread: GateResult["spread"];
  isLatest: boolean;
}

export interface DashboardData {
  mode: Repository["mode"];
  now: string;
  kpis: { igViews: KpiValue; ytViews: KpiValue; skipMedian: KpiValue; saveShareMedian: KpiValue };
  latest: LatestCard | null;
  quadrant: QuadrantPoint[];
  excluded: { key: string; epNo: number | null; reason: string }[];
  recent: EpisodeView[];
}

export function buildDashboard(input: {
  mode: Repository["mode"];
  episodes: EpisodeRaw[];
  igSeries: Record<string, IgPoint[]>;
  ytSeries: Record<string, YtPoint[]>;
  totalsNow: ChannelTotals;
  totalsWeekAgo: ChannelTotals;
  now: Date;
}): DashboardData {
  const eps = input.episodes.filter((e) => e.status !== "archived").map((e) => toView(e, input.now));
  const posted = eps.filter((e) => e.postedAt).sort(byPostedDesc);
  const latest = posted[0] ?? null;

  // 비율 KPI: 최근 5편과 그 앞 5편의 중앙값
  const withIg = posted.filter((e) => e.ig?.latest);
  const recent5 = withIg.slice(0, 5);
  const prev5 = withIg.slice(5, 10);
  const skip = (xs: EpisodeView[]) => median(xs.map((e) => e.ig!.latest!.skipRate));
  const ss = (xs: EpisodeView[]) => median(xs.map((e) => e.gates.saveShareRate));
  const hasWeekAgo = input.totalsWeekAgo.igViews > 0 || input.totalsWeekAgo.ytViews > 0;

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
      benchmarks: eps
        .filter((e) => e.isBenchmark && e.id !== latest.id && e.ig)
        .slice(0, 3)
        .map((b) => ({
          key: b.key,
          epNo: b.epNo,
          title: b.title,
          viewsAtAge: valueAt(
            (input.igSeries[b.ig!.mediaId] ?? []).map((p) => ({ hours: p.hours, value: p.views })),
            igAge,
            { maxGapHours: 6, anchorZero: true },
          ),
        })),
    };
  }

  const quadrant: QuadrantPoint[] = [];
  const excluded: DashboardData["excluded"] = [];
  for (const e of eps) {
    const m = e.ig?.latest;
    if (!m) continue;
    const g = e.gates;
    if (g.quadrant && m.skipRate !== null && g.saveShareRate !== null) {
      quadrant.push({
        key: e.key,
        epNo: e.epNo,
        title: e.title,
        skipRate: m.skipRate,
        saveShareRate: g.saveShareRate,
        saveRate: g.saveRate ?? 0,
        shareRate: g.shareRate ?? 0,
        views: m.views ?? 0,
        quadrant: g.quadrant,
        strictMismatch: g.strictMismatch,
        spread: g.spread,
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

  return {
    mode: input.mode,
    now: input.now.toISOString(),
    kpis: {
      igViews: { value: input.totalsNow.igViews, compare: hasWeekAgo ? input.totalsNow.igViews - input.totalsWeekAgo.igViews : null },
      ytViews: { value: input.totalsNow.ytViews, compare: hasWeekAgo ? input.totalsNow.ytViews - input.totalsWeekAgo.ytViews : null },
      skipMedian: { value: skip(recent5), compare: skip(prev5) },
      saveShareMedian: { value: ss(recent5), compare: ss(prev5) },
    },
    latest: latestCard,
    quadrant,
    excluded,
    recent: posted.slice(0, 5),
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
    repo.getYtSeries(latest?.yt ? [latest.yt.videoId] : [], maxHours),
    repo.getChannelTotals(now),
    repo.getChannelTotals(new Date(now.getTime() - 7 * 24 * 3_600_000)),
  ]);
  return buildDashboard({ mode: repo.mode, episodes, igSeries, ytSeries, totalsNow, totalsWeekAgo, now });
}

export async function loadShellStatus(repo: Repository): Promise<ShellStatus> {
  return buildShellStatus(await repo.listSyncRuns(10), repo.now());
}
