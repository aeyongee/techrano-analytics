export interface Delta {
  from: number;
  to: number;
  abs: number;
  /** 실제로 비교한 두 스냅샷의 간격 */
  windowMinutes: number;
}

/**
 * 최신 스냅샷과, 그보다 targetMinutes 앞에 가장 가까운 스냅샷을 비교한다.
 * 두 스냅샷 간격이 [minMinutes, maxMinutes] 밖이면 비교하지 않는다(크론이 밀린 구간에서 엉뚱한 "1시간 델타"를 막는다).
 */
export function deltaNear(
  points: { capturedAt: string; value: number | null }[],
  { targetMinutes = 60, minMinutes = 40, maxMinutes = 180 } = {},
): Delta | null {
  const pts = points
    .filter((p): p is { capturedAt: string; value: number } => p.value !== null)
    .map((p) => ({ t: Date.parse(p.capturedAt), value: p.value }))
    .sort((a, b) => a.t - b.t);
  if (pts.length < 2) return null;
  const last = pts[pts.length - 1];
  let best: { t: number; value: number } | null = null;
  for (const p of pts.slice(0, -1)) {
    const gap = (last.t - p.t) / 60_000;
    if (gap < minMinutes || gap > maxMinutes) continue;
    if (!best || Math.abs(gap - targetMinutes) < Math.abs((last.t - best.t) / 60_000 - targetMinutes)) best = p;
  }
  if (!best) return null;
  return { from: best.value, to: last.value, abs: last.value - best.value, windowMinutes: Math.round((last.t - best.t) / 60_000) };
}
