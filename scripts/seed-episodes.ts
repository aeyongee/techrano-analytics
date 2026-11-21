/**
 * Techrano 편 목록 표로 episodes를 채운다.
 *
 *   npm run seed -- --readme <Techrano>/업로드/README.md            미리보기(기본)
 *   npm run seed -- --readme <…> --apply                           DB에 쓰기
 *   옵션: --meta seed/episodes.local.json (기본값, 있으면 읽음)  --benchmark 5,7 (기본)
 *
 * 링크가 아직 없는 행은 번호만 받은 예정 편(초안)으로 넣는다. 게시되면 수집기가 제목으로 붙이고 게시로 바꾼다.
 * 메타 파일에 없는 필드와 README에 없는 링크는 보내지 않으므로, 관리자 화면에서 고친 메모나 수집기가 붙인 연결을 덮어쓰지 않는다.
 * 규칙은 src/lib/seed/plan.ts.
 */
import { existsSync, readFileSync } from "node:fs";
import { createSupabaseAdminClient } from "../src/lib/supabase/admin";
import type { TableInsert } from "../src/lib/supabase/database.types";
import { supabaseSecretEnv } from "../src/lib/env";
import { planSeed, type ExistingEpisode } from "../src/lib/seed/plan";
import { parseEpisodeTable, type EpisodeMetaFile } from "../src/lib/seed/readme";
import { fail, parseArgs } from "./lib/args";

const args = parseArgs();
const readmePath = args.get("readme") ?? fail("--readme <Techrano 업로드/README.md 경로>가 필요하다.");
const metaPath = args.get("meta") ?? "seed/episodes.local.json";
const benchmarks = new Set((args.get("benchmark") ?? "5,7").split(",").map((n) => Number(n.trim())));

const episodes = parseEpisodeTable(readFileSync(readmePath, "utf8"));
const meta: EpisodeMetaFile = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : { episodes: {} };

const env = supabaseSecretEnv();
const db = createSupabaseAdminClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);
const { data: current, error: readError } = await db.from("episodes").select("id, ep_no, title, status, ig_shortcode, yt_video_id");
if (readError) fail(`편을 읽지 못했다: ${readError.message}`);
const plan = planSeed(
  episodes,
  (current ?? []).map((e) => ({
    id: e.id,
    epNo: e.ep_no,
    title: e.title,
    status: e.status as ExistingEpisode["status"],
    igShortcode: e.ig_shortcode,
    ytVideoId: e.yt_video_id,
  })),
);

console.log(`표에서 ${episodes.length}편을 읽었다${existsSync(metaPath) ? ` (메타: ${metaPath})` : ""}.\n`);
console.table(
  episodes.map((e, i) => ({
    번호: e.epNo,
    제목: e.title,
    slug: e.slug,
    인스타: e.igShortcode,
    유튜브: e.ytVideoId,
    "표의 게시 시각(IG)": e.igPostedKst,
    기준편: benchmarks.has(e.epNo) ? "O" : "",
    메타: meta.episodes[String(e.epNo)] ? "O" : "",
    할일: `${plan[i].kind}${"id" in plan[i] ? ` #${(plan[i] as { id: number }).id}` : ""} · ${plan[i].note}`,
  })),
);

if (!args.has("apply")) {
  console.log("\n미리보기만 했다. 쓰려면 --apply를 붙인다.");
  process.exit(0);
}

// 필드 구성이 편마다 달라 한 행씩 쓴다(편 수가 적다).
for (const [i, action] of plan.entries()) {
  if (action.kind === "skip") {
    console.warn(`${episodes[i].epNo}편 건너뜀: ${action.note}`);
    continue;
  }
  const m = meta.episodes[String(action.fields.ep_no)] ?? {};
  const row: TableInsert<"episodes"> = {
    ...action.fields,
    is_benchmark: benchmarks.has(action.fields.ep_no),
    ...(m.series !== undefined && { series: m.series }),
    ...(m.topic !== undefined && { topic: m.topic }),
    ...(m.isTrueStory !== undefined && { is_true_story: m.isTrueStory }),
    ...(m.hookDesc !== undefined && { hook_desc: m.hookDesc }),
    ...(m.hypothesis !== undefined && { hypothesis: m.hypothesis }),
    ...(m.notes !== undefined && { notes: m.notes }),
  };
  const { error } =
    action.kind === "insert"
      ? await db.from("episodes").insert(row)
      : await db.from("episodes").update(row).eq("id", action.id);
  if (error) fail(`${action.fields.ep_no}편 저장 실패: ${error.message}`);
}
const { count } = await db.from("episodes").select("*", { count: "exact", head: true }).eq("status", "published");
console.log(`\n저장했다. published 편 ${count}개.`);
