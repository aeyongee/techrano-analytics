import { GATES, QUADRANT_Y_LINE, YT_GATES } from "./constants";
import { engagedRatio } from "./metrics";
import type { IgMetrics, Quadrant, Verdict, YtAnalyticsMetrics } from "./types";

export interface GateResult {
  hook: Verdict;
  save: Verdict;
  share: Verdict;
  /** 2차 관문 = 저장과 공유가 둘 다 기준 이상 */
  spread: Verdict;
  /** 사분면 위치(건너뛰기 45%, 저장+공유 1.5% 선 기준). 둘 중 하나라도 판정 대기면 null */
  quadrant: Quadrant | null;
  /** 위쪽 사분면에 있지만 저장·공유 중 하나가 기준 미달(△) */
  strictMismatch: boolean;
  saveRate: number | null;
  shareRate: number | null;
  saveShareRate: number | null;
}

const pct = (part: number | null, whole: number | null) =>
  part === null || whole === null || whole <= 0 ? null : (100 * part) / whole;

export function spreadRates(m: Pick<IgMetrics, "saved" | "shares" | "reach">) {
  const saveRate = pct(m.saved, m.reach);
  const shareRate = pct(m.shares, m.reach);
  return {
    saveRate,
    shareRate,
    saveShareRate: saveRate === null || shareRate === null ? null : saveRate + shareRate,
  };
}

export function evaluateGates(m: IgMetrics): GateResult {
  const { saveRate, shareRate, saveShareRate } = spreadRates(m);
  const reach = m.reach ?? 0;

  const hook: Verdict =
    m.skipRate === null || reach < GATES.minReachHook ? "pending" : m.skipRate <= GATES.hook.maxSkipRate ? "pass" : "fail";
  const spreadReady = reach >= GATES.minReachSpread;
  const save: Verdict = !spreadReady || saveRate === null ? "pending" : saveRate >= GATES.spread.minSaveRate ? "pass" : "fail";
  const share: Verdict = !spreadReady || shareRate === null ? "pending" : shareRate >= GATES.spread.minShareRate ? "pass" : "fail";
  const spread: Verdict = save === "pending" || share === "pending" ? "pending" : save === "pass" && share === "pass" ? "pass" : "fail";

  let quadrant: Quadrant | null = null;
  let strictMismatch = false;
  if (hook !== "pending" && spread !== "pending" && saveShareRate !== null) {
    const up = saveShareRate >= QUADRANT_Y_LINE;
    const right = hook === "pass";
    quadrant = right ? (up ? "breakout" : "saveWeak") : up ? "hookWeak" : "rework";
    strictMismatch = up && spread === "fail";
  }
  return { hook, save, share, spread, quadrant, strictMismatch, saveRate, shareRate, saveShareRate };
}

export interface YtGateResult {
  /** 1차: 유효 조회 비율 */
  hook: Verdict;
  /** 2차: 평균 시청률 */
  finish: Verdict;
  /** 사분면 위치(오른쪽 = 1차 통과, 위 = 2차 통과). 판정 대기면 null */
  quadrant: Quadrant | null;
  engagedRatio: number | null;
  avgViewPct: number | null;
}

export function evaluateYtGates(a: YtAnalyticsMetrics | null): YtGateResult {
  const engaged = engagedRatio(a);
  const avgViewPct = a?.avgViewPct ?? null;
  const ready = !!a && a.views >= YT_GATES.minViews;
  const hook: Verdict = !ready || engaged === null ? "pending" : engaged >= YT_GATES.hook.minEngagedRatio ? "pass" : "fail";
  const finish: Verdict =
    !ready || avgViewPct === null ? "pending" : avgViewPct >= YT_GATES.finish.minAvgViewPct ? "pass" : "fail";
  let quadrant: Quadrant | null = null;
  if (hook !== "pending" && finish !== "pending") {
    const right = hook === "pass";
    const up = finish === "pass";
    quadrant = right ? (up ? "breakout" : "saveWeak") : up ? "hookWeak" : "rework";
  }
  return { hook, finish, quadrant, engagedRatio: engaged, avgViewPct };
}
