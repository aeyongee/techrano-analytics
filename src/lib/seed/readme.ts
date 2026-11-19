/**
 * Techrano 레포의 `업로드/README.md` 편 목록 표를 읽는다.
 * 열 순서가 바뀌어도 되도록 머리글 이름으로 위치를 찾는다.
 */
export interface ReadmeEpisode {
  epNo: number;
  title: string;
  slug: string | null;
  lengthSec: number | null;
  igShortcode: string | null;
  ytVideoId: string | null;
  /** 표에 적힌 게시 시각(KST 문자열). 확인용으로만 쓰고, 저장하는 게시 시각은 API 값이다. */
  igPostedKst: string | null;
  ytPostedKst: string | null;
}

const COLUMNS = {
  epNo: (h: string) => h === "번호",
  title: (h: string) => h === "제목",
  slug: (h: string) => h.startsWith("slug"),
  length: (h: string) => h === "길이",
  ig: (h: string) => h === "인스타",
  yt: (h: string) => h === "유튜브",
} as const;

const IG_RE = /\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/;
const YT_RE = /(?:shorts\/|v=|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const TIME_RE = /(\d{4}-\d{2}-\d{2} \d{2}:\d{2})/;

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

export function parseEpisodeTable(markdown: string): ReadmeEpisode[] {
  const lines = markdown.split(/\r?\n/);
  const headerAt = lines.findIndex((l) => l.trim().startsWith("|") && cells(l).includes("번호") && cells(l).includes("제목"));
  if (headerAt < 0) throw new Error("편 목록 표(번호·제목 머리글)를 찾지 못했다.");

  const header = cells(lines[headerAt]);
  const index = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, test]) => [key, header.findIndex((h) => test(h))]),
  ) as Record<keyof typeof COLUMNS, number>;
  const missing = Object.entries(index).filter(([, i]) => i < 0).map(([k]) => k);
  if (missing.length) throw new Error(`편 목록 표에 필요한 열이 없다: ${missing.join(", ")}`);

  const out: ReadmeEpisode[] = [];
  for (const line of lines.slice(headerAt + 2)) {
    if (!line.trim().startsWith("|")) break;
    const row = cells(line);
    const epNo = Number.parseInt(row[index.epNo], 10);
    if (!Number.isFinite(epNo)) continue;
    const slugCell = row[index.slug] ?? "";
    const slug = slugCell.split("·")[0]?.trim().replace(/`/g, "") || null;
    const length = (row[index.length] ?? "").match(/([\d.]+)\s*초/);
    const igCell = row[index.ig] ?? "";
    const ytCell = row[index.yt] ?? "";
    out.push({
      epNo,
      title: row[index.title],
      slug,
      lengthSec: length ? Number(length[1]) : null,
      igShortcode: igCell.match(IG_RE)?.[1] ?? null,
      ytVideoId: ytCell.match(YT_RE)?.[1] ?? null,
      igPostedKst: igCell.match(TIME_RE)?.[1] ?? null,
      ytPostedKst: ytCell.match(TIME_RE)?.[1] ?? null,
    });
  }
  return out;
}

/** seed/episodes.local.json 형식. 키는 편 번호. 없는 필드는 DB 값을 건드리지 않는다. */
export interface EpisodeMetaFile {
  episodes: Record<
    string,
    { series?: string; topic?: string; isTrueStory?: boolean; hookDesc?: string; hypothesis?: string; notes?: string }
  >;
}
