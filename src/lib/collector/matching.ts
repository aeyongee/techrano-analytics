import { normalizeTitle } from "@/lib/domain/text";
import type { EpisodeKey } from "./types";

const SHORTCODE_RE = /\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/;

export function shortcodeFromPermalink(permalink: string | null | undefined): string | null {
  return permalink?.match(SHORTCODE_RE)?.[1] ?? null;
}

/** 캡션의 첫 번째 비어 있지 않은 줄. insta-stats.py처럼 🦖를 지운다. */
export function captionHead(caption: string | null | undefined): string | null {
  const first = (caption ?? "").split(/\r?\n/).map((l) => l.replace(/🦖/g, "").trim()).find((l) => l.length > 0);
  return first ? first.slice(0, 200) : null;
}

export { normalizeTitle };

export type MatchResult = { episode: EpisodeKey; by: "key" | "title" } | null;

export function matchIgMedia(media: { shortcode: string; captionHead: string | null }, episodes: EpisodeKey[]): MatchResult {
  const byKey = episodes.find((e) => e.igShortcode === media.shortcode);
  if (byKey) return { episode: byKey, by: "key" };
  const head = normalizeTitle(media.captionHead);
  if (!head) return null;
  const byTitle = episodes.filter((e) => !e.igShortcode && e.status !== "archived" && normalizeTitle(e.title) === head);
  return byTitle.length === 1 ? { episode: byTitle[0], by: "title" } : null;
}

export function matchYtVideo(video: { videoId: string; title: string }, episodes: EpisodeKey[]): MatchResult {
  const byKey = episodes.find((e) => e.ytVideoId === video.videoId);
  if (byKey) return { episode: byKey, by: "key" };
  const t = normalizeTitle(video.title);
  if (!t) return null;
  const open = episodes.filter((e) => !e.ytVideoId && e.status !== "archived");
  const exact = open.filter((e) => normalizeTitle(e.title) === t);
  if (exact.length === 1) return { episode: exact[0], by: "title" };
  if (exact.length > 1) return null;
  // 포함 관계는 짧은 제목에서 잘못 붙기 쉬워 둘 다 6자 이상이고 후보가 하나일 때만 쓴다.
  const partial = open.filter((e) => {
    const k = normalizeTitle(e.title);
    return k.length >= 6 && t.length >= 6 && (k.includes(t) || t.includes(k));
  });
  return partial.length === 1 ? { episode: partial[0], by: "title" } : null;
}

export interface PairCandidate {
  episode: EpisodeKey;
  /** IG 게시 시각(IG만 연결된 편) */
  igTime: Date | null;
  /** YT 공개 시각 또는 예약 시각(YT만 연결된 편) */
  ytTime: Date | null;
}

export const AUTO_PAIR_WINDOW_H = 12;

/**
 * 한 플랫폼만 연결된 편끼리, 적어도 한쪽이 초안이고 시각 차가 window 안이며
 * 양쪽 모두 후보가 하나뿐일 때만 짝을 짓는다. source(지울 초안) → target(남길 편).
 */
export function findAutoPairs(cands: PairCandidate[], windowHours = AUTO_PAIR_WINDOW_H): { sourceId: number; targetId: number }[] {
  const live = cands.filter((c) => c.episode.status !== "archived");
  const igOnly = live.filter((c) => c.episode.igShortcode && !c.episode.ytVideoId && c.igTime);
  const ytOnly = live.filter((c) => c.episode.ytVideoId && !c.episode.igShortcode && c.ytTime);
  const windowMs = windowHours * 3_600_000;

  const edges: [PairCandidate, PairCandidate][] = [];
  for (const i of igOnly) {
    for (const y of ytOnly) {
      if (i.episode.status !== "draft" && y.episode.status !== "draft") continue;
      if (Math.abs(i.igTime!.getTime() - y.ytTime!.getTime()) <= windowMs) edges.push([i, y]);
    }
  }
  const degree = new Map<number, number>();
  for (const [i, y] of edges) {
    degree.set(i.episode.id, (degree.get(i.episode.id) ?? 0) + 1);
    degree.set(y.episode.id, (degree.get(y.episode.id) ?? 0) + 1);
  }
  return edges
    .filter(([i, y]) => degree.get(i.episode.id) === 1 && degree.get(y.episode.id) === 1)
    .map(([i, y]) =>
      y.episode.status === "draft"
        ? { sourceId: y.episode.id, targetId: i.episode.id }
        : { sourceId: i.episode.id, targetId: y.episode.id },
    );
}
