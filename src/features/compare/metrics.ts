import { GATES } from "@/lib/domain/constants";
import { formatCount, formatPct, formatRate } from "@/lib/domain/format";
import type { CompactIgPoint, CompactYtPoint } from "@/lib/data/screens";

export type ComparePlatform = "ig" | "yt";
export type CompareMetric = "views" | "skip" | "save" | "share" | "likes";

export interface MetricSpec {
  label: string;
  /** 누적 개수 지표는 T+0을 0으로 두고 로그 축을 쓸 수 있다 */
  cumulative: boolean;
  threshold: number | null;
  thresholdLabel?: string;
  format: (v: number | null) => string;
  pick: (p: CompactIgPoint & CompactYtPoint) => number | null;
}

export const METRICS: Record<ComparePlatform, Partial<Record<CompareMetric, MetricSpec>>> = {
  ig: {
    views: { label: "조회수", cumulative: true, threshold: null, format: formatCount, pick: (p) => p.views },
    skip: {
      label: "건너뛰기",
      cumulative: false,
      threshold: GATES.hook.maxSkipRate,
      thresholdLabel: `1차 관문 ${GATES.hook.maxSkipRate}%`,
      format: (v) => formatPct(v),
      pick: (p) => p.skip,
    },
    save: {
      label: "저장률",
      cumulative: false,
      threshold: GATES.spread.minSaveRate,
      thresholdLabel: `기준 ${GATES.spread.minSaveRate}%`,
      format: formatRate,
      pick: (p) => p.save,
    },
    share: {
      label: "공유율",
      cumulative: false,
      threshold: GATES.spread.minShareRate,
      thresholdLabel: `기준 ${GATES.spread.minShareRate}%`,
      format: formatRate,
      pick: (p) => p.share,
    },
  },
  yt: {
    views: { label: "조회수", cumulative: true, threshold: null, format: formatCount, pick: (p) => p.views },
    likes: { label: "좋아요", cumulative: true, threshold: null, format: formatCount, pick: (p) => p.likes },
  },
};

export const CHECKPOINTS = { "24h": [1, 3, 6, 12, 24], "72h": [1, 3, 6, 24, 72], "7d": [6, 24, 72, 120, 168] } as const;

export function parseView(sp: URLSearchParams) {
  const p: ComparePlatform = sp.get("p") === "yt" ? "yt" : "ig";
  const mRaw = sp.get("m") as CompareMetric | null;
  const m: CompareMetric = mRaw && METRICS[p][mRaw] ? mRaw : "views";
  const wRaw = sp.get("w");
  const w = wRaw === "24h" || wRaw === "7d" ? wRaw : "72h";
  const s = sp.get("s") === "lin" ? "lin" : "log";
  return { p, m, w, s } as const;
}
