import { dataIntervalMinutes } from "@/lib/domain/schedule";
import type { EpisodeRaw, IgPoint, SyncRunRow, UntrackedItem, YtPoint } from "@/lib/domain/types";
import { between, hashString, mulberry32 } from "./prng";
import { DEMO_EPISODES, DEMO_SCHEDULED, type Archetype, type DemoEpisodeSpec } from "./scenarios";

const H = 3_600_000;

export interface DemoWorld {
  anchor: Date;
  episodes: EpisodeRaw[];
  ig: Record<string, IgPoint[]>;
  yt: Record<string, YtPoint[]>;
  runs: SyncRunRow[];
  untracked: UntrackedItem[];
}

interface Params {
  skip: number;
  save: number;
  share: number;
  v1: number;
  tau1: number;
  v2: number;
  t0: number;
  s: number;
  tail: number;
  rewatch: number;
  watchPct: number;
  lengthSec: number;
  ytFrac: number;
  ytBase: number;
  engaged: number;
  ytWatchPct: number;
}

const RANGES: Record<Archetype, { skip: [number, number]; save: [number, number]; share: [number, number]; v2: [number, number]; watch: [number, number] }> = {
  breakout: { skip: [36, 42], save: [1.1, 2.3], share: [0.55, 1.9], v2: [25_000, 120_000], watch: [0.5, 0.6] },
  saveWeak: { skip: [38, 44.5], save: [0.2, 0.7], share: [0.05, 0.3], v2: [600, 1500], watch: [0.38, 0.48] },
  hookWeak: { skip: [50, 58], save: [1.0, 1.6], share: [0.5, 0.9], v2: [3000, 6000], watch: [0.45, 0.55] },
  rework: { skip: [54, 60], save: [0.1, 0.5], share: [0, 0.2], v2: [0, 300], watch: [0.25, 0.35] },
};

function paramsFor(spec: DemoEpisodeSpec, rnd: () => number): Params {
  const r = RANGES[spec.archetype];
  const breakout = spec.archetype === "breakout";
  return {
    skip: spec.rates?.skip ?? between(rnd, ...r.skip),
    save: spec.rates?.save ?? between(rnd, ...r.save),
    share: spec.rates?.share ?? between(rnd, ...r.share),
    v1: between(rnd, 1500, 3000),
    tau1: between(rnd, 0.8, 1.5),
    v2: spec.spread?.v2 ?? between(rnd, ...r.v2),
    t0: spec.spread?.t0 ?? (breakout ? between(rnd, 10, 30) : between(rnd, 15, 40)),
    s: spec.spread?.s ?? (breakout ? between(rnd, 4, 8) : between(rnd, 6, 12)),
    tail: between(rnd, 2, 8),
    rewatch: breakout ? between(rnd, 1.38, 1.55) : between(rnd, 1.22, 1.4),
    watchPct: between(rnd, ...r.watch),
    lengthSec: Math.round(between(rnd, 25, 40) * 10) / 10,
    ytFrac: between(rnd, 0.008, 0.025),
    ytBase: between(rnd, 600, 1500),
    engaged: between(rnd, 0.22, 0.45),
    ytWatchPct: between(rnd, 0.5, 0.8),
  };
}

const logistic = (t: number, v: number, t0: number, s: number) => v / (1 + Math.exp(-(t - t0) / s)) - v / (1 + Math.exp(t0 / s));

function igViews(p: Params, t: number) {
  return p.v1 * (1 - Math.exp(-t / p.tau1)) + logistic(t, p.v2, p.t0, p.s) + p.tail * t;
}

const ytViews = (p: Params, t: number) => p.ytFrac * igViews(p, t) + p.ytBase * (1 - Math.exp(-t / 24));

/** 실서비스 수집 간격(schedule.ts)에 ±4분 흔들림을 준 스냅샷 시각 */
function snapshotHours(ageH: number, rnd: () => number): number[] {
  const out: number[] = [];
  let t = 0.15 + rnd() * 0.1;
  while (t <= ageH) {
    out.push(t);
    t += dataIntervalMinutes(t) / 60 + ((rnd() - 0.5) * 8) / 60;
  }
  return out;
}

