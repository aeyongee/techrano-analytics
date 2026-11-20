import type { AdminClient } from "@/lib/supabase/admin";
import type { Json, TableInsert, TableRow } from "@/lib/supabase/database.types";
import {
  SyncBusyError,
  SyncCooldownError,
  type EpisodeKey,
  type IgMediaPatch,
  type IgMediaState,
  type AudienceInput,
  type IgSnapshotInput,
  type Platform,
  type RunFinish,
  type SyncState,
  type SyncStore,
  type Trigger,
  type YtPrivacy,
  type YtSnapshotInput,
  type YtVideoPatch,
  type YtVideoState,
} from "../types";

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const date = (s: string | null) => (s ? new Date(s) : null);

class StoreError extends Error {
  constructor(what: string, err: { message: string; code?: string }) {
    super(`${what}: ${err.code ? `${err.code} ` : ""}${err.message}`);
    this.name = "StoreError";
  }
}

type Result<T> = { data: T | null; error: { message: string; code?: string } | null };

/** 오류면 던지고, 데이터가 있어야 하는 호출이면 그 값을 돌려준다. */
function check<T>(what: string, res: Result<T>): T {
  if (res.error) throw new StoreError(what, res.error);
  if (res.data === null) throw new StoreError(what, { message: "응답에 데이터가 없다." });
  return res.data;
}

function ok(what: string, res: Result<unknown>): void {
  if (res.error) throw new StoreError(what, res.error);
}

function igFromRow(r: TableRow<"ig_media">): IgMediaState {
  return {
    mediaId: r.media_id,
    shortcode: r.shortcode,
    permalink: r.permalink,
    captionHead: r.caption_head,
    postedAt: new Date(r.posted_at),
    isTracked: r.is_tracked,
    unsupportedMetrics: r.unsupported_metrics ?? [],
    metricsProbedAt: date(r.metrics_probed_at),
    lastSnapshotAt: date(r.last_snapshot_at),
    consecutiveFailures: r.consecutive_failures,
    coverPath: r.cover_path ?? null,
  };
}

function ytFromRow(r: TableRow<"yt_videos">): YtVideoState {
  return {
    videoId: r.video_id,
    title: r.title,
    privacyStatus: r.privacy_status as YtPrivacy,
    publishedAt: date(r.published_at),
    scheduledAt: date(r.scheduled_at),
    durationSec: r.duration_sec,
    isTracked: r.is_tracked,
    lastSnapshotAt: date(r.last_snapshot_at),
    analyticsCheckedAt: date(r.analytics_checked_at),
    analyticsReadyAt: date(r.analytics_ready_at),
    consecutiveFailures: r.consecutive_failures,
    coverPath: r.cover_path ?? null,
  };
}

/** secret key 클라이언트로 쓰는 실제 저장소 */
export class SupabaseSyncStore implements SyncStore {
  constructor(private readonly db: AdminClient) {}

  async startRun(trigger: Trigger, minGapSeconds: number) {
    const { data, error } = await this.db.rpc("start_sync_run", { p_trigger: trigger, p_min_gap_seconds: minGapSeconds });
    if (error?.code === "TR409") throw new SyncBusyError();
    if (error?.code === "TR429") throw new SyncCooldownError(Number(error.details) || minGapSeconds);
    if (error) throw new StoreError("start_sync_run", error);
    return data;
  }

  async finishRun(runId: number | null, f: RunFinish) {
    if (runId === null) return;
    ok(
      "finish_sync_run",
      await this.db
        .from("sync_runs")
        .update({
          status: f.status,
          finished_at: new Date().toISOString(),
          duration_ms: f.durationMs,
          ig_status: f.igStatus,
          yt_status: f.ytStatus,
          yt_analytics_status: f.ytAnalyticsStatus,
          ig_captured: f.igCaptured,
          yt_captured: f.ytCaptured,
          new_media: f.newMedia,
          api_calls: f.apiCalls as Json,
          errors: f.errors as unknown as Json,
          note: f.note,
        })
        .eq("id", runId),
    );
  }

  async loadState(): Promise<SyncState> {
    const [ig, yt, eps] = await Promise.all([
      this.db.from("ig_media").select("*"),
      this.db.from("yt_videos").select("*"),
      this.db.from("episodes").select("id, ep_no, title, status, ig_shortcode, yt_video_id"),
    ]);
    const episodes: EpisodeKey[] = check("episodes", eps).map((e) => ({
      id: e.id,
      epNo: e.ep_no,
      title: e.title,
      status: e.status as EpisodeKey["status"],
      igShortcode: e.ig_shortcode,
      ytVideoId: e.yt_video_id,
    }));
    return {
      ig: new Map(check("ig_media", ig).map((r) => [r.media_id, igFromRow(r)])),
      yt: new Map(check("yt_videos", yt).map((r) => [r.video_id, ytFromRow(r)])),
      episodes,
    };
  }

  async upsertIgMedia(rows: IgMediaState[]) {
    ok(
      "ig_media upsert",
      await this.db.from("ig_media").upsert(
        rows.map((r) => ({
          media_id: r.mediaId,
          shortcode: r.shortcode,
          permalink: r.permalink,
          caption_head: r.captionHead,
          posted_at: r.postedAt.toISOString(),
        })),
        { onConflict: "media_id" },
      ),
    );
  }

