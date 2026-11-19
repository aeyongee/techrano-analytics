export type Trigger = "cron" | "manual" | "cli";
export type Platform = "ig" | "yt";
export type PlatformStatus = "ok" | "error" | "skipped";
export type AnalyticsStatus = "ok" | "error" | "skipped" | "not_due";
export type RunStatus = "success" | "partial" | "failed";

export interface RunSyncOptions {
  trigger: Trigger;
  /** 30일 이내 편은 간격과 상관없이 수집한다(Sync Now). */
  force?: boolean;
  /** 인스타 미디어 목록을 첫 페이지가 아니라 끝까지 훑는다. */
  discoverAll?: boolean;
  minGapSeconds?: number;
  /** 실행 전체 시간 예산. 기본 45초(Vercel maxDuration 60초 안). */
  budgetMs?: number;
}

export interface SyncError {
  platform: "ig" | "yt" | "yt_analytics" | "db";
  stage: "config" | "auth" | "discover" | "insights" | "videos" | "analytics" | "write" | "pair";
  target?: string;
  code: string;
  /** redact 후 300자 이하 */
  message: string;
}

export interface PlatformSummary {
  status: PlatformStatus;
  due: number;
  captured: number;
}

export interface SyncSummary {
  runId: number | null;
  status: RunStatus;
  durationMs: number;
  ig: PlatformSummary;
  yt: PlatformSummary & { analytics: AnalyticsStatus };
  newMedia: number;
  draftsCreated: number;
  autoPaired: number;
  apiCalls: Record<string, number>;
  errors: SyncError[];
  notes: string[];
}

// ── 수집기가 보는 DB 상태 ──────────────────────────────────────────────

export interface IgMediaState {
  mediaId: string;
  shortcode: string;
  permalink: string;
  captionHead: string | null;
  postedAt: Date;
  isTracked: boolean;
  unsupportedMetrics: string[];
  metricsProbedAt: Date | null;
  lastSnapshotAt: Date | null;
  consecutiveFailures: number;
}

export type YtPrivacy = "public" | "unlisted" | "private";

export interface YtVideoState {
  videoId: string;
  title: string;
  privacyStatus: YtPrivacy;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  durationSec: number | null;
  isTracked: boolean;
  lastSnapshotAt: Date | null;
  analyticsCheckedAt: Date | null;
  analyticsReadyAt: Date | null;
  consecutiveFailures: number;
}

export interface EpisodeKey {
  id: number;
  epNo: number | null;
  title: string;
  status: "draft" | "published" | "archived";
  igShortcode: string | null;
  ytVideoId: string | null;
}

export interface SyncState {
  ig: Map<string, IgMediaState>; // media_id → 상태
  yt: Map<string, YtVideoState>; // video_id → 상태
  episodes: EpisodeKey[];
}

export interface IgMetricsValues {
  views: number | null;
  reach: number | null;
  saved: number | null;
  shares: number | null;
  comments: number | null;
  likes: number | null;
  avgWatchMs: number | null;
  skipRate: number | null;
}

export interface IgSnapshotInput extends IgMetricsValues {
  mediaId: string;
  capturedAt: Date;
}

export interface YtAnalyticsValues {
  views: number;
  engagedViews: number | null;
  avgViewDurationSec: number | null;
  avgViewPct: number | null;
  shares: number | null;
  subscribersGained: number | null;
}

export interface YtSnapshotInput {
  videoId: string;
  capturedAt: Date;
  views: number | null;
  likes: number | null;
  comments: number | null;
  analytics: YtAnalyticsValues | null;
}

export interface RunFinish {
  status: RunStatus;
  durationMs: number;
  igStatus: PlatformStatus;
  ytStatus: PlatformStatus;
  ytAnalyticsStatus: AnalyticsStatus;
  igCaptured: number;
  ytCaptured: number;
  newMedia: number;
  apiCalls: Record<string, number>;
  errors: SyncError[];
  note: string | null;
}

export type IgMediaPatch = Partial<
  Pick<IgMediaState, "isTracked" | "unsupportedMetrics" | "metricsProbedAt" | "lastSnapshotAt" | "consecutiveFailures">
>;
export type YtVideoPatch = Partial<
  Pick<YtVideoState, "isTracked" | "lastSnapshotAt" | "analyticsCheckedAt" | "analyticsReadyAt" | "consecutiveFailures">
>;

export interface SyncStore {
  /** 잠금을 잡는다. 실행 중이면 SyncBusyError, 최소 간격 안이면 SyncCooldownError. */
  startRun(trigger: Trigger, minGapSeconds: number): Promise<number | null>;
  finishRun(runId: number | null, finish: RunFinish): Promise<void>;
  loadState(): Promise<SyncState>;
  /** 발견 단계의 기본 열만 쓴다(추적 여부·학습 값은 건드리지 않는다). */
  upsertIgMedia(rows: IgMediaState[]): Promise<void>;
  upsertYtVideos(rows: YtVideoState[]): Promise<void>;
  patchIgMedia(mediaId: string, patch: IgMediaPatch): Promise<void>;
  patchYtVideo(videoId: string, patch: YtVideoPatch): Promise<void>;
  createDraftEpisode(input: { title: string; igShortcode?: string | null; ytVideoId?: string | null }): Promise<number>;
  linkEpisode(episodeId: number, platform: Platform, key: string): Promise<void>;
  mergeEpisodes(sourceId: number, targetId: number, auto: boolean): Promise<void>;
  insertIgSnapshots(rows: IgSnapshotInput[], runId: number | null): Promise<number>;
  insertYtSnapshots(rows: YtSnapshotInput[], runId: number | null): Promise<number>;
}

export class SyncBusyError extends Error {
  constructor() {
    super("다른 수집이 실행 중입니다.");
    this.name = "SyncBusyError";
  }
}

export class SyncCooldownError extends Error {
  constructor(readonly retryAfterSec: number) {
    super(`최근에 수집했습니다. ${retryAfterSec}초 뒤에 다시 할 수 있습니다.`);
    this.name = "SyncCooldownError";
  }
}
