/**
 * Supabase DB 안의 예약(pg_cron)으로 15분마다 수집 주소를 부른다.
 * 처음에는 GitHub Actions 예약을 썼지만, 켠 뒤 세 시간 넘게 한 번도 돌지 않아 이것으로 바꿨다.
 * CRON_SECRET은 Supabase Vault(cron_secret)에만 넣고, 예약 SQL은 이름으로만 꺼내 쓴다.
 * PGlite 테스트에는 pg_cron·pg_net이 없어서 마이그레이션이 아니라 이 스크립트로 한 번 적용한다(다시 돌려도 된다).
 *
 *   npx tsx --env-file=.env.local scripts/setup-db-cron.ts --url https://<배포 주소>/api/cron/sync
 *   npx tsx --env-file=.env.local scripts/setup-db-cron.ts --status
 */
import { fail, parseArgs } from "./lib/args";

const JOB = "techrano-sync";
const SECRET_NAME = "cron_secret";

const args = parseArgs();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const token = process.env.SUPABASE_ACCESS_TOKEN ?? "";
const ref = supabaseUrl.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? fail("NEXT_PUBLIC_SUPABASE_URL이 없거나 형식이 다르다.");
if (!token.startsWith("sbp_")) fail("SUPABASE_ACCESS_TOKEN(sbp_…)이 없다.");

async function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T[];
}

/** SQL 문자열 리터럴(작은따옴표 이스케이프) */
const lit = (s: string) => `'${s.replaceAll("'", "''")}'`;

async function status() {
  const jobs = await query<{ jobname: string; schedule: string; active: boolean }>(
    `select jobname, schedule, active from cron.job where jobname = ${lit(JOB)}`,
  );
  console.log("예약:", jobs[0] ?? "없음");
  const runs = await query<{ start_time: string; status: string; return_message: string }>(`
    select d.start_time, d.status, left(d.return_message, 80) as return_message
    from cron.job_run_details d join cron.job j on j.jobid = d.jobid
    where j.jobname = ${lit(JOB)} order by d.start_time desc limit 5`);
  for (const r of runs) console.log(`  ${new Date(r.start_time).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} ${r.status} ${r.return_message ?? ""}`);
  const http = await query<{ created: string; status_code: number | null; error_msg: string | null }>(
    `select created, status_code, left(error_msg, 80) as error_msg from net._http_response order by created desc limit 5`,
  );
  for (const h of http) console.log(`  응답 ${new Date(h.created).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} ${h.status_code ?? "-"} ${h.error_msg ?? ""}`);
}

if (args.has("status")) {
  await status();
  process.exit(0);
}

const target = args.get("url") ?? fail("--url https://<배포 주소>/api/cron/sync 가 필요하다.");
if (!/^https:\/\/[^/]+\/api\/cron\/sync$/.test(target)) fail("--url은 https://…/api/cron/sync 형식이어야 한다.");
const secret = process.env.CRON_SECRET ?? fail("CRON_SECRET이 없다.");

await query(`create extension if not exists pg_cron; create extension if not exists pg_net;`);

// Vault: 있으면 값만 바꾸고, 없으면 만든다
const existing = await query<{ id: string }>(`select id from vault.secrets where name = ${lit(SECRET_NAME)}`);
if (existing[0]) await query(`select vault.update_secret(${lit(existing[0].id)}, ${lit(secret)})`);
else await query(`select vault.create_secret(${lit(secret)}, ${lit(SECRET_NAME)}, 'techrano 수집 주소 호출용')`);

// 같은 이름이면 cron.schedule이 덮어쓴다. 정각 몰림을 피해 2분부터 15분 간격.
await query(`
  select cron.schedule(${lit(JOB)}, '2,17,32,47 * * * *', $job$
    select net.http_post(
      url := ${lit(target)},
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = ${lit(SECRET_NAME)}),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  $job$)`);

console.log("설정함. 상태:");
await status();