  async upsertYtVideos(rows: YtVideoState[]) {
    ok(
      "yt_videos upsert",
      await this.db.from("yt_videos").upsert(
        rows.map((r) => ({
          video_id: r.videoId,
          title: r.title,
          privacy_status: r.privacyStatus,
          published_at: iso(r.publishedAt),
          scheduled_at: iso(r.scheduledAt),
          duration_sec: r.durationSec,
        })),
        { onConflict: "video_id" },
      ),
    );
  }

  async patchIgMedia(mediaId: string, p: IgMediaPatch) {
    const row: Partial<TableRow<"ig_media">> = {};
    if (p.isTracked !== undefined) row.is_tracked = p.isTracked;
    if (p.unsupportedMetrics !== undefined) row.unsupported_metrics = p.unsupportedMetrics;
    if (p.metricsProbedAt !== undefined) row.metrics_probed_at = iso(p.metricsProbedAt);
    if (p.lastSnapshotAt !== undefined) row.last_snapshot_at = iso(p.lastSnapshotAt);
    if (p.consecutiveFailures !== undefined) row.consecutive_failures = p.consecutiveFailures;
    if (p.coverPath !== undefined) row.cover_path = p.coverPath;
    ok("ig_media update", await this.db.from("ig_media").update(row).eq("media_id", mediaId));
  }

  async patchYtVideo(videoId: string, p: YtVideoPatch) {
    const row: Partial<Omit<TableRow<"yt_videos">, "is_short">> = {};
    if (p.isTracked !== undefined) row.is_tracked = p.isTracked;
    if (p.lastSnapshotAt !== undefined) row.last_snapshot_at = iso(p.lastSnapshotAt);
    if (p.analyticsCheckedAt !== undefined) row.analytics_checked_at = iso(p.analyticsCheckedAt);
    if (p.analyticsReadyAt !== undefined) row.analytics_ready_at = iso(p.analyticsReadyAt);
    if (p.consecutiveFailures !== undefined) row.consecutive_failures = p.consecutiveFailures;
    if (p.coverPath !== undefined) row.cover_path = p.coverPath;
    ok("yt_videos update", await this.db.from("yt_videos").update(row).eq("video_id", videoId));
  }

  async createDraftEpisode(input: { title: string; igShortcode?: string | null; ytVideoId?: string | null }) {
    const row: TableInsert<"episodes"> = {
      title: input.title,
      status: "draft",
      ig_shortcode: input.igShortcode ?? null,
      yt_video_id: input.ytVideoId ?? null,
    };
    return check<{ id: number }>("episodes insert", await this.db.from("episodes").insert(row).select("id").single()).id;
  }

  async linkEpisode(episodeId: number, platform: Platform, key: string) {
    const patch = platform === "ig" ? { ig_shortcode: key } : { yt_video_id: key };
    ok("episodes link", await this.db.from("episodes").update(patch).eq("id", episodeId));
  }

  async mergeEpisodes(sourceId: number, targetId: number, auto: boolean) {
    ok("merge_episode", await this.db.rpc("merge_episode", { p_source: sourceId, p_target: targetId, p_auto: auto }));
  }

  async insertIgSnapshots(rows: IgSnapshotInput[], runId: number | null) {
    const data = check(
      "ig_snapshots insert",
      await this.db
        .from("ig_snapshots")
        .upsert(
          rows.map((r) => ({
            media_id: r.mediaId,
            run_id: runId,
            captured_at: r.capturedAt.toISOString(),
            views: r.views,
            reach: r.reach,
            saved: r.saved,
            shares: r.shares,
            comments: r.comments,
            likes: r.likes,
            avg_watch_ms: r.avgWatchMs,
            skip_rate: r.skipRate,
          })),
          { onConflict: "media_id,captured_at", ignoreDuplicates: true },
        )
        .select("id"),
    );
    return data.length;
  }

  async insertYtSnapshots(rows: YtSnapshotInput[], runId: number | null) {
    const data = check(
      "yt_snapshots insert",
      await this.db
        .from("yt_snapshots")
        .upsert(
          rows.map((r) => ({
            video_id: r.videoId,
            run_id: runId,
            captured_at: r.capturedAt.toISOString(),
            views: r.views,
            likes: r.likes,
            comments: r.comments,
            a_views: r.analytics?.views ?? null,
            a_engaged_views: r.analytics?.engagedViews ?? null,
            a_avg_view_duration_s: r.analytics?.avgViewDurationSec ?? null,
            a_avg_view_pct: r.analytics?.avgViewPct ?? null,
            a_shares: r.analytics?.shares ?? null,
            a_subscribers_gained: r.analytics?.subscribersGained ?? null,
          })),
          { onConflict: "video_id,captured_at", ignoreDuplicates: true },
        )
        .select("id"),
    );
    return data.length;
  }

  async insertAudience(rows: AudienceInput[], runId: number | null) {
    const data = check(
      "audience_snapshots insert",
      await this.db
        .from("audience_snapshots")
        .upsert(
          rows.map((r) => ({ platform: r.platform, captured_at: r.capturedAt.toISOString(), count: r.count, source: r.source, run_id: runId })),
          { onConflict: "platform,captured_at", ignoreDuplicates: true },
        )
        .select("platform"),
    );
    return data.length;
  }

  async uploadCover(path: string, bytes: ArrayBuffer, contentType: string) {
    const { error } = await this.db.storage.from("covers").upload(path, bytes, { contentType, upsert: true });
    if (error) throw new StoreError("표지 업로드", error);
  }
}
