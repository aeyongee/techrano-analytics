import { findAutoPairs, matchIgMedia, matchYtVideo } from "./matching";
import type { EpisodeKey, IgMediaState, SyncState, SyncStore, YtVideoState } from "./types";

export type AttachResult = "linked" | "matched" | "draft" | "skipped";

/** 새로 본 릴스를 편에 붙인다: 이미 연결됨 → 제목으로 연결 → 못 찾으면 초안 */
export async function attachIgMedia(store: SyncStore, state: SyncState, media: IgMediaState): Promise<AttachResult> {
  if (!media.isTracked) return "skipped";
  const match = matchIgMedia(media, state.episodes);
  if (match?.by === "key") return "linked";
  if (match) {
    await store.linkEpisode(match.episode.id, "ig", media.shortcode);
    match.episode.igShortcode = media.shortcode;
    return "matched";
  }
  const title = media.captionHead ?? "(제목 없음)";
  const id = await store.createDraftEpisode({ title, igShortcode: media.shortcode });
  state.episodes.push({ id, epNo: null, title, status: "draft", igShortcode: media.shortcode, ytVideoId: null });
  return "draft";
}

export async function attachYtVideo(store: SyncStore, state: SyncState, video: YtVideoState): Promise<AttachResult> {
  if (!video.isTracked) return "skipped";
  const match = matchYtVideo(video, state.episodes);
  if (match?.by === "key") return "linked";
  if (match) {
    await store.linkEpisode(match.episode.id, "yt", video.videoId);
    match.episode.ytVideoId = video.videoId;
    return "matched";
  }
  const id = await store.createDraftEpisode({ title: video.title, ytVideoId: video.videoId });
  state.episodes.push({ id, epNo: null, title: video.title, status: "draft", igShortcode: null, ytVideoId: video.videoId });
  return "draft";
}

/** 한쪽 플랫폼만 붙은 초안을 반대쪽 편과 합친다. 합친 수를 돌려준다. */
export async function autoPairDrafts(store: SyncStore, state: SyncState): Promise<number> {
  const igByShortcode = new Map([...state.ig.values()].map((m) => [m.shortcode, m]));
  const pairs = findAutoPairs(
    state.episodes.map((episode) => {
      const yt = episode.ytVideoId ? state.yt.get(episode.ytVideoId) : undefined;
      return {
        episode,
        igTime: episode.igShortcode ? igByShortcode.get(episode.igShortcode)?.postedAt ?? null : null,
        ytTime: yt ? yt.publishedAt ?? yt.scheduledAt : null,
      };
    }),
  );
  for (const { sourceId, targetId } of pairs) {
    await store.mergeEpisodes(sourceId, targetId, true);
    const source = state.episodes.find((e) => e.id === sourceId) as EpisodeKey;
    const target = state.episodes.find((e) => e.id === targetId) as EpisodeKey;
    target.igShortcode ??= source.igShortcode;
    target.ytVideoId ??= source.ytVideoId;
    state.episodes.splice(state.episodes.indexOf(source), 1);
  }
  return pairs.length;
}

/**
 * 번호를 미리 받은 예정 편(시드가 README 행으로 만든 초안)에 실제로 공개된 게시물이 붙으면 게시된 편으로 바꾼다.
 * 인스타는 게시된 릴스만 보이고, 유튜브는 예약(private) 동안 기다렸다가 public이 되면 바꾼다. 바꾼 수를 돌려준다.
 */
export async function publishNumberedDrafts(store: SyncStore, state: SyncState): Promise<number> {
  const igShortcodes = new Set([...state.ig.values()].map((m) => m.shortcode));
  let published = 0;
  for (const ep of state.episodes) {
    if (ep.status !== "draft" || ep.epNo === null) continue;
    const igLive = ep.igShortcode !== null && igShortcodes.has(ep.igShortcode);
    const ytLive = ep.ytVideoId !== null && state.yt.get(ep.ytVideoId)?.privacyStatus === "public";
    if (!igLive && !ytLive) continue;
    await store.publishEpisode(ep.id);
    ep.status = "published";
    published++;
  }
  return published;
}
