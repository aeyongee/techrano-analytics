import type { SyncContext } from "../context";
import { saveCovers } from "../covers";
import { attachIgMedia } from "../episodes";
import { HttpError } from "../http";
import { mapLimit } from "../limit";
import { captionHead, shortcodeFromPermalink } from "../matching";
import { ageHours, isDataDue } from "../schedule";
import type { IgMediaState, IgSnapshotInput, PlatformSummary, SyncState, SyncStore } from "../types";
import { IgMissingMediaError, IgRateLimitError, type InstagramClient } from "./client";
import { IG_METRICS, parseIgTimestamp, toIgMetrics } from "./parse";

const PROBE_EVERY_MS = 7 * 24 * 3_600_000;
const USAGE_LIMIT = 80;
const MISSING_LIMIT = 3;

export interface IgDeps {
  client: InstagramClient;
  store: SyncStore;
  state: SyncState;
  igUserId: string;
  runId: number | null;
  /** 가장 최근 응답의 사용률(%). 클라이언트 onUsage가 채운다. */
  usage: { percent: number | null };
}

export async function discoverInstagram(ctx: SyncContext, d: IgDeps): Promise<{ newMedia: number; drafts: number }> {
  const known = new Set([...d.state.ig.values()].map((m) => m.shortcode));
  const seededMissing = d.state.episodes.some((e) => e.igShortcode && !known.has(e.igShortcode));
  const all = ctx.discoverAll || d.state.ig.size === 0 || seededMissing;
  const items = await d.client.listReels(d.igUserId, { all });

  const rows: IgMediaState[] = [];
  const thumbs = new Map<string, string>();
  let newMedia = 0;
  for (const item of items) {
    const shortcode = shortcodeFromPermalink(item.permalink);
    if (!shortcode || !item.permalink) {
      ctx.fail({ platform: "ig", stage: "discover", target: item.id, code: "NO_SHORTCODE", message: "permalink에서 shortcode를 찾지 못했다." });
      continue;
    }
    const prev = d.state.ig.get(item.id);
    if (!prev) newMedia++;
    const row: IgMediaState = {
      mediaId: item.id,
      shortcode,
      permalink: item.permalink,
      captionHead: captionHead(item.caption),
      postedAt: parseIgTimestamp(item.timestamp),
      isTracked: prev?.isTracked ?? true,
      unsupportedMetrics: prev?.unsupportedMetrics ?? [],
      metricsProbedAt: prev?.metricsProbedAt ?? null,
      lastSnapshotAt: prev?.lastSnapshotAt ?? null,
      consecutiveFailures: prev?.consecutiveFailures ?? 0,
      coverPath: prev?.coverPath ?? null,
    };
    if (item.thumbnail_url) thumbs.set(row.mediaId, item.thumbnail_url);
    rows.push(row);
    d.state.ig.set(row.mediaId, row);
  }
  if (rows.length) await d.store.upsertIgMedia(rows);

  let drafts = 0;
  for (const row of rows) {
    if ((await attachIgMedia(d.store, d.state, row)) === "draft") drafts++;
  }

  // 표지는 만료되는 주소라 받아 두고, 이미 있는 편은 건너뛴다
  await saveCovers(
    ctx,
    d.store,
    "ig",
    rows
      .filter((r) => r.isTracked && !r.coverPath && thumbs.has(r.mediaId))
      .map((r) => ({
        id: r.mediaId,
        path: `ig/${r.mediaId}.jpg`,
        urls: [thumbs.get(r.mediaId)!],
        save: async (path) => {
          r.coverPath = path;
          await d.store.patchIgMedia(r.mediaId, { coverPath: path });
        },
      })),
  );
  return { newMedia, drafts };
}

export async function captureInstagram(ctx: SyncContext, d: IgDeps): Promise<PlatformSummary> {
  const candidates = [...d.state.ig.values()]
    .filter((m) => m.isTracked && isDataDue({ postedAt: m.postedAt, lastSnapshotAt: m.lastSnapshotAt, now: ctx.now, force: ctx.force }))
    .sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime()); // 최근 편부터(시간·한도가 모자라도 중요한 것부터)

  const capturedAt = ctx.current();
  const snapshots: IgSnapshotInput[] = [];
  let rateLimited = false;

  await mapLimit(candidates, 4, async (media) => {
    if (rateLimited) return;
    if (ctx.timeLeftMs() < 3_000) {
      ctx.note("time budget");
      return;
    }
    if ((d.usage.percent ?? 0) >= USAGE_LIMIT && ageHours(media.postedAt, ctx.now) >= 72) {
      ctx.note(`API 사용률 ${d.usage.percent}%: 72시간 지난 편은 다음 회차로 미룸`);
      return;
    }

    const probe = !media.metricsProbedAt || ctx.now.getTime() - media.metricsProbedAt.getTime() >= PROBE_EVERY_MS;
    const metrics = probe ? [...IG_METRICS] : IG_METRICS.filter((m) => !media.unsupportedMetrics.includes(m));
    try {
      const { values, unsupported } = await d.client.fetchInsights(media.mediaId, metrics);
      snapshots.push({ mediaId: media.mediaId, capturedAt, ...toIgMetrics(values) });
      media.lastSnapshotAt = capturedAt;
      media.consecutiveFailures = 0;
      if (probe) {
        media.unsupportedMetrics = unsupported;
        media.metricsProbedAt = ctx.now;
      } else if (unsupported.length) {
        media.unsupportedMetrics = [...new Set([...media.unsupportedMetrics, ...unsupported])];
      }
      await d.store.patchIgMedia(media.mediaId, {
        lastSnapshotAt: capturedAt,
        consecutiveFailures: 0,
        unsupportedMetrics: media.unsupportedMetrics,
        metricsProbedAt: media.metricsProbedAt,
      });
    } catch (e) {
      if (e instanceof IgRateLimitError) {
        rateLimited = true;
        ctx.note("rate limited");
        ctx.fail({ platform: "ig", stage: "insights", target: media.mediaId, code: "RATE_LIMIT", message: e.message });
        return;
      }
      if (e instanceof IgMissingMediaError) {
        media.consecutiveFailures += 1;
        const untrack = media.consecutiveFailures >= MISSING_LIMIT;
        if (untrack) media.isTracked = false;
        await d.store.patchIgMedia(media.mediaId, {
          consecutiveFailures: media.consecutiveFailures,
          ...(untrack && { isTracked: false }),
        });
        ctx.fail({
          platform: "ig",
          stage: "insights",
          target: media.mediaId,
          code: untrack ? "MISSING_UNTRACKED" : "MISSING",
          message: e.message,
        });
        return;
      }
      ctx.fail({
        platform: "ig",
        stage: "insights",
        target: media.mediaId,
        code: e instanceof HttpError ? String(e.apiCode ?? e.status) : "ERROR",
        message: (e as Error).message,
      });
    }
  });

  const captured = snapshots.length ? await d.store.insertIgSnapshots(snapshots, d.runId) : 0;
  return { status: "ok", due: candidates.length, captured };
}
