/**
 * 유튜브 구독자 수의 지난 기록을 채운다(한 번만 돌리면 된다).
 * 지금 구독자 수에서 Analytics 일별 순증을 거꾸로 빼서 날마다의 값을 만든다.
 * 수집기가 이미 남긴 첫 기록보다 앞선 날짜만 넣는다. 인스타는 API가 지난 팔로워 수를 주지 않아 채우지 않는다.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-audience.ts [--dry-run]
 */
import { collectorEnvFromProcess } from "../src/lib/collector/env";
import { SupabaseSyncStore } from "../src/lib/collector/store/supabase";
import type { AudienceInput } from "../src/lib/collector/types";
import { getAccessToken } from "../src/lib/collector/youtube/auth";
import { ANALYTICS_START_DATE, YoutubeClient } from "../src/lib/collector/youtube/client";
import { supabaseSecretEnv } from "../src/lib/env";
import { createSupabaseAdminClient } from "../src/lib/supabase/admin";
import { parseArgs } from "./lib/args";

const args = parseArgs();
const google = collectorEnvFromProcess().google;
if (!google) throw new Error("GOOGLE_CLIENT_ID·SECRET·REFRESH_TOKEN이 필요하다.");

const env = supabaseSecretEnv();
const db = createSupabaseAdminClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);
const accessToken = await getAccessToken(google, { onCall: () => {} });
const yt = new YoutubeClient({ accessToken, onCall: () => {} });

const current = await yt.getSubscriberCount();
if (current === null) throw new Error("구독자 수를 읽지 못했다(숨김 설정일 수 있다).");
const today = new Date().toISOString().slice(0, 10);
const days = await yt.getDailySubscriberNet(ANALYTICS_START_DATE, today);

const { data: first, error } = await db
  .from("audience_snapshots")
  .select("captured_at")
  .eq("platform", "yt")
  .eq("source", "api")
  .order("captured_at")
  .limit(1);
if (error) throw new Error(error.message);
const cutoff = first?.[0] ? Date.parse(first[0].captured_at) : Date.now();

// 날짜 D가 끝날 때의 구독자 = 지금 - (D 다음 날부터의 순증 합). Analytics에 아직 없는 최근 며칠은 0으로 본다.
const rows: AudienceInput[] = [];
let after = 0;
for (let i = days.length - 1; i >= 0; i--) {
  const [day, net] = days[i];
  const endOfDayKst = new Date(`${day}T23:59:00+09:00`);
  if (endOfDayKst.getTime() < cutoff) rows.push({ platform: "yt", capturedAt: endOfDayKst, count: Math.max(0, current - after), source: "backfill" });
  after += net;
}
rows.reverse();
// 채널을 열기 전(구독 변화가 한 번도 없던 날)은 버리고, 첫 변화 하루 전부터 남긴다
const firstChange = days.findIndex(([, net]) => net !== 0);
const startDay = firstChange > 0 ? days[firstChange - 1][0] : days[0]?.[0];
const kept = startDay ? rows.filter((r) => r.capturedAt.getTime() >= new Date(`${startDay}T23:59:00+09:00`).getTime()) : rows;
rows.length = 0;
rows.push(...kept);

console.log(`지금 구독자 ${current}명, Analytics ${days.length}일치 → 채울 날 ${rows.length}일`);
for (const r of rows.slice(-5)) console.log(`  ${r.capturedAt.toISOString().slice(0, 10)}  ${r.count}`);
if (args.has("dry-run")) process.exit(0);
const n = await new SupabaseSyncStore(db).insertAudience(rows, null);
console.log(`넣음: ${n}행`);
