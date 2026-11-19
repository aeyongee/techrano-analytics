import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

/**
 * Supabase가 새 프로젝트에 깔아 두는 것 중 마이그레이션이 기대는 부분만 흉내 낸다.
 * 기본 권한을 Supabase처럼 넓게 열어 두어야, 마이그레이션이 그것을 제대로 잠그는지 확인할 수 있다.
 */
const SUPABASE_BOOTSTRAP = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
`;

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../supabase/migrations");

export async function createMigratedDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_BOOTSTRAP);
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
  return db;
}

export type Role = "anon" | "authenticated" | "service_role";

/** 지정한 역할과 JWT claim으로 쿼리 하나를 실행한다. 끝나면 superuser로 돌아온다. */
export async function queryAs<T = Record<string, unknown>>(
  db: PGlite,
  role: Role,
  claims: Record<string, unknown> | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(claims ?? {})]);
  await db.exec(`set role ${role}`);
  try {
    const res = await db.query<T>(sql, params);
    return res.rows;
  } finally {
    await db.exec("reset role");
  }
}

export const ADMIN_CLAIMS = { role: "authenticated", app_metadata: { app_role: "admin" } };
export const USER_CLAIMS = { role: "authenticated", app_metadata: {} };
