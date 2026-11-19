import type { YtAnalyticsMetrics } from "./types";

/** 한 계정이 평균 몇 번 봤는지(1보다 크면 다시 보기가 있다) */
export const rewatchRatio = (views: number | null, reach: number | null) =>
  views === null || reach === null || reach <= 0 ? null : views / reach;

/** 평균 시청 시간이 영상 길이의 몇 %인지 */
export const avgWatchPct = (avgWatchMs: number | null, lengthSec: number | null) =>
  avgWatchMs === null || !lengthSec ? null : (100 * avgWatchMs) / 1000 / lengthSec;

/** 참여 조회수 ÷ 같은 Analytics 집계의 조회수. Studio의 '계속 시청함'과는 다른 지표다. */
export const engagedRatio = (a: Pick<YtAnalyticsMetrics, "views" | "engagedViews"> | null) =>
  !a || a.engagedViews === null || a.views <= 0 ? null : (100 * a.engagedViews) / a.views;

export function median(xs: (number | null | undefined)[]): number | null {
  const v = xs.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}
