import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type AdminClient = SupabaseClient<Database>;

/**
 * secret key 클라이언트. RLS를 넘으므로 수집기·시드·검증 스크립트에서만 쓴다.
 * 화면 조회는 사용자 세션 클라이언트(server.ts)로 해서 RLS를 거치게 한다.
 * Next 모듈을 import하지 않아 CLI(tsx)에서도 쓸 수 있다.
 */
export function createSupabaseAdminClient(url: string, secretKey: string): AdminClient {
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
