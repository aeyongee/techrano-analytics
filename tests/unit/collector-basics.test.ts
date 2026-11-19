import { describe, expect, it } from "vitest";
import { captionHead, findAutoPairs, matchIgMedia, matchYtVideo, normalizeTitle, shortcodeFromPermalink } from "@/lib/collector/matching";
import { redact, redactAndTrim } from "@/lib/collector/redact";
import { dataIntervalMinutes, isAnalyticsDue, isDataDue } from "@/lib/collector/schedule";
import type { EpisodeKey } from "@/lib/collector/types";

const H = 3_600_000;
const now = new Date("2026-11-20T00:00:00Z");
const ago = (hours: number) => new Date(now.getTime() - hours * H);

// 토큰 모양 문자열은 실행할 때 만든다(레포에 그대로 두면 비밀값 스캔에 걸린다).
const fake = (prefix: string) => prefix + "abcdefghijklmnopqrstuvwxyz0123";

describe("redact", () => {
  it("쿼리·JSON·헤더의 토큰을 가린다", () => {
    const text =
      `GET https://graph.facebook.com/1/insights?metric=views&access_token=${fake("EAA")} failed; ` +
      `{"refresh_token":"${fake("1//0")}","client_secret":"${fake("GOCSPX-")}"} Authorization: Bearer ${fake("ya29.")}`;
    const out = redact(text);
    expect(out).not.toMatch(/abcdefghijklmnop/);
    expect(out).toContain("access_token=[redacted]");
    expect(out).toContain('"refresh_token":"[redacted]"');
  });

  it("길면 자른다", () => {
    expect(redactAndTrim("x".repeat(500), 300)).toHaveLength(300);
  });
});

describe("수집 간격", () => {
  it.each([
    [0.5, 15],
    [5.9, 15],
    [6, 60],
    [71, 60],
    [72, 180],
    [200, 720],
    [800, 1440],
  ])("경과 %s시간 → %s분", (age, min) => {
    expect(dataIntervalMinutes(age)).toBe(min);
  });

  it("처음이면 바로, 간격에서 5분 모자라도 수집한다", () => {
    expect(isDataDue({ postedAt: ago(2), lastSnapshotAt: null, now })).toBe(true);
    expect(isDataDue({ postedAt: ago(2), lastSnapshotAt: new Date(now.getTime() - 10 * 60_000), now })).toBe(true);
    expect(isDataDue({ postedAt: ago(2), lastSnapshotAt: new Date(now.getTime() - 9 * 60_000), now })).toBe(false);
    expect(isDataDue({ postedAt: ago(30), lastSnapshotAt: new Date(now.getTime() - 30 * 60_000), now })).toBe(false);
  });

  it("force는 30일 이내만 간격을 무시한다", () => {
    const last = new Date(now.getTime() - 60_000);
    expect(isDataDue({ postedAt: ago(100), lastSnapshotAt: last, now, force: true })).toBe(true);
    expect(isDataDue({ postedAt: ago(800), lastSnapshotAt: last, now, force: true })).toBe(false);
  });

  it("Analytics는 20시간 전에는 묻지 않고, 집계 전이면 3시간마다", () => {
    expect(isAnalyticsDue({ publishedAt: ago(10), analyticsCheckedAt: null, analyticsReadyAt: null, now, force: true })).toBe(false);
    expect(isAnalyticsDue({ publishedAt: ago(30), analyticsCheckedAt: ago(2), analyticsReadyAt: null, now })).toBe(false);
    expect(isAnalyticsDue({ publishedAt: ago(30), analyticsCheckedAt: ago(3), analyticsReadyAt: null, now })).toBe(true);
    expect(isAnalyticsDue({ publishedAt: ago(30), analyticsCheckedAt: ago(3), analyticsReadyAt: ago(5), now })).toBe(false);
  });
});

