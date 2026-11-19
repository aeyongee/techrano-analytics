import type { HttpDeps } from "../context";
import type { GoogleEnv } from "../env";
import { fetchJson } from "../http";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** refresh token으로 access token을 받는다. 매 회차 새로 받는다(캐시하지 않음). */
export async function getAccessToken(env: GoogleEnv, deps: HttpDeps & { onCall: () => void }): Promise<string> {
  deps.onCall();
  const res = await fetchJson<{ access_token: string }>(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      refresh_token: env.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
    fetchImpl: deps.fetchImpl,
    sleep: deps.sleep,
  });
  return res.access_token;
}
