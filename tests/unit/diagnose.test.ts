import { describe, expect, it } from "vitest";
import { diagnose, diagnoseYt } from "@/lib/domain/diagnose";
import { evaluateGates, evaluateYtGates } from "@/lib/domain/gates";
import type { IgMetrics, YtAnalyticsMetrics } from "@/lib/domain/types";

const m = (o: Partial<IgMetrics>): IgMetrics => ({
  views: 5000, reach: 4000, saved: 2, shares: 10, comments: 0, likes: 30, avgWatchMs: 12000, skipRate: 36.5, ...o,
});
const run = (o: Partial<IgMetrics>, extra: Partial<Parameters<typeof diagnose>[0]> = {}) => {
  const metrics = m(o);
  return diagnose({ label: "10편", gates: evaluateGates(metrics), skipRate: metrics.skipRate, views: metrics.views, ageHours: 19, ...extra });
};

describe("지금 상황 문장", () => {
  it("훅은 통과, 저장·공유는 미달", () => {
    const d = run({});
    expect(d.tone).toBe("warn");
    expect(d.headline).toBe("10편: 첫 3초는 잡았지만 아직 퍼지지 않는다");
    expect(d.lines[0]).toBe("건너뛰기 36.5%로 1차 관문(45% 이하)을 넘었다.");
    expect(d.lines[1]).toContain("2차 관문(저장 1%·공유 0.5%)에 못 미친다");
    expect(d.next).toContain("저장해 둘 이유");
  });

  it("둘 다 통과면 good", () => {
    const d = run({ saved: 60, shares: 30 });
    expect(d.tone).toBe("good");
    expect(d.headline).toContain("저장·공유도 기준을 넘었다");
  });

  it("훅 미달은 첫 1초를 고치라고 한다", () => {
    const d = run({ skipRate: 58.4, saved: 60, shares: 30 });
    expect(d.lines[0]).toBe("건너뛰기 58.4%로 1차 관문(45% 이하)보다 13.4%p 높다.");
    expect(d.next).toContain("첫 1초");
  });

  it("도달이 적으면 기다린다", () => {
    expect(run({ reach: 120 }).tone).toBe("wait");
  });

  it("최근 변화와 같은 시점 기준편을 말한다", () => {
    const d = run({}, {
      viewsDelta: { from: 4880, to: 5000, abs: 120, windowMinutes: 58 },
      benchmarks: [{ epNo: 5, viewsAtAge: 35_000 }, { epNo: 7, viewsAtAge: null }, { epNo: 9, viewsAtAge: 64_000 }],
    });
    expect(d.lines).toContain("최근 58분 동안 조회 +120.");
    expect(d.lines).toContain("같은 19시간 시점의 5편(3.5만)·9편(6.4만)보다 뒤처진다.");
    const mixed = run({ views: 40_000 }, { benchmarks: [{ epNo: 5, viewsAtAge: 35_000 }, { epNo: 9, viewsAtAge: 64_000 }] });
    expect(mixed.lines.at(-1)).toBe("같은 19시간 시점의 5편(3.5만)보다는 앞서고 9편(6.4만)보다는 뒤처진다.");
  });

  it("72시간이 지났는데 복기가 없으면 복기를 먼저 권한다", () => {
    expect(run({}, { ageHours: 80, retroMissing: true }).next).toContain("복기");
  });
});

describe("유튜브 지금 상황", () => {
  const a = (o: Partial<YtAnalyticsMetrics>): YtAnalyticsMetrics => ({
    views: 1200, engagedViews: 420, avgViewDurationSec: 24, avgViewPct: 75, shares: 1, subscribersGained: 1, ...o,
  });
  const yt = (m: YtAnalyticsMetrics | null, extra: Partial<Parameters<typeof diagnoseYt>[0]> = {}) =>
    diagnoseYt({ label: "10편", gates: evaluateYtGates(m), hasAnalytics: m !== null, views: m?.views ?? 900, ageHours: 30, ...extra });

  it("Analytics 전이면 기다린다", () => {
    const d = yt(null);
    expect(d.tone).toBe("wait");
    expect(d.lines[0]).toContain("24~48시간");
  });

  it("둘 다 통과", () => {
    const d = yt(a({}));
    expect(d.tone).toBe("good");
    expect(d.lines[0]).toBe("유효 조회 비율 35.0%로 1차 관문(30% 이상)을 넘었다.");
    expect(d.lines[1]).toBe("평균 시청률 75.0%로 2차 관문(70% 이상)도 넘었다.");
  });

  it("초반 이탈은 첫 1초를, 끝까지 못 보면 길이를 고치라고 한다", () => {
    expect(yt(a({ engagedViews: 240 })).lines[0]).toBe("유효 조회 비율 20.0%로 1차 관문(30% 이상)보다 10.0%p 낮다.");
    expect(yt(a({ engagedViews: 240 })).next).toContain("첫 1초");
    expect(yt(a({ avgViewPct: 55 })).next).toContain("길이");
  });

  it("조회가 적으면 판정하지 않는다", () => {
    expect(yt(a({ views: 120, engagedViews: 40 })).tone).toBe("wait");
  });
});