describe("매칭", () => {
  const eps: EpisodeKey[] = [
    { id: 1, epNo: 5, title: "댓글 하나로 사이트가 털리는 이유", status: "published", igShortcode: "AAA111", ytVideoId: "aaaaaaaaaaa" },
    { id: 2, epNo: 6, title: "개발자 커플의 오늘 뭐먹지?", status: "published", igShortcode: null, ytVideoId: null },
  ];

  it("shortcode와 캡션 첫 줄을 뽑는다", () => {
    expect(shortcodeFromPermalink("https://www.instagram.com/reel/Df6sl2cSlis/")).toBe("Df6sl2cSlis");
    expect(shortcodeFromPermalink("https://www.instagram.com/p/AbC-_1/")).toBe("AbC-_1");
    expect(captionHead("\n🦖 개발자 커플의 오늘 뭐먹지?\n\n본문 #해시")).toBe("개발자 커플의 오늘 뭐먹지?");
  });

  it("제목 정규화는 해시태그·기호·대소문자를 무시한다", () => {
    expect(normalizeTitle("개발자 커플의 오늘 뭐먹지? #shorts #AI")).toBe(normalizeTitle("개발자커플의 오늘뭐먹지"));
  });

  it("키가 우선이고, 없으면 제목으로 연결한다", () => {
    expect(matchIgMedia({ shortcode: "AAA111", captionHead: "다른 제목" }, eps)).toMatchObject({ by: "key", episode: { id: 1 } });
    expect(matchIgMedia({ shortcode: "BBB222", captionHead: "🦖 개발자 커플의 오늘 뭐먹지?" }, eps)).toMatchObject({ by: "title", episode: { id: 2 } });
    expect(matchIgMedia({ shortcode: "CCC333", captionHead: "새 편" }, eps)).toBeNull();
    expect(matchYtVideo({ videoId: "bbbbbbbbbbb", title: "개발자 커플의 오늘 뭐먹지? #shorts" }, eps)).toMatchObject({ episode: { id: 2 } });
  });

  it("짧은 제목은 포함 관계로 연결하지 않는다", () => {
    expect(matchYtVideo({ videoId: "ccccccccccc", title: "뭐먹지" }, eps)).toBeNull();
  });
});

describe("자동 짝짓기", () => {
  const ep = (id: number, status: EpisodeKey["status"], ig: string | null, yt: string | null): EpisodeKey => ({
    id, epNo: status === "draft" ? null : id, title: `편 ${id}`, status, igShortcode: ig, ytVideoId: yt,
  });

  it("12시간 안의 IG 초안과 YT 초안을 YT → IG로 합친다", () => {
    const pairs = findAutoPairs([
      { episode: ep(10, "draft", "IG10", null), igTime: ago(1), ytTime: null },
      { episode: ep(11, "draft", null, "yt000000011"), igTime: null, ytTime: ago(1.2) },
    ]);
    expect(pairs).toEqual([{ sourceId: 11, targetId: 10 }]);
  });

  it("확정 편(IG만)과 YT 초안은 초안을 확정 편으로", () => {
    const pairs = findAutoPairs([
      { episode: ep(10, "published", "IG10", null), igTime: ago(1), ytTime: null },
      { episode: ep(11, "draft", null, "yt000000011"), igTime: null, ytTime: ago(-5) },
    ]);
    expect(pairs).toEqual([{ sourceId: 11, targetId: 10 }]);
  });

  it("후보가 둘이거나 시간이 멀면 짝짓지 않는다", () => {
    expect(
      findAutoPairs([
        { episode: ep(10, "draft", "IG10", null), igTime: ago(1), ytTime: null },
        { episode: ep(11, "draft", null, "yt000000011"), igTime: null, ytTime: ago(2) },
        { episode: ep(12, "draft", null, "yt000000012"), igTime: null, ytTime: ago(3) },
      ]),
    ).toEqual([]);
    expect(
      findAutoPairs([
        { episode: ep(10, "draft", "IG10", null), igTime: ago(1), ytTime: null },
        { episode: ep(11, "draft", null, "yt000000011"), igTime: null, ytTime: ago(20) },
      ]),
    ).toEqual([]);
  });

  it("둘 다 확정 편이면 건드리지 않는다", () => {
    expect(
      findAutoPairs([
        { episode: ep(10, "published", "IG10", null), igTime: ago(1), ytTime: null },
        { episode: ep(11, "published", null, "yt000000011"), igTime: null, ytTime: ago(1) },
      ]),
    ).toEqual([]);
  });
});
