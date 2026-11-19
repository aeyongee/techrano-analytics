import { describe, expect, it } from "vitest";
import { parseIgTimestamp, parseInsightsData, toIgMetrics, usagePercent } from "@/lib/collector/instagram/parse";
import { kstDate, parseAnalyticsReport, parseIsoDuration, toVideoState } from "@/lib/collector/youtube/parse";

describe("인스타 응답", () => {
  it("+0000 형식 시각을 읽는다", () => {
    expect(parseIgTimestamp("2026-11-19T09:30:12+0000").toISOString()).toBe("2026-11-19T09:30:12.000Z");
    expect(parseIgTimestamp("2026-11-19T18:30:12+0900").toISOString()).toBe("2026-11-19T09:30:12.000Z");
  });

  it("values[0].value와 total_value.value를 모두 읽는다", () => {
    const parsed = parseInsightsData([
      { name: "views", period: "lifetime", values: [{ value: 3279 }] },
      { name: "reels_skip_rate", total_value: { value: 37.84 } },
      { name: "ig_reels_avg_watch_time", values: [{ value: 13012 }] },
      { name: "saved", values: [{ value: { breakdown: 1 } }] },
    ]);
    expect(parsed).toEqual({ views: 3279, reels_skip_rate: 37.84, ig_reels_avg_watch_time: 13012, saved: null });
    expect(toIgMetrics(parsed)).toMatchObject({ views: 3279, skipRate: 37.84, avgWatchMs: 13012, saved: null, reach: null });
  });

  it("사용량 헤더에서 가장 높은 비율을 고른다", () => {
    const headers = new Headers({
      "x-app-usage": JSON.stringify({ call_count: 12, total_time: 3, total_cputime: 2 }),
      "x-business-use-case-usage": JSON.stringify({ "1789": [{ type: "instagram", call_count: 81, total_time: 5 }] }),
    });
    expect(usagePercent(headers)).toBe(81);
    expect(usagePercent(new Headers())).toBeNull();
  });
});

describe("유튜브 응답", () => {
  it("ISO8601 길이를 초로 바꾼다", () => {
    expect(parseIsoDuration("PT27S")).toBe(27);
    expect(parseIsoDuration("PT1M5S")).toBe(65);
    expect(parseIsoDuration("PT1H")).toBe(3600);
    expect(parseIsoDuration("P0D")).toBe(0);
    expect(parseIsoDuration("bogus")).toBeNull();
  });

  it("예약 공개 영상은 public이 될 때까지 published_at이 없다", () => {
    const scheduled = toVideoState({
      id: "kikI-XPeJIY",
      snippet: { title: "킥보드", publishedAt: "2026-11-18T01:00:00Z" },
      contentDetails: { duration: "PT28S" },
      status: { privacyStatus: "private", publishAt: "2026-11-19T09:00:00Z" },
    });
    expect(scheduled).toMatchObject({ privacyStatus: "private", publishedAt: null, durationSec: 28 });
    expect(scheduled.scheduledAt?.toISOString()).toBe("2026-11-19T09:00:00.000Z");

    const live = toVideoState(
      { id: "kikI-XPeJIY", snippet: { title: "킥보드", publishedAt: "2026-11-19T09:00:00Z" }, status: { privacyStatus: "public" } },
      scheduled,
    );
    expect(live.publishedAt?.toISOString()).toBe("2026-11-19T09:00:00.000Z");
  });

  it("Analytics 보고서를 영상별로 나눈다", () => {
    const map = parseAnalyticsReport({
      columnHeaders: [
        { name: "video" }, { name: "views" }, { name: "engagedViews" }, { name: "averageViewDuration" },
        { name: "averageViewPercentage" }, { name: "shares" }, { name: "subscribersGained" },
      ],
      rows: [["abcDEF12345", 1128, 296, 25, 68.5, 0, 3]],
    });
    expect(map.get("abcDEF12345")).toEqual({
      views: 1128, engagedViews: 296, avgViewDurationSec: 25, avgViewPct: 68.5, shares: 0, subscribersGained: 3,
    });
  });

  it("endDate는 한국 날짜", () => {
    expect(kstDate(new Date("2026-11-19T16:30:00Z"))).toBe("2026-11-20");
  });
});
