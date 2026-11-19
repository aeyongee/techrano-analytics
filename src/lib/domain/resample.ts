// 편마다 스냅샷 시각이 제각각이라(크론 지연, 간격 단계) 비교 차트에서는 같은 격자로 다시 뽑는다.

export interface SeriesPoint {
  hours: number;
  value: number | null;
}

export type CompareWindow = "24h" | "72h" | "7d";

export const WINDOWS: Record<CompareWindow, { maxHours: number; step: number; maxGapHours: number; ticks: number[] }> = {
  "24h": { maxHours: 24, step: 0.25, maxGapHours: 6, ticks: [0, 3, 6, 12, 18, 24] },
  "72h": { maxHours: 72, step: 1, maxGapHours: 6, ticks: [0, 6, 12, 24, 48, 72] },
  "7d": { maxHours: 168, step: 3, maxGapHours: 24, ticks: [0, 24, 48, 72, 96, 120, 144, 168] },
};

export function gridFor(window: CompareWindow): number[] {
  const { maxHours, step } = WINDOWS[window];
  return Array.from({ length: Math.round(maxHours / step) + 1 }, (_, i) => Math.round(i * step * 100) / 100);
}

function clean(points: SeriesPoint[], anchorZero: boolean): { hours: number; value: number }[] {
  const pts = points
    .filter((p): p is { hours: number; value: number } => p.value !== null && Number.isFinite(p.value) && p.hours >= 0)
    .sort((a, b) => a.hours - b.hours);
  if (anchorZero && (pts.length === 0 || pts[0].hours > 0)) pts.unshift({ hours: 0, value: 0 });
  return pts;
}

/**
 * 격자 위치마다 값을 선형 보간한다. 실측점 사이가 maxGap보다 벌어진 구간과
 * 첫 점 앞·마지막 점 뒤는 null(선을 끊는다). 누적 개수 지표는 anchorZero로 T+0을 0으로 둔다.
 */
export function resample(
  points: SeriesPoint[],
  grid: number[],
  opts: { maxGapHours: number; anchorZero: boolean },
): (number | null)[] {
  const pts = clean(points, opts.anchorZero);
  if (!pts.length) return grid.map(() => null);
  const out: (number | null)[] = [];
  let j = 0;
  for (const g of grid) {
    if (g < pts[0].hours || g > pts[pts.length - 1].hours) {
      out.push(null);
      continue;
    }
    while (j < pts.length - 2 && pts[j + 1].hours < g) j++;
    const a = pts[j];
    const b = pts[j + 1] ?? a;
    if (g === a.hours) out.push(a.value);
    else if (g === b.hours) out.push(b.value);
    else if (b.hours - a.hours > opts.maxGapHours) out.push(null);
    else out.push(a.value + ((b.value - a.value) * (g - a.hours)) / (b.hours - a.hours));
  }
  return out;
}

/** 한 시점의 값(같은 규칙으로 보간). "같은 18시간 시점의 5편" 같은 비교에 쓴다. */
export function valueAt(points: SeriesPoint[], hours: number, opts: { maxGapHours: number; anchorZero: boolean }): number | null {
  return resample(points, [hours], opts)[0];
}
