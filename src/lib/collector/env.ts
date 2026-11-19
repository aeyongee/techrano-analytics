export interface MetaEnv {
  token: string;
  igUserId: string | null;
  /** 비우면 버전 없는 경로(insta-stats.py에서 검증한 방식) */
  graphVersion: string | null;
}

export interface GoogleEnv {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  uploadsPlaylistId: string | null;
}

export interface CollectorEnv {
  meta: MetaEnv | null;
  google: GoogleEnv | null;
}

const value = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

/** 플랫폼별로 필요한 값이 다 있을 때만 켠다. 없는 플랫폼은 수집기가 CONFIG 오류로 기록한다. */
export function collectorEnvFromProcess(env: NodeJS.ProcessEnv = process.env): CollectorEnv {
  const token = value(env.META_ACCESS_TOKEN);
  const clientId = value(env.GOOGLE_CLIENT_ID);
  const clientSecret = value(env.GOOGLE_CLIENT_SECRET);
  const refreshToken = value(env.GOOGLE_REFRESH_TOKEN);
  return {
    meta: token
      ? { token, igUserId: value(env.META_IG_USER_ID), graphVersion: value(env.META_GRAPH_VERSION) }
      : null,
    google:
      clientId && clientSecret && refreshToken
        ? { clientId, clientSecret, refreshToken, uploadsPlaylistId: value(env.YT_UPLOADS_PLAYLIST_ID) }
        : null,
  };
}
