import "server-only";
import { collectorEnvFromProcess, runSync, type RunSyncOptions, type SyncSummary } from "@/lib/collector";
import { SupabaseSyncStore } from "@/lib/collector/store/supabase";
import { supabaseSecretEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export { SyncBusyError, SyncCooldownError, type SyncSummary } from "@/lib/collector";

/** Next 쪽(크론 라우트, Sync Now)에서 수집기를 부르는 유일한 입구 */
export async function runServerSync(opts: RunSyncOptions): Promise<SyncSummary> {
  const env = supabaseSecretEnv();
  const store = new SupabaseSyncStore(createSupabaseAdminClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY));
  return runSync(opts, { store, env: collectorEnvFromProcess() });
}
