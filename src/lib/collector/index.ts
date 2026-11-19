import { SyncContext } from "./context";
import { autoPairDrafts } from "./episodes";
import type { CollectorEnv } from "./env";
import { HttpError, type Sleep } from "./http";
import { InstagramClient } from "./instagram/client";
import { captureInstagram, discoverInstagram, type IgDeps } from "./instagram/sync";
import { getAccessToken } from "./youtube/auth";
import { YoutubeClient } from "./youtube/client";
import { captureYoutube, discoverYoutube, type YtDeps } from "./youtube/sync";
import type { YtVideoItem } from "./youtube/parse";
import type { AnalyticsStatus, PlatformSummary, RunStatus, RunSyncOptions, SyncError, SyncStore, SyncSummary } from "./types";

export * from "./types";
export { collectorEnvFromProcess, type CollectorEnv } from "./env";

export interface SyncDeps {
  store: SyncStore;
  env: CollectorEnv;
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
  clock?: () => number;
}

const DEFAULT_BUDGET_MS = 45_000;

function errorCode(e: unknown): string {
  if (e instanceof HttpError) return String(e.apiCode ?? e.status);
  return (e as Error)?.name ?? "ERROR";
}

/**
 * 크론·Sync Now·CLI가 함께 쓰는 수집 한 회차.
 * 잠금 → 상태 읽기 → 발견(IG ∥ YT) → 자동 짝짓기 → 수집(IG ∥ YT) → 기록.
 * 한 플랫폼이 실패해도 다른 플랫폼은 끝까지 수집한다.
 */
