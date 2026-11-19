/**
 * 배포된 Supabase에서 접근 차단이 실제로 동작하는지 확인한다.
 *
 *   npm run verify-rls                 anon 검사 + 임시 비관리자 계정 검사(secret key 필요)
 *   npm run verify-rls -- --anon-only  anon 검사만(공개 URL·publishable key만 있으면 됨, CI 주간 점검용)
 *
 * 관리자 쪽(실데이터가 보이는지)은 Phase 4 로그인 화면에서 확인한다.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";
import { publicEnv, supabaseSecretEnv } from "../src/lib/env";
import { parseArgs } from "./lib/args";

const TABLES = ["episodes", "ig_media", "yt_videos", "ig_snapshots", "yt_snapshots", "sync_runs"] as const;
const VIEWS = ["v_ig_series", "v_yt_series", "v_episode_overview"] as const;

const args = parseArgs();
const pub = publicEnv();
const results: { check: string; ok: boolean; detail: string }[] = [];
const record = (check: string, ok: boolean, detail = "") => results.push({ check, ok, detail });

const anon = createClient<Database>(pub.NEXT_PUBLIC_SUPABASE_URL, pub.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

for (const name of [...TABLES, ...VIEWS]) {
  const { data, error } = await anon.from(name as "episodes").select("*").limit(1);
  record(`anon select ${name}`, !!error, error ? error.code ?? error.message : `rows=${data?.length}`);
}
const anonRpc = [
  ["start_sync_run", { p_trigger: "cron", p_min_gap_seconds: 0 }],
  ["merge_episode", { p_source: 1, p_target: 2 }],
  ["unpair_episode", { p_id: 1, p_platform: "yt" }],
  ["channel_totals", {}],
] as const;
for (const [fn, params] of anonRpc) {
  const { error } = await anon.rpc(fn, params as never);
  record(`anon rpc ${fn}`, !!error, error ? error.code ?? error.message : "실행됨");
}
{
  const { error } = await anon.from("episodes").insert({ title: "rls-probe" });
  record("anon insert episodes", !!error, error?.code ?? "들어감");
}

if (!args.has("anon-only")) {
  const secret = supabaseSecretEnv();
  const admin = createClient<Database>(secret.NEXT_PUBLIC_SUPABASE_URL, secret.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `rls-probe-${randomBytes(4).toString("hex")}@example.invalid`;
  const password = randomBytes(24).toString("base64url");
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    record("임시 비관리자 계정 생성", false, created.error?.message ?? "");
  } else {
    try {
      const user = createClient<Database>(pub.NEXT_PUBLIC_SUPABASE_URL, pub.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signIn = await user.auth.signInWithPassword({ email, password });
      record("임시 계정 로그인", !signIn.error, signIn.error?.message ?? "");
      for (const name of [...TABLES, ...VIEWS]) {
        const { data, error } = await user.from(name as "episodes").select("*").limit(5);
        record(`비관리자 select ${name}`, !error && (data?.length ?? 0) === 0, error ? error.message : `rows=${data?.length}`);
      }
      const ins = await user.from("episodes").insert({ title: "rls-probe" });
      record("비관리자 insert episodes", !!ins.error, ins.error?.code ?? "들어감");
      const run = await user.rpc("start_sync_run", { p_trigger: "cron", p_min_gap_seconds: 0 });
      record("비관리자 rpc start_sync_run", !!run.error, run.error?.code ?? "실행됨");
      const { count } = await admin.from("episodes").select("*", { count: "exact", head: true });
      record("secret key로 본 episodes 수(참고)", true, String(count));
    } finally {
      await admin.auth.admin.deleteUser(created.data.user.id);
    }
  }
}

console.table(results.map((r) => ({ 검사: r.check, 결과: r.ok ? "통과" : "실패", 비고: r.detail })));
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length}개 실패`);
  process.exit(1);
}
console.log(`\n${results.length}개 모두 통과`);
