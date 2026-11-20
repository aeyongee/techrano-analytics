/**
 * supabase/migrations의 아직 적용 안 한 파일을 Supabase 관리 API로 적용한다.
 * DB 비밀번호 없이 SUPABASE_ACCESS_TOKEN(sbp_…)만으로 돈다.
 * 적용 기록은 Supabase CLI와 같은 표(supabase_migrations.schema_migrations)에 남겨, 나중에 CLI를 써도 꼬이지 않게 한다.
 *
 *   npm run db:apply            적용할 파일만 보여 준다
 *   npm run db:apply -- --apply 실제로 적용한다
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fail, parseArgs } from "./lib/args";

const args = parseArgs();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const token = process.env.SUPABASE_ACCESS_TOKEN ?? "";
const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? fail("NEXT_PUBLIC_SUPABASE_URL이 없거나 형식이 다르다.");
if (!token.startsWith("sbp_")) fail("SUPABASE_ACCESS_TOKEN(sbp_…)이 없다.");

async function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  return JSON.parse(text) as T[];
}

const DIR = path.resolve("supabase/migrations");
const files = readdirSync(DIR).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();

await query(`
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text not null primary key);
  alter table supabase_migrations.schema_migrations add column if not exists statements text[];
  alter table supabase_migrations.schema_migrations add column if not exists name text;
`);
const applied = new Set((await query<{ version: string }>("select version from supabase_migrations.schema_migrations")).map((r) => r.version));
const pending = files.filter((f) => !applied.has(f.split("_")[0]));

console.log(`마이그레이션 ${files.length}개 중 적용됨 ${files.length - pending.length}개, 남음 ${pending.length}개`);
for (const f of pending) console.log(`  · ${f}`);
if (!pending.length) process.exit(0);
if (!args.has("apply")) {
  console.log("\n미리보기만 했다. 적용하려면 --apply를 붙인다.");
  process.exit(0);
}

for (const f of pending) {
  const sql = readFileSync(path.join(DIR, f), "utf8");
  if (sql.includes("$mig$")) fail(`${f}에 $mig$ 문자열이 있어 기록용 따옴표와 겹친다.`);
  const [version, ...rest] = f.replace(/\.sql$/, "").split("_");
  // 파일 하나를 한 트랜잭션으로: 중간에 실패하면 그 파일은 통째로 되돌린다
  await query(`begin;
${sql}
;
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('${version}', '${rest.join("_")}', array[$mig$${sql}$mig$]);
commit;`);
  console.log(`적용함: ${f}`);
}
