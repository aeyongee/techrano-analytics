import "server-only";
import { redirect } from "next/navigation";
import { adminEnv, hasLiveConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminClaims } from "./claims";

export interface AdminSession {
  userId: string;
  email: string;
}

/**
 * 서명을 검증한 JWT claim으로 관리자인지 본다. 쿠키를 그대로 믿는 getSession()은 쓰지 않는다.
 * proxy(1층)는 편의용이고, 실데이터에 닿는 모든 경로는 이 함수(2층)를 거친다. DB RLS(3층)가 마지막이다.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  if (!hasLiveConfig()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  const claims = data.claims;
  if (!isAdminClaims(claims, adminEnv().ADMIN_EMAIL)) return null;
  return { userId: String(claims.sub), email: String(claims.email) };
}

export async function requireAdmin(): Promise<AdminSession> {
  if (!hasLiveConfig()) redirect("/login?e=config");
  const session = await getAdminSession();
  if (!session) redirect("/login");
  return session;
}