const iso = (ms: number) => new Date(ms).toISOString();

function buildEpisode(spec: DemoEpisodeSpec, anchor: number) {
  const rnd = mulberry32(hashString(`techrano-demo:${spec.id}`));
  const p = paramsFor(spec, rnd);
  const igPosted = anchor - spec.ageHours * H;
  const ytOffsetH = (rnd() - 0.5) * 0.6;
  const ytPosted = igPosted + ytOffsetH * H;

  const ig: IgPoint[] = [];
  let saved = 0;
  let shares = 0;
  for (const t of snapshotHours(spec.ageHours, rnd)) {
    const views = Math.round(igViews(p, t));
    const reach = Math.round(views / p.rewatch);
    // 저장·공유 비율은 첫 몇 시간 동안 조금씩 오른다
    const ramp = 1 - 0.3 * Math.exp(-t / 8);
    saved = Math.max(saved, Math.round(reach * (p.save / 100) * ramp));
    shares = Math.max(shares, Math.round(reach * (p.share / 100) * ramp));
    ig.push({
      capturedAt: iso(igPosted + t * H),
      hours: t,
      source: "api",
      views,
      reach,
      saved,
      shares,
      comments: Math.round(reach * 0.0002),
      likes: Math.round(reach * 0.013),
      avgWatchMs: Math.round(p.lengthSec * 1000 * (p.watchPct + (rnd() - 0.5) * 0.02)),
      skipRate: Math.round((p.skip + 6 * Math.exp(-t / 3) + (rnd() - 0.5) * 0.7) * 10) / 10,
    });
  }

  const yt: YtPoint[] = [];
  const ytAge = spec.ageHours - ytOffsetH;
  for (const t of snapshotHours(ytAge, rnd)) {
    const views = Math.round(ytViews(p, t));
    const lagged = t >= 30 ? Math.round(ytViews(p, t - 26)) : null; // Analytics는 하루 넘게 늦게 나온다
    yt.push({
      capturedAt: iso(ytPosted + t * H),
      hours: t,
      views,
      likes: Math.round(views * 0.007),
      comments: Math.round(views * 0.0008),
      analytics:
        lagged === null
          ? null
          : {
              views: lagged,
              engagedViews: Math.round(lagged * p.engaged),
              avgViewDurationSec: Math.round(p.lengthSec * p.ytWatchPct),
              avgViewPct: Math.round(p.ytWatchPct * 1000) / 10,
              shares: Math.round(lagged * 0.0015),
              subscribersGained: Math.round(lagged * 0.002),
            },
    });
  }

  const videoId = `demoVideo${String(spec.id).padStart(2, "0")}`;
  const lastAnalytics = [...yt].reverse().find((x) => x.analytics);
  const episode: EpisodeRaw = {
    id: spec.id,
    key: spec.epNo !== null ? String(spec.epNo) : `d-${spec.id}`,
    epNo: spec.epNo,
    slug: null,
    title: spec.title,
    status: spec.status,
    series: spec.series,
    topic: spec.topic ?? null,
    isTrueStory: false,
    lengthSec: p.lengthSec,
    hookDesc: spec.hookDesc ?? null,
    hypothesis: spec.hypothesis ?? null,
    retro72h: spec.retro72h ?? null,
    notes: null,
    isBenchmark: spec.isBenchmark ?? false,
    autoPaired: spec.autoPaired ?? false,
    postedAt: iso(Math.min(igPosted, ytPosted)),
    updatedAt: iso(anchor - 2 * H),
    ig: {
      mediaId: `demo-ig-${spec.id}`,
      shortcode: `DEMO${spec.id}`,
      permalink: "",
      postedAt: iso(igPosted),
      tracked: true,
      latest: ig.at(-1) ?? null,
    },
    yt: {
      videoId,
      title: `${spec.title} #shorts`,
      privacy: "public",
      publishedAt: iso(ytPosted),
      scheduledAt: null,
      durationSec: Math.round(p.lengthSec),
      tracked: true,
      latest: yt.at(-1) ?? null,
      analytics: lastAnalytics?.analytics ? { ...lastAnalytics.analytics, capturedAt: lastAnalytics.capturedAt } : null,
    },
  };
  return { episode, ig, yt, mediaId: episode.ig!.mediaId, videoId };
}

