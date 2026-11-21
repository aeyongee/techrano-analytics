/**
 * README 편 목록 행을 DB의 편 행에 어떻게 쓸지 정한다(시드 스크립트가 쓴다).
 *
 * - 링크가 있는 행: 게시된 편. 번호로 찾고, 없으면 그 링크를 가진 번호 없는 초안을 이 편으로 확정한다.
 * - 링크가 없는 행(아직 주소를 안 적은 편): 이미 있으면 메타만 고친다. 없으면 제목이 같은 번호 없는 초안을
 *   이 편으로 바꾸고, 그것도 없으면 번호만 받은 예정 편(초안)으로 만든다. 게시물이 붙고 공개되면 수집기가 게시로 바꾼다.
 * - 플랫폼 키는 README에 값이 있을 때만 보낸다. 수집기가 붙인 연결을 null로 지우지 않기 위해서다.
 */
import { normalizeTitle } from "@/lib/domain/text";
import type { ReadmeEpisode } from "./readme";

export interface ExistingEpisode {
  id: number;
  epNo: number | null;
  title: string;
  status: "draft" | "published" | "archived";
  igShortcode: string | null;
  ytVideoId: string | null;
}

/** 편 행에 쓸 값. 없는 필드는 보내지 않는다. */
export type EpisodeFields = {
  ep_no: number;
  title: string;
  slug: string | null;
  length_sec: number | null;
  status?: "draft" | "published";
  ig_shortcode?: string;
  yt_video_id?: string;
};

export type SeedAction =
  | { kind: "insert"; fields: EpisodeFields; note: string }
  | { kind: "update"; id: number; fields: EpisodeFields; note: string }
  | { kind: "skip"; note: string };

const looseDrafts = (rows: ExistingEpisode[]) => rows.filter((e) => e.status === "draft" && e.epNo === null);

/** 수집기 matchYtVideo와 같은 기준: 정규화 제목이 같거나, 둘 다 6자 이상이고 포함 관계. 후보가 하나일 때만. */
function draftByTitle(title: string, drafts: ExistingEpisode[]): ExistingEpisode | null {
  const t = normalizeTitle(title);
  if (!t) return null;
  const exact = drafts.filter((d) => normalizeTitle(d.title) === t);
  if (exact.length) return exact.length === 1 ? exact[0] : null;
  const partial = drafts.filter((d) => {
    const k = normalizeTitle(d.title);
    return k.length >= 6 && t.length >= 6 && (k.includes(t) || t.includes(k));
  });
  return partial.length === 1 ? partial[0] : null;
}

export function planSeed(readme: ReadmeEpisode[], existing: ExistingEpisode[]): SeedAction[] {
  const rows = existing.map((e) => ({ ...e }));
  return readme.map((r) => {
    const base: EpisodeFields = { ep_no: r.epNo, title: r.title, slug: r.slug, length_sec: r.lengthSec };
    const byNo = rows.find((e) => e.epNo === r.epNo);
    const hasLink = Boolean(r.igShortcode || r.ytVideoId);

    if (hasLink) {
      const fields: EpisodeFields = {
        ...base,
        status: "published",
        ...(r.igShortcode && { ig_shortcode: r.igShortcode }),
        ...(r.ytVideoId && { yt_video_id: r.ytVideoId }),
      };
      const holders = rows.filter(
        (e) => e !== byNo && ((r.igShortcode && e.igShortcode === r.igShortcode) || (r.ytVideoId && e.ytVideoId === r.ytVideoId)),
      );
      if (holders.length) {
        const draft = holders.length === 1 && holders[0].status === "draft" && holders[0].epNo === null ? holders[0] : null;
        if (!draft || byNo) return { kind: "skip", note: "README의 링크가 다른 편에 붙어 있다. 관리 화면에서 합친 뒤 다시 시드한다" };
        draft.epNo = r.epNo;
        return { kind: "update", id: draft.id, fields, note: "수집기 초안을 이 편으로 확정" };
      }
      if (byNo) return { kind: "update", id: byNo.id, fields, note: "게시된 편" };
      rows.push({ id: -1, epNo: r.epNo, title: r.title, status: "published", igShortcode: r.igShortcode, ytVideoId: r.ytVideoId });
      return { kind: "insert", fields, note: "게시된 편" };
    }

    if (byNo) return { kind: "update", id: byNo.id, fields: base, note: byNo.status === "draft" ? "예정 편" : "링크 없음(연결 유지)" };
    const draft = draftByTitle(r.title, looseDrafts(rows));
    if (draft) {
      draft.epNo = r.epNo;
      return { kind: "update", id: draft.id, fields: base, note: "제목이 같은 수집기 초안에 번호를 붙임" };
    }
    rows.push({ id: -1, epNo: r.epNo, title: r.title, status: "draft", igShortcode: null, ytVideoId: null });
    return { kind: "insert", fields: { ...base, status: "draft" }, note: "예정 편(게시되면 자동 연결)" };
  });
}
