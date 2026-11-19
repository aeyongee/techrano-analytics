/**
 * 수집기를 돌리기 전에 손으로 기록해 둔 인스타 수치를 스냅샷(source='import')으로 넣는다.
 *
 *   npm run import-points -- --file seed/manual-points.local.json           미리보기(기본)
 *   npm run import-points -- --file seed/manual-points.local.json --apply   DB에 쓰기
 *
 * 정확한 숫자만 받는다. "약 2.0천" 같은 어림값이나 문자열은 거부한다.
 * 시각은 capturedAt(ISO) 또는 hoursAfterPost(게시 후 몇 시간) 중 하나로 적는다.
 * 릴스가 ig_media에 먼저 등록돼 있어야 한다(npm run sync를 한 번 돌린 뒤).
 */
import { readFileSync } from "node:fs";
import { z } from "zod";
import { supabaseSecretEnv } from "../src/lib/env";
import { createSupabaseAdminClient } from "../src/lib/supabase/admin";
import { fail, parseArgs } from "./lib/args";

const count = z.number().int().nonnegative();
const point = z
  .object({
    epNo: z.number().int().positive(),
    capturedAt: z.iso.datetime({ offset: true }).optional(),
    hoursAfterPost: z.number().positive().max(24 * 365).optional(),
    note: z.string().optional(),
    views: count.optional(),
    reach: count.optional(),
    saved: count.optional(),
    shares: count.optional(),
    comments: count.optional(),
    likes: count.optional(),
    avgWatchMs: count.optional(),
    skipRate: z.number().min(0).max(100).optional(),
  })
  .strict()
  .refine((p) => (p.capturedAt ? 1 : 0) + (p.hoursAfterPost ? 1 : 0) === 1, "capturedAt과 hoursAfterPost 중 하나만 적는다")
  .refine((p) => p.views !== undefined || p.reach !== undefined || p.saved !== undefined, "수치가 하나는 있어야 한다");
const fileSchema = z.object({ points: z.array(point).min(1) });

const args = parseArgs();
const file = args.get("file") ?? fail("--file <JSON 경로>가 필요하다.");
const parsed = fileSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
if (!parsed.success) {
  fail(`형식 오류(어림값·문자열은 받지 않는다):\n${parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`);
}

const env = supabaseSecretEnv();
const db = createSupabaseAdminClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);
const { data: eps, error: epErr } = await db.from("episodes").select("ep_no, ig_shortcode");
if (epErr) fail(epErr.message);
const { data: media, error: mErr } = await db.from("ig_media").select("media_id, shortcode, posted_at");
if (mErr) fail(mErr.message);

const rows = [];
const problems: string[] = [];
for (const p of parsed.data.points) {
  const shortcode = eps?.find((e) => e.ep_no === p.epNo)?.ig_shortcode;
  const m = media?.find((x) => x.shortcode === shortcode);
  if (!m) {
    problems.push(`${p.epNo}편: ig_media에 릴스가 없다. npm run sync를 먼저 돌린다.`);
    continue;
  }
  const posted = Date.parse(m.posted_at);
  const at = p.capturedAt ? Date.parse(p.capturedAt) : posted + p.hoursAfterPost! * 3_600_000;
  if (at < posted) {
    problems.push(`${p.epNo}편: 기록 시각이 게시 시각보다 앞이다.`);
    continue;
  }
  rows.push({
    media_id: m.media_id,
    captured_at: new Date(at).toISOString(),
    source: "import",
    views: p.views ?? null,
    reach: p.reach ?? null,
    saved: p.saved ?? null,
    shares: p.shares ?? null,
    comments: p.comments ?? null,
    likes: p.likes ?? null,
    avg_watch_ms: p.avgWatchMs ?? null,
    skip_rate: p.skipRate ?? null,
  });
}

console.table(rows.map((r) => ({ media: r.media_id, 시각: r.captured_at, 조회: r.views, 도달: r.reach, 저장: r.saved, 공유: r.shares, 건너뛰기: r.skip_rate })));
if (problems.length) console.log(`\n건너뜀:\n  ${problems.join("\n  ")}`);
if (!args.has("apply")) {
  console.log("\n미리보기만 했다. 쓰려면 --apply를 붙인다.");
  process.exit(0);
}
const { data, error } = await db.from("ig_snapshots").upsert(rows, { onConflict: "media_id,captured_at", ignoreDuplicates: true }).select("id");
if (error) fail(error.message);
console.log(`\n${data?.length ?? 0}건 넣었다(이미 있던 시각은 건너뜀).`);
