// 오류 메시지는 sync_runs.errors와 로그로 나간다. 저장·출력 전에 반드시 여기를 거친다.
const RULES: [RegExp, string][] = [
  [/\b(access_token|client_secret|refresh_token|id_token)=([^&\s"']+)/gi, "$1=[redacted]"],
  [/("(?:access_token|client_secret|refresh_token|id_token)"\s*:\s*")[^"]*"/gi, '$1[redacted]"'],
  [/\b(Bearer|OAuth)\s+[A-Za-z0-9._~+/=-]{8,}/g, "$1 [redacted]"],
  [/EAA[A-Za-z0-9]{20,}/g, "[redacted-meta-token]"],
  [/1\/\/0[A-Za-z0-9_-]{20,}/g, "[redacted-google-refresh-token]"],
  [/ya29\.[A-Za-z0-9._-]{10,}/g, "[redacted-google-access-token]"],
  [/GOCSPX-[A-Za-z0-9_-]{6,}/g, "[redacted-google-client-secret]"],
  [/sb_secret_[A-Za-z0-9_-]{6,}/g, "[redacted-supabase-secret]"],
];

export function redact(text: string): string {
  return RULES.reduce((s, [re, to]) => s.replace(re, to), text);
}

export function redactAndTrim(text: string, max = 300): string {
  const s = redact(text);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
