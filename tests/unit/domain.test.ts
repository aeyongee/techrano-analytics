import { describe, expect, it } from "vitest";
import { deltaNear } from "@/lib/domain/delta";
import { formatAge, formatCount, formatKst, formatRate, formatRelative, formatSignedCount } from "@/lib/domain/format";
import { evaluateGates } from "@/lib/domain/gates";
import { engagedRatio, median } from "@/lib/domain/metrics";
import { gridFor, resample, valueAt } from "@/lib/domain/resample";
import type { IgMetrics } from "@/lib/domain/types";

const m = (o: Partial<IgMetrics>): IgMetrics => ({
  views: 10_000, reach: 8_000, saved: 0, shares: 0, comments: 0, likes: 0, avgWatchMs: 12_000, skipRate: 40, ...o,
});

describe("2단계 관문", () => {
  it("건너뛰기 45.0%는 통과, 45.1%는 미달", () => {
    expect(evaluateGates(m({ skipRate: 45 })).hook).toBe("pass");
    expect(evaluateGates(m({ skipRate: 45.1 })).hook).toBe("fail");
  });

  it("저장 1.0%·공유 0.5%는 통과, 하나라도 모자라면 미달", () => {
    expect(evaluateGates(m({ reach: 1000, saved: 10, shares: 5 })).spread).toBe("pass");
    const r = evaluateGates(m({ reach: 1000, saved: 10, shares: 4 }));
    expect([r.save, r.share, r.spread]).toEqual(["pass", "fail", "fail"]);
  });

  it("도달이 적으면 판정 대기", () => {
    expect(evaluateGates(m({ reach: 199 })).hook).toBe("pending");
    expect(evaluateGates(m({ reach: 499, saved: 50, shares: 50 })).spread).toBe("pending");
    expect(evaluateGates(m({ reach: 499 })).quadrant).toBeNull();
    expect(evaluateGates(m({ skipRate: null })).hook).toBe("pending");
  });

  it("사분면은 건너뛰기 45%와 저장+공유 1.5% 선으로 나눈다", () => {
    expect(evaluateGates(m({ skipRate: 38, saved: 120, shares: 60 })).quadrant).toBe("breakout"); // 1.5% + 0.75%
    expect(evaluateGates(m({ skipRate: 55, saved: 120, shares: 60 })).quadrant).toBe("hookWeak");
    expect(evaluateGates(m({ skipRate: 38, saved: 8, shares: 4 })).quadrant).toBe("saveWeak");
    expect(evaluateGates(m({ skipRate: 57, saved: 8, shares: 4 })).quadrant).toBe("rework");
  });

  it("선 위인데 공유가 모자라면 △", () => {
    const r = evaluateGates(m({ reach: 1000, saved: 14, shares: 2, skipRate: 40 })); // 1.4 + 0.2 = 1.6
    expect(r.quadrant).toBe("breakout");
    expect(r.spread).toBe("fail");
    expect(r.strictMismatch).toBe(true);
  });
});

describe("리샘플링", () => {
  const pts = [
    { hours: 1, value: 1000 },
    { hours: 2, value: 1500 },
    { hours: 10, value: 2000 },
  ];

  it("사이를 선형 보간하고 범위 밖은 null", () => {
    const out = resample(pts, [0.5, 1, 1.5, 2, 3], { maxGapHours: 6, anchorZero: false });
    expect(out).toEqual([null, 1000, 1250, 1500, null]); // 2→10은 8시간 간격이라 끊는다
  });

  it("누적 지표는 T+0을 0으로 둔다", () => {
    expect(resample(pts, [0, 0.5], { maxGapHours: 6, anchorZero: true })).toEqual([0, 500]);
  });

  it("valueAt은 한 시점만 본다", () => {
    expect(valueAt(pts, 1.5, { maxGapHours: 6, anchorZero: false })).toBe(1250);
  });

  it("창마다 격자가 다르다", () => {
    expect(gridFor("24h")).toHaveLength(97);
    expect(gridFor("72h").at(-1)).toBe(72);
    expect(gridFor("7d")).toHaveLength(57);
  });
});

describe("델타", () => {
  const at = (min: number, value: number | null) => ({ capturedAt: new Date(Date.UTC(2026, 10, 20, 0, min)).toISOString(), value });

  it("1시간 전에 가장 가까운 스냅샷과 비교한다", () => {
    expect(deltaNear([at(0, 1000), at(15, 1050), at(58, 1120), at(118, 1240)])).toEqual({
      from: 1120, to: 1240, abs: 120, windowMinutes: 60,
    });
  });

  it("40분~3시간 안에 비교할 점이 없으면 없다", () => {
    expect(deltaNear([at(0, 1000), at(20, 1100)])).toBeNull();
    expect(deltaNear([at(0, 1000), at(300, 1100)])).toBeNull();
  });
});

describe("표기", () => {
  it("만 단위", () => {
    expect(formatCount(8640)).toBe("8,640");
    expect(formatCount(12_000)).toBe("1.2만");
    expect(formatCount(32_150)).toBe("3.2만");
    expect(formatCount(20_000)).toBe("2만");
    expect(formatCount(1_280_000)).toBe("128만");
    expect(formatSignedCount(-3)).toBe("−3");
    expect(formatSignedCount(120)).toBe("+120");
  });

  it("비율·경과·시각", () => {
    expect(formatRate(0.6667)).toBe("0.67%");
    expect(formatAge(0.75)).toBe("45분");
    expect(formatAge(18.4)).toBe("18시간");
    expect(formatAge(78)).toBe("3일 6시간");
    expect(formatKst("2026-11-20T21:15:00Z")).toBe("11/21(토) 06:15");
    expect(formatRelative("2026-11-20T00:00:00Z", "2026-11-20T00:12:00Z")).toBe("12분 전");
  });

  it("중앙값과 참여 조회율", () => {
    expect(median([3, null, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(engagedRatio({ views: 1000, engagedViews: 300 })).toBe(30);
  });
});
