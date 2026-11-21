import { describe, expect, it } from "vitest";
import { planSeed, type ExistingEpisode } from "@/lib/seed/plan";
import type { ReadmeEpisode } from "@/lib/seed/readme";

const row = (epNo: number, title: string, ig: string | null = null, yt: string | null = null): ReadmeEpisode => ({
  epNo, title, slug: `slug-${epNo}`, lengthSec: 30, igShortcode: ig, ytVideoId: yt, igPostedKst: null, ytPostedKst: null,
});
const ep = (id: number, e: Partial<ExistingEpisode>): ExistingEpisode => ({
  id, epNo: null, title: "", status: "draft", igShortcode: null, ytVideoId: null, ...e,
});

describe("planSeed", () => {
  it("링크가 있는 새 행은 게시된 편으로 넣는다", () => {
    expect(planSeed([row(1, "첫 편", "IG1", "ytvideo0001")], [])).toEqual([
      { kind: "insert", note: "게시된 편", fields: { ep_no: 1, title: "첫 편", slug: "slug-1", length_sec: 30, status: "published", ig_shortcode: "IG1", yt_video_id: "ytvideo0001" } },
    ]);
  });

  it("링크가 없는 행은 이미 있는 편의 연결·상태를 건드리지 않는다", () => {
    const [a] = planSeed([row(11, "열한 번째")], [ep(12, { epNo: 11, title: "열한 번째", status: "published", igShortcode: "IG11", ytVideoId: "ytvideo0011" })]);
    expect(a).toMatchObject({ kind: "update", id: 12 });
    expect(a.kind === "update" && a.fields).toEqual({ ep_no: 11, title: "열한 번째", slug: "slug-11", length_sec: 30 });
  });

  it("링크가 없는 새 행은 예정 편(초안)으로 넣는다", () => {
    expect(planSeed([row(12, "열두 번째")], [])[0]).toMatchObject({ kind: "insert", fields: { ep_no: 12, status: "draft" } });
  });

  it("제목이 같은 번호 없는 초안이 있으면 그 초안에 번호를 붙인다", () => {
    const drafts = [ep(30, { title: "열두 번째 편이다 🦖 #태그", ytVideoId: "ytvideo0012" })];
    const [a] = planSeed([row(12, "열두 번째 편이다")], drafts);
    expect(a).toMatchObject({ kind: "update", id: 30, fields: { ep_no: 12 } });
    expect(a.kind === "update" && a.fields.status).toBeUndefined(); // 공개 여부는 수집기가 보고 바꾼다
  });

  it("README 링크를 가진 번호 없는 초안은 이 편으로 확정한다", () => {
    const [a] = planSeed([row(11, "열한 번째", "IG11")], [ep(12, { title: "캡션", igShortcode: "IG11" })]);
    expect(a).toMatchObject({ kind: "update", id: 12, fields: { ep_no: 11, status: "published", ig_shortcode: "IG11" } });
  });

  it("README 링크가 다른 번호 편에 붙어 있으면 건너뛴다", () => {
    const existing = [ep(1, { epNo: 11, title: "열한 번째", status: "published" }), ep(2, { title: "캡션", igShortcode: "IG11" })];
    expect(planSeed([row(11, "열한 번째", "IG11")], existing)[0].kind).toBe("skip");
  });
});
