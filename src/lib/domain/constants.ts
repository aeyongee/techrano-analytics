import type { Quadrant } from "./types";

/**
 * 2단계 알고리즘 관문. 1~10편 운영 기록에서 정한 기준이다.
 * - 1차(3초 훅): 건너뛰기가 높은 편은 초반에 멈췄고, 낮은 편은 넘었다.
 * - 2차(확산): 저장·공유가 도달 대비 이만큼 나온 편만 크게 퍼졌다.
 * 도달이 적으면 비율이 크게 흔들려 판정하지 않는다(값은 운영하며 조정).
 */
export const GATES = {
  hook: { maxSkipRate: 45 },
  spread: { minSaveRate: 1.0, minShareRate: 0.5 },
  minReachHook: 200,
  minReachSpread: 500,
} as const;

/** 사분면 Y 기준선 = 저장 기준 + 공유 기준 */
export const QUADRANT_Y_LINE = GATES.spread.minSaveRate + GATES.spread.minShareRate;

export const QUADRANT_LABEL: Record<Quadrant, string> = {
  breakout: "터짐",
  hookWeak: "훅 부족",
  saveWeak: "저장동기 부족",
  rework: "전면개선",
};

/** 비교 차트 색(최대 5편). 첫 색은 최신 편. */
export const SERIES_COLORS = ["var(--rano)", "var(--sky)", "var(--amber)", "var(--lavender)", "var(--orange)"] as const;
export const MAX_COMPARE = 5;

export const TIME_ZONE = "Asia/Seoul";
