/**
 * 수집 한 회차를 로컬에서 돌린다(크론·Sync Now와 같은 runSync).
 *
 *   npm run sync                                기본 간격대로 수집해 DB에 쓴다
 *   npm run sync -- --force                     30일 이내 편은 간격 무시
 *   npm run sync -- --discover-all              인스타 미디어 목록을 끝까지 훑는다
 *   npm run sync -- --dry-run                   DB에서 읽기만 하고 쓰지 않는다
 *   npm run sync -- --memory-readme <README>    DB 없이 편 목록 표만으로 실제 API를 확인한다
 */
import { readFileSync } from "node:fs";
import {
  collectorEnvFromProcess,
  runSync,
  SyncBusyError,
  SyncCooldownError,
  type SyncStore,
  type Trigger,
} from "../src/lib/collector";
import { DryRunStore } from "../src/lib/collector/store/dry-run";
import { MemorySyncStore } from "../src/lib/collector/store/memory";
import { SupabaseSyncStore } from "../src/lib/collector/store/supabase";
import { supabaseSecretEnv } from "../src/lib/env";
import { parseEpisodeTable } from "../src/lib/seed/readme";
import { createSupabaseAdminClient } from "../src/lib/supabase/admin";
import { parseArgs } from "./lib/args";

const args = parseArgs();
const memoryReadme = args.get("memory-readme");

let store: SyncStore;
let memory: MemorySyncStore | null = null;
let dry: DryRunStore | null = null;
if (memoryReadme) {
  memory = new MemorySyncStore();
  for (const e of parseEpisodeTable(readFileSync(memoryReadme, "utf8"))) {
    memory.addEpisode({ epNo: e.epNo, title: e.title, status: "published", igShortcode: e.igShortcode, ytVideoId: e.ytVideoId });
  }
  store = memory;
} else {
  const env = supabaseSecretEnv();
  const real = new SupabaseSyncStore(createSupabaseAdminClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY));
  store = args.has("dry-run") ? (dry = new DryRunStore(real)) : real;
}

try {
  const s = await runSync(
    {
      trigger: (args.get("trigger") as Trigger | undefined) ?? "cli",
      force: args.has("force"),
      discoverAll: args.has("discover-all"),
      minGapSeconds: Number(args.get("min-gap") ?? 0),
    },
    { store, env: collectorEnvFromProcess() },
  );

  console.log(`\n실행 ${s.runId ?? "(기록 안 함)"} · ${s.status} · ${(s.durationMs / 1000).toFixed(1)}초`);
  console.table({
    인스타: { 상태: s.ig.status, 대상: s.ig.due, 수집: s.ig.captured },
    유튜브: { 상태: `${s.yt.status} (Analytics ${s.yt.analytics})`, 대상: s.yt.due, 수집: s.yt.captured },
  });
  console.log(`새 게시물 ${s.newMedia} · 새 초안 ${s.draftsCreated} · 자동 짝 ${s.autoPaired} · API 호출 ${JSON.stringify(s.apiCalls)}`);
  if (s.notes.length) console.log(`메모: ${s.notes.join("; ")}`);
  if (s.errors.length) console.table(s.errors);

  const igSnaps = memory?.igSnapshots ?? dry?.igSnapshots;
  const ytSnaps = memory?.ytSnapshots ?? dry?.ytSnapshots;
  if (memory || dry) {
    const state = memory ? await memory.loadState() : await store.loadState();
    const epByShortcode = new Map(state.episodes.map((e) => [e.igShortcode, e]));
    const epByVideo = new Map(state.episodes.map((e) => [e.ytVideoId, e]));
    const shortcodeById = new Map([...state.ig.values()].map((m) => [m.mediaId, m.shortcode]));
    if (igSnaps?.length) {
      console.log("\n인스타 (쓰지 않은 값)");
      console.table(
        igSnaps.map((r) => {
          const ep = epByShortcode.get(shortcodeById.get(r.mediaId) ?? "");
          return {
            편: ep?.epNo ?? `초안 ${ep?.id ?? "?"}`,
            조회: r.views,
            도달: r.reach,
            건너뛰기: r.skipRate,
            "평균 시청(초)": r.avgWatchMs === null ? null : Math.round(r.avgWatchMs / 100) / 10,
            저장: r.saved,
            공유: r.shares,
            댓글: r.comments,
            좋아요: r.likes,
          };
        }),
      );
    }
    if (ytSnaps?.length) {
      console.log("유튜브 (쓰지 않은 값)");
      console.table(
        ytSnaps.map((r) => ({
          편: epByVideo.get(r.videoId)?.epNo ?? r.videoId,
          조회: r.views,
          좋아요: r.likes,
          댓글: r.comments,
          "A 조회": r.analytics?.views ?? null,
          "A 참여 조회": r.analytics?.engagedViews ?? null,
          "A 평균 시청(초)": r.analytics?.avgViewDurationSec ?? null,
          "A 공유": r.analytics?.shares ?? null,
        })),
      );
    }
    if (memory) {
      const drafts = state.episodes.filter((e) => e.status === "draft");
      if (drafts.length) console.log(`초안: ${drafts.map((e) => `${e.title} (ig ${e.igShortcode ?? "-"}, yt ${e.ytVideoId ?? "-"})`).join(" / ")}`);
    }
    if (dry) console.log(`\n쓰지 않은 변경 ${dry.writes.length}건:\n  ${dry.writes.slice(0, 40).join("\n  ")}`);
  }
  process.exit(s.status === "failed" ? 1 : 0);
} catch (e) {
  if (e instanceof SyncBusyError || e instanceof SyncCooldownError) {
    console.log(e.message);
    process.exit(0);
  }
  throw e;
}
