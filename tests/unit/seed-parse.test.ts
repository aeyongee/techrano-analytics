import { describe, expect, it } from "vitest";
import { parseEpisodeTable } from "@/lib/seed/readme";

// 실제 표와 같은 모양의 가상 데이터
const README = `# 편 목록

설명 문단.

| 번호 | 제목 | slug · 컴포지션 | 길이 | 출연진 | 표지 프레임 | 인스타 | 유튜브 |
|---|---|---|---|---|---|---|---|
| 01 | 가상 첫 편 | demo-first · \`DemoFirst\` | 25초 | 가, 나 | 표지 없음 | 2026-01-02 15:54 [릴스](https://www.instagram.com/reel/AbC_def-123/) | 2026-01-02 18:03 [쇼츠](https://youtube.com/shorts/abcDEF12345) |
| 02 | 가상 둘째 편 | demo-second · \`DemoSecond\` | 29.95초 | 가 | | | 2026-01-03 12:24 [쇼츠](https://www.youtube.com/watch?v=zyxWVU98765) |
| 03 | 링크 없는 편 | demo-third | 30초 | 가 | | | |

- 표 아래 메모
`;

describe("parseEpisodeTable", () => {
  const rows = parseEpisodeTable(README);

  it("표의 행을 모두 읽는다", () => {
    expect(rows.map((r) => r.epNo)).toEqual([1, 2, 3]);
  });

  it("shortcode·videoId·slug·길이를 뽑는다", () => {
    expect(rows[0]).toEqual({
      epNo: 1,
      title: "가상 첫 편",
      slug: "demo-first",
      lengthSec: 25,
      igShortcode: "AbC_def-123",
      ytVideoId: "abcDEF12345",
      igPostedKst: "2026-01-02 15:54",
      ytPostedKst: "2026-01-02 18:03",
    });
    expect(rows[1]).toMatchObject({ lengthSec: 29.95, igShortcode: null, ytVideoId: "zyxWVU98765" });
  });

  it("링크가 없으면 null", () => {
    expect(rows[2]).toMatchObject({ slug: "demo-third", igShortcode: null, ytVideoId: null });
  });

  it("필요한 열이 없으면 알려 준다", () => {
    expect(() => parseEpisodeTable("| 번호 | 제목 |\n|---|---|\n| 01 | x |")).toThrow(/slug/);
  });
});
