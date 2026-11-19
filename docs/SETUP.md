# 실데이터 연결과 배포 순서

순서대로 하면 30~40분쯤 걸린다. **사용자**가 하는 일과 **Claude**에게 맡길 수 있는 일을 나눠 적었다.
비밀값은 대화창에 붙이지 말고 `.env.local`(git에 안 올라감)이나 각 서비스 화면에 직접 넣는다.

## 1. Supabase 프로젝트 (사용자, 10분)

1. https://supabase.com 에서 New project. 이름 `techrano-analytics`, 리전 **Northeast Asia (Seoul)**. DB 비밀번호는 비밀번호 관리자에 저장한다.
2. Authentication → Sign In / Providers
   - Email만 켜 둔다.
   - **Allow new users to sign up 끄기**
   - Anonymous sign-ins가 꺼져 있는지 확인
3. Authentication → Users → Add user → Create new user: 관리자 이메일과 비밀번호, **Auto Confirm User** 체크.
4. SQL Editor에서 아래를 실행한다. 이메일만 바꾼다. 이 SQL은 레포에 넣지 않는다.

   ```sql
   update auth.users
      set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"app_role":"admin"}'
    where email = '관리자 이메일';
   ```

5. Project Settings → API Keys에서 값 두 개를 확인한다: publishable key(`sb_publishable_…`)와 secret key(`sb_secret_…`). 레거시 화면이면 anon / service_role.
6. `~/Desktop/techrano-analytics/.env.local` 끝에 넣는다.

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<프로젝트 ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_...
   ADMIN_EMAIL=관리자 이메일
   ```

   크론 시크릿은 터미널에서 만든다(화면에 출력되지 않음):

   ```bash
   cd ~/Desktop/techrano-analytics && printf 'CRON_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env.local
   ```

## 2. DB 준비와 첫 수집 (Claude에게 맡기면 된다, 10분)

```bash
npx supabase login                               # 브라우저 로그인(사용자가 한 번 승인)
npx supabase link --project-ref <프로젝트 ref>
npm run db:push                                  # 마이그레이션 4개
npm run verify-rls                               # anon 거부, 비관리자 0행 확인
npm run seed -- --readme ~/Desktop/Techrano/업로드/README.md            # 미리보기
npm run seed -- --readme ~/Desktop/Techrano/업로드/README.md --apply    # 01~10편, 기준편 05·07
npm run sync -- --force --discover-all            # 첫 수집: 10편 매칭, 초안 0 확인
npm run import-points -- --file seed/manual-points.local.json          # (선택) 성과.md의 정확한 기록
npm run import-points -- --file seed/manual-points.local.json --apply
npm run dev                                       # http://localhost:3000/login 에서 관리자 로그인 확인
```

`supabase login`이 번거로우면 대시보드 Connect → Session pooler 주소로 `npx supabase db push --db-url "<주소>"`를 써도 된다.

## 3. Google OAuth 앱 게시 (사용자, 5분)

1. Google Cloud Console → Google Auth Platform → Audience. 게시 상태가 **Testing**이면 **Publish app**을 누른다. 개인용이라 확인 절차 없이 게시해도 된다. 로그인 때 "확인되지 않은 앱" 경고가 나오는 것은 정상이다.
2. 테스트 중에 받은 refresh token은 게시 뒤에도 7일 안에 끊길 수 있다. 다시 받는다.

   ```bash
   cd ~/Desktop/Techrano && python3 scripts/yt-stats.py login
   ```

3. 새 토큰을 `.env.local`에 반영한다(값 출력 없이).

   ```bash
   cd ~/Desktop/techrano-analytics && sed -i '' '/^GOOGLE_REFRESH_TOKEN=/d' .env.local && \
     printf 'GOOGLE_REFRESH_TOKEN=%s\n' "$(security find-generic-password -a techrano -s techrano-youtube-token -w)" >> .env.local
   npm run probe
   ```

## 4. GitHub 공개 레포 (Claude, 사용자 승인 후)

- 커밋 작성자는 GitHub noreply 주소로 맞춰 두었다.

```bash
gh repo create techrano-analytics --public --source . --push
```

## 5. Vercel 배포 (사용자 또는 Claude, 10분)

1. https://vercel.com/new 에서 GitHub의 `techrano-analytics`를 Import한다. Framework: Next.js, Node 24. 함수 리전은 `vercel.json`이 서울(icn1)로 잡는다.
2. Environment Variables는 **Production에만** 넣는다. 비밀값은 Sensitive로 표시한다.

   | 이름 | 값 |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 1단계 값(Preview에도 넣어도 됨) |
   | `SUPABASE_SECRET_KEY`, `ADMIN_EMAIL`, `CRON_SECRET` | `.env.local`과 같은 값 |
   | `META_ACCESS_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | `.env.local`과 같은 값 |

   CLI로 넣으면 값이 화면에 나오지 않는다. 예: `grep '^CRON_SECRET=' .env.local | cut -d= -f2- | npx vercel env add CRON_SECRET production`
3. 배포가 끝나면 Supabase → Authentication → URL Configuration의 Site URL을 배포 주소로 바꾼다.
4. 폰 브라우저로 배포 주소를 열어 관리자 로그인 → 공유 → 홈 화면에 추가. 홈 화면 앱은 Safari와 쿠키가 따로라 앱 안에서 한 번 더 로그인한다.

## 6. 15분 크론 켜기 (Claude, 사용자 승인 후)

```bash
gh secret set SYNC_URL --body "https://<배포 주소>/api/cron/sync"
grep '^CRON_SECRET=' .env.local | cut -d= -f2- | gh secret set CRON_SECRET
gh secret set NEXT_PUBLIC_SUPABASE_URL --body "https://<프로젝트 ref>.supabase.co"
grep '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' .env.local | cut -d= -f2- | gh secret set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
gh workflow run sync.yml                          # 한 번 돌려 보고
gh run list --workflow sync.yml --limit 3         # 15~30분 뒤 예약 실행이 쌓이는지 본다
```

## 그 뒤

- 11편을 올리면 15분 안에 관리 화면 "확인할 편"에 초안이 생긴다. 번호·계열·첫 컷 훅을 넣어 확정한다.
- 게시 72시간이 지나면 편 상세에 복기 알림이 뜬다.
- 상단 점이 빨갛게 바뀌면(2시간 넘게 수집 없음) GitHub Actions 탭에서 sync 워크플로가 꺼졌는지 본다. 공개 레포는 60일 동안 활동이 없으면 예약 실행이 꺼진다(keepalive가 매달 다시 켠다).
