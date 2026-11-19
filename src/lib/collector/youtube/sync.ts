import type { SyncContext } from "../context";
import { attachYtVideo } from "../episodes";
import { HttpError } from "../http";
import { isAnalyticsDue, isDataDue } from "../schedule";
import type { AnalyticsStatus, PlatformSummary, SyncState, SyncStore, YtAnalyticsValues, YtSnapshotInput, YtVideoState } from "../types";
import type { YoutubeClient } from "./client";
import { kstDate, statsOf, toVideoState, type YtVideoItem } from "./parse";

const MISSING_LIMIT = 3;
/** Data API 조회수가 이만큼인데 Analytics가 0이면 아직 집계 전으로 본다. */
const READY_MIN_DATA_VIEWS = 50;

export interface YtDeps {
  client: YoutubeClient;
  store: SyncStore;
  state: SyncState;
  runId: number | null;
  uploadsPlaylistId: string | null;
}

export async function discoverYoutube(
  ctx: SyncContext,
  d: YtDeps,
): Promise<{ newMedia: number; drafts: number; items: Map<string, YtVideoItem> }> {
  const playlistId = d.uploadsPlaylistId ?? (await d.client.getUploadsPlaylistId());
  const uploads = await d.client.listUploadIds(playlistId, 25);
  const tracked = [...d.state.yt.values()].filter((v) => v.isTracked).map((v) => v.videoId);
  const ids = [...new Set([...uploads, ...tracked])];
  const items = new Map((await d.client.getVideos(ids)).map((i) => [i.id, i]));

  const rows: YtVideoState[] = [];
  let newMedia = 0;
  for (const item of items.values()) {
    const prev = d.state.yt.get(item.id);
    if (!prev) newMedia++;
    const row = toVideoState(item, prev);
    rows.push(row);
    d.state.yt.set(row.videoId, row);
  }
  if (rows.length) await d.store.upsertYtVideos(rows);

  // 추적 중인데 응답에서 사라진 영상(삭제 등)
  for (const id of tracked) {
    if (items.has(id)) continue;
    const v = d.state.yt.get(id)!;
    v.consecutiveFailures += 1;
    const untrack = v.consecutiveFailures >= MISSING_LIMIT;
    if (untrack) v.isTracked = false;
    await d.store.patchYtVideo(id, { consecutiveFailures: v.consecutiveFailures, ...(untrack && { isTracked: false }) });
    ctx.fail({ platform: "yt", stage: "videos", target: id, code: untrack ? "MISSING_UNTRACKED" : "MISSING", message: "videos.list 응답에 없다." });
  }

  let drafts = 0;
  for (const row of rows) {
    if ((await attachYtVideo(d.store, d.state, row)) === "draft") drafts++;
  }
  return { newMedia, drafts, items };
}

export async function captureYoutube(
  ctx: SyncContext,
  d: YtDeps,
  items: Map<string, YtVideoItem>,
): Promise<PlatformSummary & { analytics: AnalyticsStatus }> {
  const capturedAt = ctx.current();
  const live = [...d.state.yt.values()].filter((v) => v.isTracked && v.privacyStatus === "public" && v.publishedAt && items.has(v.videoId));

  const analyticsDue = live.filter((v) =>
    isAnalyticsDue({
      publishedAt: v.publishedAt!,
      analyticsCheckedAt: v.analyticsCheckedAt,
      analyticsReadyAt: v.analyticsReadyAt,
      now: ctx.now,
      force: ctx.force,
    }),
  );
  const dataDue = live.filter(
    (v) =>
      analyticsDue.includes(v) ||
      isDataDue({ postedAt: v.publishedAt!, lastSnapshotAt: v.lastSnapshotAt, now: ctx.now, force: ctx.force }),
  );

  let analyticsStatus: AnalyticsStatus = analyticsDue.length ? "ok" : "not_due";
  let report = new Map<string, YtAnalyticsValues>();
  if (analyticsDue.length) {
    try {
      report = await d.client.getAnalyticsTotals(analyticsDue.map((v) => v.videoId), kstDate(ctx.now));
    } catch (e) {
      analyticsStatus = "error";
      ctx.fail({
        platform: "yt_analytics",
        stage: "analytics",
        code: e instanceof HttpError ? String(e.apiCode ?? e.status) : "ERROR",
        message: (e as Error).message,
      });
    }
  }

  const snapshots: YtSnapshotInput[] = [];
  for (const v of dataDue) {
    const stats = statsOf(items.get(v.videoId)!);
    const row = report.get(v.videoId);
    const ready = !!row && !(row.views === 0 && (stats.views ?? 0) >= READY_MIN_DATA_VIEWS);
    snapshots.push({ videoId: v.videoId, capturedAt, ...stats, analytics: ready ? row! : null });

    v.lastSnapshotAt = capturedAt;
    const checked = analyticsStatus === "ok" && analyticsDue.includes(v);
    if (checked) v.analyticsCheckedAt = ctx.now;
    if (ready && !v.analyticsReadyAt) v.analyticsReadyAt = ctx.now;
    await d.store.patchYtVideo(v.videoId, {
      lastSnapshotAt: capturedAt,
      ...(checked && { analyticsCheckedAt: ctx.now }),
      ...(ready && { analyticsReadyAt: v.analyticsReadyAt }),
    });
  }

  const captured = snapshots.length ? await d.store.insertYtSnapshots(snapshots, d.runId) : 0;
  return { status: "ok", due: dataDue.length, captured, analytics: analyticsStatus };
}
