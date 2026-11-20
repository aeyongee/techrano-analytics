import type { YtAnalyticsValues, YtPrivacy, YtVideoState } from "../types";

export interface YtVideoItem {
  id: string;
  snippet?: { title?: string; publishedAt?: string; thumbnails?: Record<string, { url?: string } | undefined> };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  contentDetails?: { duration?: string };
  status?: { privacyStatus?: string; publishAt?: string };
}

/** yt-stats.py의 parse_iso_duration. "PT1M5S" → 65, 일 단위("P1DT…")도 받는다. */
export function parseIsoDuration(iso: string | null | undefined): number | null {
  const m = (iso ?? "").match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m || iso === "P" || iso === "PT") return null;
  const [d, h, min, s] = m.slice(1).map((x) => Number(x ?? 0));
  return d * 86_400 + h * 3_600 + min * 60 + s;
}

const PRIVACY: YtPrivacy[] = ["public", "unlisted", "private"];
const toInt = (v: string | undefined) => (v === undefined ? null : Number.parseInt(v, 10));

/**
 * 응답 한 건을 DB 상태로 바꾼다. 예약 공개 영상은 public이 될 때까지 published_at을 비워 두고,
 * public이 되면 snippet.publishedAt(공개 시각)으로 매번 갱신한다. 한 번 공개됐다가 내려간 영상은 그 값을 지킨다.
 */
export function toVideoState(item: YtVideoItem, prev?: YtVideoState): YtVideoState {
  const privacy = (PRIVACY as string[]).includes(item.status?.privacyStatus ?? "")
    ? (item.status!.privacyStatus as YtPrivacy)
    : "private";
  const published = item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : null;
  return {
    videoId: item.id,
    title: item.snippet?.title ?? prev?.title ?? item.id,
    privacyStatus: privacy,
    publishedAt: privacy === "public" ? published : prev?.publishedAt ?? null,
    scheduledAt: item.status?.publishAt ? new Date(item.status.publishAt) : null,
    durationSec: parseIsoDuration(item.contentDetails?.duration),
    isTracked: prev?.isTracked ?? true,
    lastSnapshotAt: prev?.lastSnapshotAt ?? null,
    analyticsCheckedAt: prev?.analyticsCheckedAt ?? null,
    analyticsReadyAt: prev?.analyticsReadyAt ?? null,
    consecutiveFailures: 0,
    coverPath: prev?.coverPath ?? null,
  };
}

/** 쇼츠 표지 후보: 세로 썸네일 → 가장 큰 가로 썸네일 */
export function coverUrlsOf(item: YtVideoItem): string[] {
  const t = item.snippet?.thumbnails ?? {};
  const fallback = ["maxres", "standard", "high"].map((k) => t[k]?.url).find((u): u is string => !!u);
  return [`https://i.ytimg.com/vi/${item.id}/oardefault.jpg`, ...(fallback ? [fallback] : [])];
}

export function statsOf(item: YtVideoItem) {
  return {
    views: toInt(item.statistics?.viewCount),
    likes: toInt(item.statistics?.likeCount),
    comments: toInt(item.statistics?.commentCount),
  };
}

export interface AnalyticsReport {
  columnHeaders?: { name: string }[];
  rows?: (string | number)[][];
}

export function parseAnalyticsReport(res: AnalyticsReport): Map<string, YtAnalyticsValues> {
  const headers = (res.columnHeaders ?? []).map((h) => h.name);
  const out = new Map<string, YtAnalyticsValues>();
  for (const row of res.rows ?? []) {
    const rec = Object.fromEntries(headers.map((h, i) => [h, row[i]]));
    const num = (k: string) => (typeof rec[k] === "number" ? (rec[k] as number) : null);
    if (typeof rec.video !== "string") continue;
    out.set(rec.video, {
      views: num("views") ?? 0,
      engagedViews: num("engagedViews"),
      avgViewDurationSec: num("averageViewDuration"),
      avgViewPct: num("averageViewPercentage"),
      shares: num("shares"),
      subscribersGained: num("subscribersGained"),
    });
  }
  return out;
}

/** Analytics endDate. yt-stats.py처럼 로컬(한국) 날짜를 쓴다. */
export function kstDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
