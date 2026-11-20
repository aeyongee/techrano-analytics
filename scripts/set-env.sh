#!/usr/bin/env bash
# .env.local의 Supabase 칸을 하나씩 채운다. 값은 화면에 보이지 않는다.
#   bash scripts/set-env.sh
# 이미 채운 칸은 Enter만 누르면 그대로 둔다.
set -euo pipefail
cd "$(dirname "$0")/.."
touch .env.local
chmod 600 .env.local

ask() {
  local key="$1" hint="$2" value
  local current
  current=$(grep -E "^${key}=" .env.local | head -1 | cut -d= -f2- || true)
  echo
  echo "▶ ${key}"
  echo "  ${hint}"
  if [ -n "$current" ]; then echo "  (이미 채워져 있다. 바꾸지 않으려면 Enter)"; fi
  read -rs -p "  붙여 넣고 Enter: " value
  echo
  value="$(printf '%s' "$value" | tr -d '\r' | sed -e 's/^[[:space:]"'"'"']*//' -e 's/[[:space:]"'"'"']*$//')"
  if [ -z "$value" ]; then
    echo "  그대로 둠"
    return
  fi
  # 한글 입력 상태에서 섞여 들어간 글자(예: ㄱ)나 띄어쓰기가 있으면 받지 않는다
  if LC_ALL=C printf '%s' "$value" | grep -q '[^!-~]'; then
    echo "  ✗ 영문·숫자·기호가 아닌 글자가 섞여 있다(한글 입력 상태였을 수 있음). 다시 복사해서 붙여 넣는다."
    ask "$key" "$hint"
    return
  fi
  # Data API 화면의 전체 주소(…/rest/v1/)를 붙여 넣어도 프로젝트 주소만 남긴다
  if [ "$key" = "NEXT_PUBLIC_SUPABASE_URL" ]; then
    value="${value%/}"
    value="${value%/rest/v1}"
  fi
  KEY="$key" VALUE="$value" python3 - <<'PY'
import os, re
key, value = os.environ["KEY"], os.environ["VALUE"]
path = ".env.local"
lines = open(path, encoding="utf-8").read().splitlines()
out, done = [], False
for line in lines:
    if re.match(rf"^{re.escape(key)}=", line):
        if not done:
            out.append(f"{key}={value}")
            done = True
        continue
    out.append(line)
if not done:
    out.append(f"{key}={value}")
open(path, "w", encoding="utf-8").write("\n".join(out) + "\n")
PY
  echo "  저장함 (${#value}자)"
}

echo "Supabase 값을 하나씩 붙여 넣는다. 붙여 넣어도 화면에 글자가 안 보이는 게 정상이다."
ask NEXT_PUBLIC_SUPABASE_URL "Project Settings → Data API → Project URL (https://….supabase.co)"
ask NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "Project Settings → API Keys → Publishable key (sb_publishable_…)"
ask SUPABASE_SECRET_KEY "같은 화면 Secret keys (sb_secret_…), Reveal 눌러 복사"
ask ADMIN_EMAIL "Authentication → Users에서 만든 관리자 이메일"
ask SUPABASE_DB_PASSWORD "프로젝트 만들 때 정한 DB 비밀번호"
ask SUPABASE_ACCESS_TOKEN "오른쪽 위 프로필 → Account preferences → Access Tokens → Generate new token"

echo
echo "현재 상태:"
for k in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY ADMIN_EMAIL SUPABASE_DB_PASSWORD SUPABASE_ACCESS_TOKEN CRON_SECRET; do
  v=$(grep -E "^${k}=" .env.local | head -1 | cut -d= -f2- || true)
  if [ -n "$v" ]; then echo "  ✓ ${k}"; else echo "  ✗ ${k} (비어 있음)"; fi
done
