// Supabase 행을 도메인 타입으로 옮긴다. 순수 함수라 테스트에서 직접 쓴다.
import type { TableRow, ViewRow } from "@/lib/supabase/database.types";
import { episodeKey, type EpisodeRaw, type IgPoint, type SyncErrorRow, type SyncRunRow, type YtPoint } from "@/lib/domain/types";

const H = 3_600_000;
const n = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));
const hoursBetween = (from: string | null, to: string | null) => (from && to ? (Date.parse(to) - Date.parse(from)) / H : 0);

export function mapOverviewRow(r: ViewRow<"v_episode_overview">): EpisodeRaw {
  const id = Number(r.id);
  const epNo = n(r.ep_no);
  const ig =
    r.media_id && r.ig_posted_at
      ? {
          mediaId: r.media_id,
          shortcode: r.ig_shortcode ?? "",
          permalink: r.permalink ?? "",
          postedAt: r.ig_posted_at,
          tracked: r.ig_tracked ?? true,
          latest: r.ig_captured_at
            ? ({
                capturedAt: r.ig_captured_at,
                hours: hoursBetween(r.ig_posted_at, r.ig_captured_at),
                source: (r.ig_source as IgPoint["source"]) ?? "api",
                views: n(r.ig_views),
                reach: n(r.ig_reach),
                saved: n(r.ig_saved),
                shares: n(r.ig_shares),
                comments: n(r.ig_comments),
                likes: n(r.ig_likes),
                avgWatchMs: n(r.ig_avg_watch_ms),
                skipRate: n(r.ig_skip_rate),
              } satisfies IgPoint)
            : null,
        }
      : null;
  const yt = r.yt_video_id
    ? {
        videoId: r.yt_video_id,
        title: r.yt_title ?? r.title ?? "",
        privacy: ((r.yt_privacy as "public" | "unlisted" | "private" | null) ?? "private"),
        publishedAt: r.yt_published_at,
        scheduledAt: r.yt_scheduled_at,
        durationSec: n(r.yt_duration_sec),
        tracked: r.yt_tracked ?? true,
        latest: r.yt_captured_at
          ? ({
              capturedAt: r.yt_captured_at,
              hours: hoursBetween(r.yt_published_at, r.yt_captured_at),
              views: n(r.yt_views),
              likes: n(r.yt_likes),
              comments: n(r.yt_comments),
              analytics: null,
            } satisfies YtPoint)
          : null,
        analytics:
          r.yt_analytics_at && r.a_views !== null
            ? {
                capturedAt: r.yt_analytics_at,
                views: Number(r.a_views),
                engagedViews: n(r.a_engaged_views),
                avgViewDurationSec: n(r.a_avg_view_duration_s),
                avgViewPct: n(r.a_avg_view_pct),
                shares: n(r.a_shares),
                subscribersGained: n(r.a_subscribers_gained),
              }
            : null,
      }
    : null;
  return {
    id,
    key: episodeKey({ id, epNo }),
    epNo,
    slug: r.slug,
    title: r.title ?? "",
    status: (r.status as EpisodeRaw["status"]) ?? "draft",
    series: r.series,
    topic: r.topic,
    isTrueStory: r.is_true_story ?? false,
    lengthSec: n(r.length_sec),
    hookDesc: r.hook_desc,
    hypothesis: r.hypothesis,
    retro72h: r.retro_72h,
    notes: r.notes,
    isBenchmark: r.is_benchmark ?? false,
    autoPaired: r.auto_paired ?? false,
    postedAt: r.posted_at,
    updatedAt: r.updated_at ?? new Date(0).toISOString(),
    ig,
    yt,
  };
}

export function mapIgSeriesRow(r: ViewRow<"v_ig_series">): IgPoint {
  return {
    capturedAt: r.captured_at ?? "",
    hours: n(r.hours_since_post) ?? 0,
    source: (r.source as IgPoint["source"]) ?? "api",
    views: n(r.views),
    reach: n(r.reach),
    saved: n(r.saved),
    shares: n(r.shares),
    comments: n(r.comments),
    likes: n(r.likes),
    avgWatchMs: n(r.avg_watch_ms),
    skipRate: n(r.skip_rate),
  };
}

export function mapYtSeriesRow(r: ViewRow<"v_yt_series">): YtPoint {
  return {
    capturedAt: r.captured_at ?? "",
    hours: n(r.hours_since_post) ?? 0,
    views: n(r.views),
    likes: n(r.likes),
    comments: n(r.comments),
    analytics:
      r.a_views !== null
        ? {
            views: Number(r.a_views),
            engagedViews: n(r.a_engaged_views),
            avgViewDurationSec: n(r.a_avg_view_duration_s),
            avgViewPct: n(r.a_avg_view_pct),
            shares: n(r.a_shares),
            subscribersGained: n(r.a_subscribers_gained),
          }
        : null,
  };
}

export function mapRunRow(r: TableRow<"sync_runs">): SyncRunRow {
  return {
    id: Number(r.id),
    trigger: r.trigger as SyncRunRow["trigger"],
    status: r.status as SyncRunRow["status"],
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    durationMs: r.duration_ms,
    igStatus: r.ig_status,
    ytStatus: r.yt_status,
    ytAnalyticsStatus: r.yt_analytics_status,
    igCaptured: r.ig_captured,
    ytCaptured: r.yt_captured,
    newMedia: r.new_media,
    errors: Array.isArray(r.errors) ? (r.errors as unknown as SyncErrorRow[]) : [],
    note: r.note,
  };
}
