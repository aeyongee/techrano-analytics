/**
 * 자격 증명이 살아 있는지만 확인한다. 토큰 값은 출력하지 않는다.
 *   npm run probe
 */
import { collectorEnvFromProcess } from "../src/lib/collector/env";
import { InstagramClient } from "../src/lib/collector/instagram/client";
import { getAccessToken } from "../src/lib/collector/youtube/auth";
import { YoutubeClient } from "../src/lib/collector/youtube/client";

const env = collectorEnvFromProcess();
let failed = false;

if (!env.meta) {
  console.log("인스타: META_ACCESS_TOKEN 없음");
  failed = true;
} else {
  try {
    const ig = new InstagramClient({ token: env.meta.token, graphVersion: env.meta.graphVersion, onCall: () => {} });
    const acc = await ig.getAccount();
    console.log(`인스타: @${acc.username} (계정 ID 확인됨)`);
  } catch (e) {
    console.log(`인스타: 실패 — ${(e as Error).message}`);
    failed = true;
  }
}

if (!env.google) {
  console.log("유튜브: GOOGLE_CLIENT_ID·SECRET·REFRESH_TOKEN 중 빠진 값이 있음");
  failed = true;
} else {
  try {
    const accessToken = await getAccessToken(env.google, { onCall: () => {} });
    const yt = new YoutubeClient({ accessToken, onCall: () => {} });
    console.log(`유튜브: ${await yt.getChannelTitle()} (토큰 갱신 확인됨)`);
  } catch (e) {
    console.log(`유튜브: 실패 — ${(e as Error).message}`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
