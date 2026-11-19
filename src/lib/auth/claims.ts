/**
 * 관리자 판정(2층). DB RLS(3층)와 같은 기준에 이메일 확인을 더한다.
 * app_metadata는 서비스 키로만 바꿀 수 있다. 사용자가 고칠 수 있는 user_metadata는 보지 않는다.
 */
export function isAdminClaims(
  claims: { email?: unknown; app_metadata?: unknown; is_anonymous?: unknown } | null | undefined,
  adminEmail: string,
): boolean {
  if (!claims || claims.is_anonymous === true) return false;
  const meta = claims.app_metadata as { app_role?: unknown } | undefined;
  return (
    meta?.app_role === "admin" &&
    typeof claims.email === "string" &&
    claims.email.trim().toLowerCase() === adminEmail.trim().toLowerCase()
  );
}
