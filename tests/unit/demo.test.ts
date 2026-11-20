import { describe, expect, it } from "vitest";
import { loadDashboard } from "@/lib/data/builders";
import { DemoRepository, getDemoRepository } from "@/lib/data/demo/repository";
import { generateDemoWorld } from "@/lib/data/demo/generate";

const anchor = new Date("2026-11-20T03:00:00Z");

describe("데모 데이터", () => {
  it("같은 기준 시각이면 같은 데이터", () => {
    expect(JSON.stringify(generateDemoWorld(anchor))).toBe(JSON.stringify(generateDemoWorld(anchor)));
  });

  it("홈에 사분면 4칸, △ 예시, 진행 중인 초안이 다 나온다", async () => {
    const d = await loadDashboard(new DemoRepository(generateDemoWorld(anchor)));
    expect(new Set(d.ig.quadrant.map((p) => p.quadrant))).toEqual(new Set(["breakout", "hookWeak", "saveWeak", "rework"]));
    expect(d.ig.quadrant.some((p) => p.strictMismatch)).toBe(true);
    expect(d.ig.latest?.episode).toMatchObject({ status: "draft", autoPaired: true });
    expect(d.ig.latest?.igViewsDelta?.abs).toBeGreaterThan(0);
    expect(d.ig.latest?.benchmarks.every((b) => b.viewsAtAge !== null)).toBe(true);
    expect(d.ig.latest?.episode.yt?.analytics).toBeNull(); // 20시간 된 편은 Analytics 집계 전
    expect(d.ig.kpis.views.compare).toBeGreaterThan(0);
  });

  it("유튜브 탭은 따로 판정한다: 최신 편은 집계 대기, 지난 편들은 관문 지도에", async () => {
    const d = await loadDashboard(new DemoRepository(generateDemoWorld(anchor)));
    expect(d.yt.latest?.episode.key).toBe(d.ig.latest?.episode.key);
    expect(d.yt.diagnosis?.tone).toBe("wait");
    expect(d.yt.diagnosis?.headline).toContain("집계 뒤에");
    expect(d.yt.quadrant.length).toBeGreaterThanOrEqual(8);
    expect(d.yt.excluded.some((e) => e.reason === "Analytics 집계 대기")).toBe(true);
    expect(d.yt.kpis.engagedMedian.value).not.toBeNull();
  });

  it("스냅샷 간격이 실서비스 규칙을 따른다", () => {
    const w = generateDemoWorld(anchor);
    const pts = w.ig["demo-ig-1"];
    const early = pts.filter((p) => p.hours < 6);
    expect(early.length).toBeGreaterThanOrEqual(20);
    const late = pts.filter((p) => p.hours > 200);
    const gaps = late.slice(1).map((p, i) => p.hours - late[i].hours);
    expect(Math.min(...gaps)).toBeGreaterThan(11);
  });

  it("기준 시각은 1시간 단위", () => {
    const repo = getDemoRepository(Date.parse("2026-11-20T03:41:00Z"));
    expect(repo.now().toISOString()).toBe("2026-11-20T03:00:00.000Z");
  });
});
