#!/usr/bin/env bash
# 공개 레포에 비밀값·개인정보가 들어가지 않았는지 본다.
# 대상: git이 추적하거나 추가 대기 중인 파일, 그리고 빌드 결과가 있으면 .next/static(브라우저로 나가는 번들).
set -euo pipefail
cd "$(dirname "$0")/.."

PATTERNS=(
  'EAA[A-Za-z0-9]{20,}'                 # Meta 액세스 토큰
  'GOCSPX-[A-Za-z0-9_-]{10,}'           # Google OAuth 클라이언트 시크릿
  '1//0[A-Za-z0-9_-]{20,}'              # Google refresh token
  'ya29\.[A-Za-z0-9._-]{20,}'           # Google access token
  'sb_secret_[A-Za-z0-9_-]{10,}'        # Supabase secret key
  'service_role"[^,}]{0,40}eyJ'         # 레거시 service_role JWT
  '[A-Za-z0-9._%+-]+@gmail\.com'        # 개인 메일
  '/Users/[A-Za-z]'                      # 개인 경로
)

files=$( { git ls-files; git diff --cached --name-only --diff-filter=AM; } | sort -u | grep -v '^scripts/scan-secrets.sh$' || true)
found=0
for p in "${PATTERNS[@]}"; do
  if [ -n "$files" ]; then
    if hits=$(echo "$files" | xargs grep -nIE -- "$p" 2>/dev/null); then
      echo "추적 파일에서 발견: $p"; echo "$hits" | sed 's/\(.\{160\}\).*/\1…/'; found=1
    fi
  fi
  if [ -d .next/static ]; then
    if hits=$(grep -rnIE -- "$p" .next/static 2>/dev/null | head -5); then
      echo "번들(.next/static)에서 발견: $p"; echo "$hits" | cut -c1-160; found=1
    fi
  fi
done

if [ "$found" -ne 0 ]; then
  echo "비밀값 또는 개인정보로 보이는 문자열이 있다. 지우고 다시 실행한다."
  exit 1
fi
echo "scan: 비밀값·개인정보 패턴 없음"
