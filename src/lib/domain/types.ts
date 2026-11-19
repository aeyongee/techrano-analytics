// 화면이 쓰는 도메인 타입. 실데이터(Supabase)와 데모가 같은 모양을 만든다.

export type Platform = "ig" | "yt";
export type EpisodeStatus = "draft" | "published" | "archived";
export type Verdict = "pass" | "fail" | "pending";
/** 터짐 · 훅 부족 · 저장동기 부족 · 전면개선 */
export type Quadrant = "breakout" | "hookWeak" | "saveWeak" | "rework";

export interface IgMetrics {
  views: number | null;
  reach: number | null;
  saved: number | null;
  shares: number | null;
  comments: number | null;
  likes: number | null;
  avgWatchMs: number | null;
  skipRate: number | null;
}

export interface YtDataMetrics {
  views: number | null;
  likes: number | null;
  comments: number | null;
}

export interface YtAnalyticsMetrics {
  views: number;
  engagedViews: number | null;
  avgViewDurationSec: number | null;
  avgViewPct: number | null;
  shares: number | null;
  subscribersGained: number | null;
}

export interface IgPoint extends IgMetrics {
  capturedAt: string;
  /** 게시 후 경과 시간 */
  hours: number;
  source: "api" | "import";
}

export interface YtPoint extends YtDataMetrics {
  capturedAt: string;
  hours: number;
  analytics: YtAnalyticsMetrics | null;
}

/** v_episode_overview 한 행. key = epNo가 있으면 "5", 초안이면 "d-12" */
export interface EpisodeRaw {
  id: number;
  key: string;
  epNo: number | null;
  slug: string | null;
  title: string;
  status: EpisodeStatus;
  series: string | null;
  topic: string | null;
  isTrueStory: boolean;
  lengthSec: number | null;
  hookDesc: string | null;
  hypothesis: string | null;
  retro72h: string | null;
  notes: string | null;
  isBenchmark: boolean;
  autoPaired: boolean;
  postedAt: string | null;
  updatedAt: string;
  ig: {
    mediaId: string;
    shortcode: string;
    permalink: string;
    postedAt: string;
    tracked: boolean;
    latest: IgPoint | null;
  } | null;
  yt: {
    videoId: string;
    title: string;
    privacy: "public" | "unlisted" | "private";
    publishedAt: string | null;
    scheduledAt: string | null;
    durationSec: number | null;
    tracked: boolean;
    latest: YtPoint | null;
    analytics: (YtAnalyticsMetrics & { capturedAt: string }) | null;
  } | null;
}

export interface ChannelTotals {
  igViews: number;
  igReach: number;
  igSaved: number;
  igShares: number;
  ytViews: number;
}

export interface SyncErrorRow {
  platform: string;
  stage: string;
  target?: string;
  code: string;
  message: string;
}

export interface SyncRunRow {
  id: number;
  trigger: "cron" | "manual" | "cli";
  status: "running" | "success" | "partial" | "failed" | "abandoned";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  igStatus: string | null;
  ytStatus: string | null;
  ytAnalyticsStatus: string | null;
  igCaptured: number;
  ytCaptured: number;
  newMedia: number;
  errors: SyncErrorRow[];
  note: string | null;
}

export interface UntrackedItem {
  platform: Platform;
  id: string;
  label: string;
  postedAt: string | null;
}

export const episodeKey = (e: { id: number; epNo: number | null }) => (e.epNo !== null ? String(e.epNo) : `d-${e.id}`);
