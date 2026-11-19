import type { HttpDeps } from "../context";
import { fetchJson, HttpError } from "../http";
import type { YtAnalyticsValues } from "../types";
import { parseAnalyticsReport, type AnalyticsReport, type YtVideoItem } from "./parse";

const DATA_API = "https://www.googleapis.com/youtube/v3";
const ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2/reports";
/** yt-stats.py에서 검증한 값. 채널 개설 전 날짜라 누적 전체가 나온다. */
export const ANALYTICS_START_DATE = "2025-01-01";
export const ANALYTICS_METRICS = "views,engagedViews,averageViewDuration,averageViewPercentage,shares,subscribersGained";

const chunk = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

export interface YoutubeClientOptions extends HttpDeps {
  accessToken: string;
  onCall: (kind: "yt_data" | "yt_analytics") => void;
}

export class YoutubeClient {
  constructor(private readonly opts: YoutubeClientOptions) {}

  private get<T>(base: string, path: string, params: Record<string, string | number>, kind: "yt_data" | "yt_analytics") {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])));
    this.opts.onCall(kind);
    return fetchJson<T>(`${base}${path ? `/${path}` : ""}?${qs}`, {
      headers: { Authorization: `Bearer ${this.opts.accessToken}` },
      fetchImpl: this.opts.fetchImpl,
      sleep: this.opts.sleep,
    });
  }

  async getUploadsPlaylistId(): Promise<string> {
    const res = await this.get<{ items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[] }>(
      DATA_API, "channels", { part: "contentDetails", mine: "true" }, "yt_data",
    );
    const id = res.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!id) throw new HttpError(0, "연결된 YouTube 채널이 없다.", "NO_CHANNEL");
    return id;
  }

  async getChannelTitle(): Promise<string | null> {
    const res = await this.get<{ items?: { snippet?: { title?: string } }[] }>(
      DATA_API, "channels", { part: "snippet", mine: "true" }, "yt_data",
    );
    return res.items?.[0]?.snippet?.title ?? null;
  }

  async listUploadIds(playlistId: string, max = 25): Promise<string[]> {
    const res = await this.get<{ items?: { contentDetails?: { videoId?: string } }[] }>(
      DATA_API, "playlistItems", { part: "contentDetails", playlistId, maxResults: max }, "yt_data",
    );
    return (res.items ?? []).map((i) => i.contentDetails?.videoId).filter((v): v is string => !!v);
  }

  async getVideos(ids: string[]): Promise<YtVideoItem[]> {
    const out: YtVideoItem[] = [];
    for (const part of chunk(ids, 50)) {
      const res = await this.get<{ items?: YtVideoItem[] }>(
        DATA_API, "videos", { part: "snippet,statistics,contentDetails,status", id: part.join(",") }, "yt_data",
      );
      out.push(...(res.items ?? []));
    }
    return out;
  }

  async getAnalyticsTotals(ids: string[], endDate: string): Promise<Map<string, YtAnalyticsValues>> {
    const out = new Map<string, YtAnalyticsValues>();
    for (const part of chunk(ids, 50)) {
      const res = await this.get<AnalyticsReport>(
        ANALYTICS_API,
        "",
        {
          ids: "channel==MINE",
          startDate: ANALYTICS_START_DATE,
          endDate,
          metrics: ANALYTICS_METRICS,
          dimensions: "video",
          filters: `video==${part.join(",")}`,
          maxResults: 50,
        },
        "yt_analytics",
      );
      for (const [k, v] of parseAnalyticsReport(res)) out.set(k, v);
    }
    return out;
  }
}
