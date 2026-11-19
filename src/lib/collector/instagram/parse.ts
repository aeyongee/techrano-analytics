import type { IgMetricsValues } from "../types";

export const IG_METRICS = [
  "views",
  "reach",
  "saved",
  "shares",
  "comments",
  "likes",
  "ig_reels_avg_watch_time",
  "reels_skip_rate",
] as const;
export type IgMetric = (typeof IG_METRICS)[number];

export interface IgMediaItem {
  id: string;
  caption?: string;
  media_product_type?: string;
  timestamp: string;
  permalink?: string;
}

interface InsightItem {
  name: string;
  values?: { value?: unknown }[];
  total_value?: { value?: unknown };
}

/** "2026-11-19T09:30:12+0000" → Date. "+0000"을 "+00:00"으로 바꿔야 어디서나 같은 값이 나온다. */
export function parseIgTimestamp(ts: string): Date {
  const iso = ts.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`인스타 시각을 읽지 못했다: ${ts}`);
  return d;
}

const toNumber = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** insta-stats.py와 같이 values[0].value, 없으면 total_value.value를 읽는다. */
export function parseInsightsData(data: unknown): Partial<Record<string, number | null>> {
  const out: Partial<Record<string, number | null>> = {};
  if (!Array.isArray(data)) return out;
  for (const item of data as InsightItem[]) {
    if (!item || typeof item.name !== "string") continue;
    const raw = item.values?.length ? item.values[0]?.value : item.total_value?.value;
    out[item.name] = toNumber(raw);
  }
  return out;
}

export function toIgMetrics(values: Partial<Record<string, number | null>>): IgMetricsValues {
  const int = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(v));
  const skip = values.reels_skip_rate;
  return {
    views: int(values.views),
    reach: int(values.reach),
    saved: int(values.saved),
    shares: int(values.shares),
    comments: int(values.comments),
    likes: int(values.likes),
    avgWatchMs: int(values.ig_reels_avg_watch_time),
    skipRate: skip === null || skip === undefined ? null : Math.round(skip * 100) / 100,
  };
}

/** X-App-Usage·X-Business-Use-Case-Usage에서 가장 높은 사용률(%) */
export function usagePercent(headers: Headers): number | null {
  const nums: number[] = [];
  const collect = (obj: unknown) => {
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      if (["call_count", "total_time", "total_cputime"].includes(k) && typeof v === "number") nums.push(v);
      else if (typeof v === "object") collect(v);
    }
  };
  for (const name of ["x-app-usage", "x-business-use-case-usage"]) {
    const raw = headers.get(name);
    if (!raw) continue;
    try {
      collect(JSON.parse(raw));
    } catch {
      // 형식이 다르면 무시
    }
  }
  return nums.length ? Math.max(...nums) : null;
}
