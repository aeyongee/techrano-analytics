/**
 * Techrano 편 목록 표로 episodes를 채운다.
 *
 *   npm run seed -- --readme <Techrano>/업로드/README.md            미리보기(기본)
 *   npm run seed -- --readme <…> --apply                           DB에 쓰기(ep_no 기준 upsert)
 *   옵션: --meta seed/episodes.local.json (기본값, 있으면 읽음)  --benchmark 5,7 (기본)
 *
 * 메타 파일에 없는 필드는 보내지 않으므로, 관리자 화면에서 고친 메모를 덮어쓰지 않는다.
 */
import { existsSync, readFileSync } from "node:fs";
import { createSupabaseAdminClient } from "../src/lib/supabase/admin";
import type { TableInsert } from "../src/lib/supabase/database.types";
import { supabaseSecretEnv } from "../src/lib/env";
import { parseEpisodeTable, type EpisodeMetaFile } from "../src/lib/seed/readme";
import { fail, parseArgs } from "./lib/args";

const args = parseArgs();
const readmePath = args.get("readme") ?? fail("--readme <Techrano 업로드/README.md 경로>가 필요하다.");
const metaPath = args.get("meta") ?? "seed/episodes.local.json";
const benchmarks = new Set((args.get("benchmark") ?? "5,7").split(",").map((n) => Number(n.trim())));

const episodes = parseEpisodeTable(readFileSync(readmePath, "utf8"));
const meta: EpisodeMetaFile = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : { episodes: {} };

console.log(`표에서 ${episodes.length}편을 읽었다${existsSync(metaPath) ? ` (메타: ${metaPath})` : ""}.\n`);
console.table(
  episodes.map((e) => ({
    번호: e.epNo,
    제목: e.title,
    slug: e.slug,
    길이: e.lengthSec,
    인스타: e.igShortcode,
    유튜브: e.ytVideoId,
    "표의 게시 시각(IG)": e.igPostedKst,
    기준편: benchmarks.has(e.epNo) ? "O" : "",
    메타: meta.episodes[String(e.epNo)] ? "O" : "",
  })),
);

if (!args.has("apply")) {
  console.log("\n미리보기만 했다. 쓰려면 --apply를 붙인다.");
  process.exit(0);
}

const rows: TableInsert<"episodes">[] = episodes.map((e) => {
  const m = meta.episodes[String(e.epNo)] ?? {};
  return {
    ep_no: e.epNo,
    title: e.title,
    slug: e.slug,
    status: "published",
    length_sec: e.lengthSec,
    ig_shortcode: e.igShortcode,
    yt_video_id: e.ytVideoId,
    is_benchmark: benchmarks.has(e.epNo),
    ...(m.series !== undefined && { series: m.series }),
    ...(m.topic !== undefined && { topic: m.topic }),
    ...(m.isTrueStory !== undefined && { is_true_story: m.isTrueStory }),
    ...(m.hookDesc !== undefined && { hook_desc: m.hookDesc }),
    ...(m.hypothesis !== undefined && { hypothesis: m.hypothesis }),
    ...(m.notes !== undefined && { notes: m.notes }),
  };
});

const env = supabaseSecretEnv();
const db = createSupabaseAdminClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);
// 필드 구성이 편마다 다를 수 있어 한 행씩 upsert한다(편 수가 적다).
for (const row of rows) {
  const { error } = await db.from("episodes").upsert(row, { onConflict: "ep_no" });
  if (error) fail(`${row.ep_no}편 저장 실패: ${error.message}`);
}
const { count } = await db.from("episodes").select("*", { count: "exact", head: true }).eq("status", "published");
console.log(`\n저장했다. published 편 ${count}개.`);