export async function runSync(opts: RunSyncOptions, deps: SyncDeps): Promise<SyncSummary> {
  const clock = deps.clock ?? Date.now;
  const startedMs = clock();
  const runId = await deps.store.startRun(opts.trigger, opts.minGapSeconds ?? 0); // BUSY·COOLDOWN은 그대로 던진다

  const ctx = new SyncContext(
    new Date(startedMs),
    startedMs + (opts.budgetMs ?? DEFAULT_BUDGET_MS),
    clock,
    opts.force ?? false,
    opts.discoverAll ?? false,
    { fetchImpl: deps.fetchImpl, sleep: deps.sleep },
  );
  const ig: PlatformSummary = { status: "skipped", due: 0, captured: 0 };
  const yt: PlatformSummary & { analytics: AnalyticsStatus } = { status: "skipped", due: 0, captured: 0, analytics: "skipped" };
  let newMedia = 0;
  let draftsCreated = 0;
  let autoPaired = 0;
  let fatal = false;

  const platformError = (platform: SyncError["platform"], stage: SyncError["stage"], e: unknown) =>
    ctx.fail({ platform, stage, code: errorCode(e), message: (e as Error)?.message ?? String(e) });

  try {
    const state = await deps.store.loadState();

    // ── 준비: 플랫폼별 클라이언트 ────────────────────────────────
    let igDeps: IgDeps | null = null;
    if (!deps.env.meta) {
      ig.status = "error";
      ctx.fail({ platform: "ig", stage: "config", code: "CONFIG", message: "META_ACCESS_TOKEN이 설정되지 않았다." });
    } else {
      const usage = { percent: null as number | null };
      const client = new InstagramClient({
        token: deps.env.meta.token,
        graphVersion: deps.env.meta.graphVersion,
        fetchImpl: deps.fetchImpl,
        sleep: deps.sleep,
        onCall: () => ctx.count("ig"),
        onUsage: (p) => (usage.percent = p),
      });
      try {
        const igUserId = deps.env.meta.igUserId ?? (await client.getAccount()).id;
        igDeps = { client, store: deps.store, state, igUserId, runId, usage };
      } catch (e) {
        ig.status = "error";
        platformError("ig", "auth", e);
      }
    }

    let ytDeps: YtDeps | null = null;
    if (!deps.env.google) {
      yt.status = "error";
      ctx.fail({ platform: "yt", stage: "config", code: "CONFIG", message: "GOOGLE_CLIENT_ID·SECRET·REFRESH_TOKEN이 설정되지 않았다." });
    } else {
      try {
        const accessToken = await getAccessToken(deps.env.google, {
          fetchImpl: deps.fetchImpl,
          sleep: deps.sleep,
          onCall: () => ctx.count("yt_oauth"),
        });
        const client = new YoutubeClient({ accessToken, fetchImpl: deps.fetchImpl, sleep: deps.sleep, onCall: (k) => ctx.count(k) });
        ytDeps = { client, store: deps.store, state, runId, uploadsPlaylistId: deps.env.google.uploadsPlaylistId };
      } catch (e) {
        yt.status = "error";
        platformError("yt", "auth", e);
      }
    }

    // ── 발견 ───────────────────────────────────────────────────
    let ytItems: Map<string, YtVideoItem> | null = null;
    const [igFound, ytFound] = await Promise.allSettled([
      igDeps ? discoverInstagram(ctx, igDeps) : Promise.resolve(null),
      ytDeps ? discoverYoutube(ctx, ytDeps) : Promise.resolve(null),
    ]);
    if (igFound.status === "fulfilled" && igFound.value) {
      newMedia += igFound.value.newMedia;
      draftsCreated += igFound.value.drafts;
    } else if (igFound.status === "rejected") {
      ig.status = "error";
      igDeps = null;
      platformError("ig", "discover", igFound.reason);
    }
    if (ytFound.status === "fulfilled" && ytFound.value) {
      newMedia += ytFound.value.newMedia;
      draftsCreated += ytFound.value.drafts;
      ytItems = ytFound.value.items;
    } else if (ytFound.status === "rejected") {
      yt.status = "error";
      ytDeps = null;
      platformError("yt", "discover", ytFound.reason);
    }

    // ── 자동 짝짓기(발견이 끝난 뒤라 경쟁이 없다) ─────────────────
    try {
      autoPaired = await autoPairDrafts(deps.store, state);
    } catch (e) {
      platformError("db", "pair", e);
    }

    // ── 수집 ───────────────────────────────────────────────────
    const [igDone, ytDone] = await Promise.allSettled([
      igDeps ? captureInstagram(ctx, igDeps) : Promise.resolve(null),
      ytDeps && ytItems ? captureYoutube(ctx, ytDeps, ytItems) : Promise.resolve(null),
    ]);
    if (igDone.status === "fulfilled" && igDone.value) Object.assign(ig, igDone.value);
    else if (igDone.status === "rejected") {
      ig.status = "error";
      platformError("ig", "write", igDone.reason);
    }
    if (ytDone.status === "fulfilled" && ytDone.value) Object.assign(yt, ytDone.value);
    else if (ytDone.status === "rejected") {
      yt.status = "error";
      platformError("yt", "write", ytDone.reason);
    }
  } catch (e) {
    fatal = true;
    platformError("db", "write", e);
  }

  let status: RunStatus;
  if (fatal || (ig.status === "error" && yt.status === "error")) status = "failed";
  else if (ctx.errors.length || ctx.notes.length || ig.status === "error" || yt.status === "error") status = "partial";
  else status = "success";

  const durationMs = clock() - startedMs;
  await deps.store.finishRun(runId, {
    status,
    durationMs,
    igStatus: ig.status,
    ytStatus: yt.status,
    ytAnalyticsStatus: yt.analytics,
    igCaptured: ig.captured,
    ytCaptured: yt.captured,
    newMedia,
    apiCalls: ctx.calls,
    errors: ctx.errors,
    note: ctx.notes.length ? ctx.notes.join("; ") : null,
  });

  return {
    runId,
    status,
    durationMs,
    ig,
    yt,
    newMedia,
    draftsCreated,
    autoPaired,
    apiCalls: ctx.calls,
    errors: ctx.errors,
    notes: ctx.notes,
  };
}
