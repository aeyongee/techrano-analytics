/**
 * 세팅이 맞게 됐는지 한 번에 본다. 값은 출력하지 않고 통과·실패만 보여 준다.
 *   npm run check-setup
 */
import { createClient, type User } from "@supabase/supabase-js";

type Row = { 항목: string; 결과: string; 비고: string };
const rows: Row[] = [];
const ok = (항목: string, pass: boolean, 비고 = "") => rows.push({ 항목, 결과: pass ? "통과" : "확인 필요", 비고 });
const env = (k: string) => (process.env[k] ?? "").trim();

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const pub = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const secret = env("SUPABASE_SECRET_KEY");
const admin = env("ADMIN_EMAIL");

ok("Supabase URL 형식", /^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(url), "https://<20자 ref>.supabase.co");
ok("publishable key 형식", /^sb_publishable_/.test(pub) || /^eyJ/.test(pub), "sb_publishable_… 또는 레거시 anon(eyJ…)");
ok("secret key 형식", /^sb_secret_/.test(secret) || /^eyJ/.test(secret), "sb_secret_… 또는 레거시 service_role(eyJ…)");
ok("publishable과 secret이 다른 값", !!pub && pub !== secret);
ok("관리자 이메일 형식", /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(admin));
ok("DB 비밀번호", env("SUPABASE_DB_PASSWORD").length >= 8);
ok("Supabase access token 형식", /^sbp_/.test(env("SUPABASE_ACCESS_TOKEN")), "sbp_…");
ok("CRON_SECRET", env("CRON_SECRET").length >= 32);
ok("Meta 토큰 있음", env("META_ACCESS_TOKEN").length > 20);
ok("Google 값 3개 있음", ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"].every((k) => env(k).length > 10));

if (url && pub) {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: pub } });
    const s = (await res.json()) as { disable_signup?: boolean; external?: Record<string, boolean>; anonymous_users?: boolean };
    ok("publishable key로 접속", res.ok, `HTTP ${res.status}`);
    ok("새 가입 막힘(Allow new users to sign up 끔)", s.disable_signup === true);
    const anon = s.external?.anonymous_users ?? s.anonymous_users;
    ok("익명 로그인 꺼짐", anon !== true);
  } catch (e) {
    ok("publishable key로 접속", false, (e as Error).message.slice(0, 60));
  }
}

if (url && secret && admin) {
  try {
    const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
    let found: User | null = null;
    for (let page = 1; page <= 5 && !found; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 });
      if (error) throw error;
      found = data.users.find((u) => u.email?.toLowerCase() === admin.toLowerCase()) ?? null;
      if (data.users.length < 100) break;
    }
    ok("관리자 계정 있음", !!found, found ? "" : "Authentication → Users에서 같은 이메일로 만든다");
    ok("관리자 표시(app_role=admin)", found?.app_metadata?.app_role === "admin", found ? "SQL Editor의 update 문" : "");
    ok("관리자 이메일 확인됨(Auto Confirm)", !!found?.email_confirmed_at);
    // HEAD 요청은 404여도 오류가 비어 올 수 있어 실제로 한 행을 읽어 본다
    const { error: tErr } = await db.from("episodes").select("id").limit(1);
    ok("테이블 생성됨(마이그레이션)", !tErr, tErr ? "db push 전이면 정상" : "");
  } catch (e) {
    ok("secret key로 접속", false, (e as Error).message.slice(0, 60));
  }
}

console.table(rows);
process.exit(0);
