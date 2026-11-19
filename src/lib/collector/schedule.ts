// 게시 후 경과 시간에 따라 스냅샷 간격을 늘린다. 크론은 15분마다 돌고, 여기서 이번 회차에 찍을 대상을 고른다.

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** [경과 시간 상한(시간), 간격(분)] */
export const DATA_TIERS: readonly (readonly [number, number])[] = [
  [6, 15],
  [72, 60],
  [168, 180],
  [720, 720],
  [Number.POSITIVE_INFINITY, 1440],
];

/** 크론 지연을 받아 주는 여유 */
export const DUE_TOLERANCE_MIN = 5;
/** Sync Now(force)가 간격을 무시하는 범위 */
export const FORCE_MAX_AGE_H = 720;
/** Analytics는 게시 후 이만큼 지나야 조회한다(24~48시간 집계 지연) */
export const ANALYTICS_MIN_AGE_H = 20;

export function ageHours(postedAt: Date, now: Date): number {
  return (now.getTime() - postedAt.getTime()) / HOUR_MS;
}

export function dataIntervalMinutes(ageH: number): number {
  return DATA_TIERS.find(([maxAge]) => ageH < maxAge)![1];
}

export function isDataDue(p: { postedAt: Date; lastSnapshotAt: Date | null; now: Date; force?: boolean }): boolean {
  const age = ageHours(p.postedAt, p.now);
  if (age < 0) return false;
  if (p.force && age < FORCE_MAX_AGE_H) return true;
  if (!p.lastSnapshotAt) return true;
  const elapsedMin = (p.now.getTime() - p.lastSnapshotAt.getTime()) / MINUTE_MS;
  return elapsedMin >= dataIntervalMinutes(age) - DUE_TOLERANCE_MIN;
}

export function analyticsIntervalMinutes(ageH: number, ready: boolean): number {
  if (!ready) return 180;
  if (ageH < 720) return 360;
  if (ageH < 4320) return 1440;
  return 10_080;
}

export function isAnalyticsDue(p: {
  publishedAt: Date;
  analyticsCheckedAt: Date | null;
  analyticsReadyAt: Date | null;
  now: Date;
  force?: boolean;
}): boolean {
  const age = ageHours(p.publishedAt, p.now);
  if (age < ANALYTICS_MIN_AGE_H) return false;
  if (p.force && age < FORCE_MAX_AGE_H) return true;
  if (!p.analyticsCheckedAt) return true;
  const elapsedMin = (p.now.getTime() - p.analyticsCheckedAt.getTime()) / MINUTE_MS;
  return elapsedMin >= analyticsIntervalMinutes(age, p.analyticsReadyAt !== null) - DUE_TOLERANCE_MIN;
}