function buildRuns(anchor: number): SyncRunRow[] {
  const rnd = mulberry32(hashString("techrano-demo:runs"));
  return Array.from({ length: 24 }, (_, k): SyncRunRow => {
    const started = anchor - (k * 15 + 8) * 60_000;
    const duration = Math.round(between(rnd, 3200, 7800));
    const base: SyncRunRow = {
      id: 5000 - k,
      trigger: k === 6 ? "manual" : "cron",
      status: "success",
      startedAt: iso(started),
      finishedAt: iso(started + duration),
      durationMs: duration,
      igStatus: "ok",
      ytStatus: "ok",
      ytAnalyticsStatus: k % 12 === 4 ? "ok" : "not_due",
      igCaptured: 1 + Math.floor(rnd() * 3),
      ytCaptured: Math.floor(rnd() * 3),
      newMedia: 0,
      errors: [],
      note: null,
    };
    if (k === 3) {
      return {
        ...base,
        status: "partial",
        ytAnalyticsStatus: "error",
        errors: [{ platform: "yt_analytics", stage: "analytics", code: "quotaExceeded", message: "403: The request cannot be completed because you have exceeded your quota." }],
      };
    }
    if (k === 11) {
      return {
        ...base,
        status: "failed",
        igStatus: "error",
        ytStatus: "error",
        ytAnalyticsStatus: "skipped",
        igCaptured: 0,
        ytCaptured: 0,
        errors: [
          { platform: "ig", stage: "discover", code: "NETWORK", message: "network: The operation was aborted due to timeout" },
          { platform: "yt", stage: "auth", code: "503", message: "503: The service is currently unavailable." },
        ],
      };
    }
    if (k === 6) return { ...base, igCaptured: 11, ytCaptured: 11, ytAnalyticsStatus: "ok" };
    return base;
  });
}

/** 기준 시각(1시간 단위로 내림) 하나로 데모 세계 전체를 만든다. 같은 기준 시각이면 결과가 같다. */
export function generateDemoWorld(anchor: Date): DemoWorld {
  const a = anchor.getTime();
  const built = DEMO_EPISODES.map((s) => buildEpisode(s, a));
  const scheduled: EpisodeRaw = {
    id: DEMO_SCHEDULED.id,
    key: `d-${DEMO_SCHEDULED.id}`,
    epNo: null,
    slug: null,
    title: DEMO_SCHEDULED.title,
    status: "draft",
    series: null,
    topic: null,
    isTrueStory: false,
    lengthSec: null,
    hookDesc: null,
    hypothesis: null,
    retro72h: null,
    notes: null,
    isBenchmark: false,
    autoPaired: false,
    postedAt: null,
    updatedAt: iso(a - 3 * H),
    ig: null,
    yt: {
      videoId: "demoVideo13",
      title: `${DEMO_SCHEDULED.title} #shorts`,
      privacy: "private",
      publishedAt: null,
      scheduledAt: iso(a + DEMO_SCHEDULED.scheduledInHours * H),
      durationSec: 31,
      tracked: true,
      latest: null,
      analytics: null,
    },
  };
  return {
    anchor,
    episodes: [...built.map((b) => b.episode), scheduled],
    ig: Object.fromEntries(built.map((b) => [b.mediaId, b.ig])),
    yt: Object.fromEntries(built.map((b) => [b.videoId, b.yt])),
    runs: buildRuns(a),
    untracked: [{ platform: "ig", id: "demo-ig-archived", label: "보관한 테스트 릴스", postedAt: iso(a - 300 * H) }],
  };
}
