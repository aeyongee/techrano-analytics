import { SERIES_COLORS } from "@/lib/domain/constants";
import { gridFor, resample, valueAt, WINDOWS, type CompareWindow } from "@/lib/domain/resample";
import type { CompareSeries } from "@/lib/data/screens";
import { METRICS, type CompareMetric, type ComparePlatform } from "./metrics";

/** 실측점이 이보다 적으면 보간하지 않고 실측 위치에만 점을 찍는다 */
const SPARSE_BELOW = 8;
/** 첫 실측이 이보다 늦으면 "초기 기록 없음"으로 알린다 */
const EARLY_MISSING_H = 6;

export interface BuiltSeries {
  key: string;
  label: string;
  title: string;
  color: string;
  isLatest: boolean;
  sparse: boolean;
  firstHour: number | null;
  lastHour: number | null;
  points: { hours: number; value: number | null }[];
}

export function seriesLabel(s: { epNo: number | null }) {
  return s.epNo !== null ? `${s.epNo}편` : "초안";
}

export function buildCompare(selected: CompareSeries[], platform: ComparePlatform, metric: CompareMetric, window: CompareWindow) {
  const spec = METRICS[platform][metric]!;
  const { maxHours, maxGapHours, step } = WINDOWS[window];
  const grid = gridFor(window);
  // 최신 편이 늘 초록(첫 색)이 되게 색을 나눈다
  const order = [...selected].sort((a, b) => Number(b.isLatest) - Number(a.isLatest));

  const series: BuiltSeries[] = order.map((s, i) => {
    const raw = (platform === "ig" ? s.ig : s.yt) as (CompareSeries["ig"][number] & CompareSeries["yt"][number])[];
    // 창 끝의 값도 보간할 수 있게 창보다 조금 넓게 남긴다(차트 축은 창에서 자른다)
    const points = raw.filter((p) => p.h <= maxHours + maxGapHours).map((p) => ({ hours: p.h, value: spec.pick(p) }));
    const real = points.filter((p) => p.value !== null && p.hours <= maxHours + 1e-6);
    return {
      key: `s${i}`,
      label: seriesLabel(s),
      title: s.title,
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      isLatest: s.isLatest,
      sparse: real.length > 0 && real.length < SPARSE_BELOW,
      firstHour: real[0]?.hours ?? null,
      lastHour: real.at(-1)?.hours ?? null,
      points,
    };
  });

  const columns = series.map((s) => {
    if (!s.sparse) return resample(s.points, grid, { maxGapHours, anchorZero: spec.cumulative });
    const col: (number | null)[] = grid.map(() => null);
    if (spec.cumulative && s.firstHour !== null && s.firstHour <= maxGapHours) col[0] = 0;
    for (const p of s.points) if (p.value !== null && p.hours <= maxHours + 1e-6) col[Math.round(p.hours / step)] = p.value;
    return col;
  });

  const rows = grid.map((h, j) => Object.fromEntries([["h", h], ...series.map((s, i) => [s.key, columns[i][j]])]));
  const notes = series
    .filter((s) => s.firstHour === null || s.firstHour > EARLY_MISSING_H)
    .map((s) => (s.firstHour === null ? `${s.label}: 이 구간 기록 없음` : `${s.label}: 초기 기록 없음(T+${Math.round(s.firstHour)}h부터)`));

  return { spec, grid, rows, series, notes, maxHours, ticks: WINDOWS[window].ticks };
}

/** 체크포인트 표: 각 편의 T+h 값(실측 범위 밖이면 null) */
export function checkpointValue(s: BuiltSeries, h: number, window: CompareWindow, cumulative: boolean) {
  return valueAt(s.points, h, { maxGapHours: WINDOWS[window].maxGapHours, anchorZero: cumulative });
}

/** 값 패널: 가리키는 시점의 값. 격자가 아니라 실측 사이를 바로 보간한다(마지막 실측이 격자보다 앞이어도 나온다). */
export function valueNear(s: BuiltSeries, h: number, window: CompareWindow, cumulative: boolean) {
  const v = checkpointValue(s, h, window, cumulative);
  if (v !== null) return v;
  // 그 편의 마지막 실측을 조금 넘긴 시점이면 마지막 값을 쓴다(진행 중인 편의 '지금')
  const last = [...s.points].reverse().find((p) => p.value !== null);
  return last && h >= last.hours && h - last.hours <= 0.5 ? last.value : null;
}
