# techrano-analytics 구현 계획서 v1 (2026-11-19)

## 0. 먼저 읽을 것

### 0.1 기존 자료에서 가져온 사실

| 자료 | 이 계획서에 반영한 내용 |
|---|---|
| `~/Desktop/Techrano/scripts/insta-stats.py` | permalink의 `/reel/{shortcode}`로 편 매칭, 실패하면 캡션 첫 줄(🦖 제거)로 매칭. insights 값은 `values[0].value` 또는 `total_value.value`에서 읽음. 지표를 한 번에 요청하다 실패하면 하나씩 다시 요청. API 경로에 버전을 붙이지 않음. 토큰은 `access_token` 쿼리 파라미터로 보냄 |
| `~/Desktop/Techrano/scripts/yt-stats.py` | 업로드 재생목록 `maxResults=25`. 제목 정규화는 해시태그와 문자·숫자 외 기호를 지우고 소문자로 바꿈. Analytics 요청은 `startDate=2025-01-01`, `endDate=오늘`, `maxResults=50`. 참여 조회율 분모는 **Analytics의 views**(Data API 조회수가 아님). ISO8601 길이 파싱 |
| `업로드/README.md` | 01~10편의 번호·제목·slug·길이·인스타 shortcode·유튜브 videoId. 시드 원본으로 씀 |
| `업로드/성과.md` | 관문 근거 수치와 "사용자가 알려 준 정확한 숫자만 기록한다"는 원칙. 과거 수동 기록은 가져올 때 '약'이 붙은 값을 빼야 함 |
| macOS 키체인 | `techrano-instagram`, `techrano-youtube-client`, `techrano-youtube-token` (계정 `techrano`) |
| 브랜드 | 티라노 초록 `#4ade80`·`#5fbf3f`, 하늘 `#3a86ff`·`#7ee0ff`, 노랑 `#ffd166`, 빨강 `#e5484d`, 남색 `#0f172a`. 블록, 단색, 선명한 그림자 |
| 로컬 환경 | Node 26, npm, gh(로그인됨). pnpm·supabase CLI·vercel CLI·Docker는 없음. 그래서 CLI는 `npx`로 쓰고 Docker가 필요한 `supabase start`는 쓰지 않음 |

### 0.2 확인할 결정 (추천안 기준으로 작성함)

| # | 결정 | 이 문서의 추천안 | 대안 |
|---|---|---|---|
| 1 | 수집을 어디서 실행할지 | GitHub Actions는 15분마다 Vercel `/api/cron/sync`를 호출만 하고, 수집은 Vercel에서 실행. **Meta·Google 토큰은 Vercel 한 곳에만 둔다** | GitHub Actions에서 직접 수집(토큰을 GitHub Secrets에도 둬야 함) |
| 2 | 수집 주기 | 15분 크론 + 게시 후 경과 시간에 따라 간격을 늘림(§4.5) | 1시간 고정(초기 1~3시간 곡선이 거칠어짐) |
| 3 | 사분면 Y 기준선 | 저장+공유 1.5%(=1.0+0.5) 선으로 위치를 나눈다. 선 위인데 두 조건 중 하나가 미달이면 △로 표시 | Y축을 '2차 관문 달성도'로 바꿈 |
| 4 | 데모의 관리자 화면 | 모든 동작이 되지만 저장되지 않는 시뮬레이션 | 읽기 전용 또는 잠금 안내 |
| 5 | PWA 아이콘 | `업로드/프로필/프사 원본.png`의 티라노 얼굴을 잘라 씀(공개 레포에 이미지 포함) | 단색 블록 글리프 |
| 6 | 테이블 수 | 요청한 4개에 `ig_media`, `yt_videos`를 더함(§3 첫머리에 이유) | 4개 유지(편 테이블이 플랫폼 정보를 떠안음) |

### 0.3 일정상 주의

- 인스타 인사이트와 유튜브 통계는 **누적값만** 준다. 그래서 1~10편의 T+0~72h 초기 곡선은 되살릴 수 없다. 10편도 수집을 시작하는 시점부터만 기록된다.
- 그래서 **Phase 1·2(DB, 수집기, 크론)를 화면보다 먼저 배포해 11편 게시 전에 수집이 돌게 한다.** 화면은 데모 데이터로 그 뒤에 만들어도 된다.
- `성과.md`의 정확한 초기 기록(7편 T+4h, 8편 T+2h·3h 등)은 Phase 5에서 `source='import'` 점으로 넣을 수 있다.

---

## 1. 기술 스택과 전체 아키텍처

### 1.1 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Next.js App Router(설치 시점의 최신 안정판, 16 이상), React 19, TypeScript `strict` | RSC로 데이터를 서버에서만 조회해 브라우저에 쿼리나 키가 나가지 않음. Server Actions에 Origin 검사(CSRF 방어)가 들어 있음 |
| UI | Tailwind CSS v4, shadcn/ui(Radix), lucide-react | Sheet(바텀시트)·Dialog·Tabs·Toast를 복사형으로 가져와 접근성을 확보하고, 브랜드 토큰으로 테마를 맞추기 쉬움 |
| 차트 | Recharts 3 | 요청 스택. ScatterChart+ZAxis(버블), ReferenceArea(사분면), `reversed` 축, log 축을 모두 지원. 색·툴팁은 CSS 변수 토큰으로 통일 |
| DB/인증 | Supabase(Postgres 15+, Auth, RLS), `@supabase/supabase-js` v2, `@supabase/ssr` | JWT claim 기반 RLS. 무료 500MB |
| 검증 | zod 4 | env, Server Action 입력, 외부 API 응답 파싱 |
| 수집 런타임 | Node 24 LTS + TypeScript 단일 런타임(로컬 CLI는 `tsx`) | §1.3 |
| 스케줄러 | GitHub Actions cron | Vercel Hobby cron은 하루 1회만 돌 수 있음 |
| 호스팅 | Vercel Hobby(함수 리전 `icn1` 서울), Supabase 서울 리전 | 함수와 DB 사이 왕복 지연을 최소화 |
| 테스트 | Vitest(도메인·파서·수집 오케스트레이터·마이그레이션), Playwright(데모 화면, 접근 차단) | 마이그레이션과 RLS는 PGlite(WASM Postgres)로 로컬에서 검증 |
| 패키지 | npm | 로컬에 pnpm 없음 |

쓰지 않는 것:
- `next-pwa`: 관리가 끊겼다. 서비스 워커는 손으로 쓴 `public/sw.js` 하나로 둔다.
- Supabase 익명 로그인: 이유는 §2.5.
- Python 런타임: §1.3.

### 1.2 아키텍처

```
┌──────────── GitHub (공개 레포 techrano-analytics) ─────────────┐
│ Actions: sync.yml(*/15 크론)  ci.yml(PR·push·주간 RLS 점검)      │
│          keepalive.yml(월 1회)                                   │
└──────────────┬──────────────────────────────────────────────────┘
               │ POST /api/cron/sync   Authorization: Bearer CRON_SECRET
               ▼
┌──────────── Vercel (Next.js, 함수 리전 icn1) ───────────────────┐
│ proxy.ts(구 middleware.ts): 세션 쿠키 갱신, 보호 경로 미로그인 → /login │
│ /login        : 소개, [게스트 데모 체험하기], 관리자 로그인           │
│ /demo/**      : 가상 데이터. DB·수집 코드를 import 못 하게 막음       │
│ / /compare /episodes/** /admin : 데이터 계층에서 requireAdmin()     │
│                                                                    │
│ 화면 조회: 사용자 세션 클라이언트 → RLS 적용(관리자 claim만 통과)     │
│ Server Action syncNow ─┐                                           │
│ /api/cron/sync ────────┴─► lib/collector.runSync()                 │
│                              ├─► Meta Graph API (graph.facebook.com)│
│                              └─► YouTube Data v3 / Analytics v2    │
│                              (쓰기는 secret key, RLS 우회)          │
└──────────────────────────────┬─────────────────────────────────────┘
                               ▼
┌──────────── Supabase (Postgres, 서울) ───────────────────────────┐
│ RLS: JWT app_metadata.app_role = 'admin'만 읽기. anon 권한 없음     │
│ episodes · ig_media · yt_videos · ig_snapshots · yt_snapshots ·    │
│ sync_runs + security_invoker 뷰 3개 + RPC 함수                      │
└────────────────────────────────────────────────────────────────────┘
로컬: npm run sync / probe / seed (tsx --env-file=.env.local) → 같은 collector 사용
```

### 1.3 설계 원칙

1. **TypeScript 단일 런타임.** Vercel 함수(Sync Now, cron)와 로컬 CLI가 같은 `src/lib/collector`를 쓴다. DB 타입을 수집기와 화면이 함께 쓴다. 테스트도 하나로 된다. Python 스크립트는 Techrano 레포에 그대로 두고(`성과.md` 기록용), 이 레포는 거기에 의존하지 않는다. 옮길 함수:

   | Python | TS 위치 |
   |---|---|
   | `insights()` + 지표별 폴백 | `collector/instagram/client.ts` `fetchInsights()` |
   | `match()` | `collector/matching.ts` `matchIgMedia()` |
   | `norm_title()`, `match_ep()` | `collector/matching.ts` `normalizeTitle()`, `matchYtVideo()` |
   | `parse_iso_duration()` | `collector/youtube/parse.ts` |
   | `get_access_token()` | `collector/youtube/auth.ts` |
   | `fetch_videos()`, `fetch_analytics()` | `collector/youtube/client.ts` |

2. **수집기는 프레임워크와 무관하게 둔다.** `src/lib/collector/**`는 `next/*`를 import하지 않는다. Next 쪽 진입점은 `src/server/collector.ts`(`import 'server-only'` 래퍼) 하나다. `server-only` 패키지는 일반 Node에서 import하면 예외를 던지므로 수집기 본체에는 넣지 않는다.
3. **데이터는 Repository → builder → 화면.** 실데이터(`live`)와 데모(`demo`)는 같은 `Repository` 인터페이스로 **원시 데이터**만 돌려준다. 관문 판정, 델타, 리샘플링 같은 파생 계산은 공용 순수 함수(`lib/domain/*`, `lib/data/builders.ts`)가 한다. 데모 화면이 실서비스 로직을 그대로 보여 준다.
4. **읽기는 RLS, 쓰기는 수집기만.** 화면이 데이터를 읽을 때는 secret key를 쓰지 않는다. 수집기·시드·검증 스크립트만 secret key를 쓴다.

---

## 2. 보안과 접근 제어 (A안)

### 2.1 지킬 것과 위협

| 자산 | 위협 | 방어 |
|---|---|---|
| 실제 성과 수치·복기 메모 | 비로그인·데모 방문자가 조회 | 3중 방어(§2.3), 데모를 코드 경계로 분리(§2.5) |
| Meta 영구 토큰, Google refresh token | 번들·로그·오류 메시지로 노출 | Vercel 서버 env에만 둠, `NEXT_PUBLIC_` 금지, 오류 문자열 redact, 번들 스캔 |
| 수집 엔드포인트 | 무단 호출로 API 한도 소진 | Bearer 시크릿, DB 잠금, 최소 간격 |
| 공개 레포 | 실데이터·개인정보 커밋 | `*.local.json`·`.env*`를 gitignore, CI 스캔, 공개 로그에는 건수만 출력 |

### 2.2 경로별 접근

| 경로 | 비로그인 | 관리자 | 데이터 |
|---|---|---|---|
| `/login` | 허용 | `/`로 보냄 | 없음 |
| `/demo`, `/demo/compare`, `/demo/episodes`, `/demo/episodes/[key]`, `/demo/admin` | 허용 | 허용 | 코드 안에서 만든 가상 데이터 |
| `/`, `/compare`, `/episodes`, `/episodes/[key]`, `/admin` | `/login`으로 보냄 | 허용 | Supabase(관리자 JWT, RLS) |
| `POST /api/cron/sync` | Bearer 필요 | Bearer 필요 | 수집(secret key) |
| Server Actions(실데이터용) | 거부 | 허용 | RLS 또는 수집기 |
| `/offline`, `/manifest.webmanifest`, `/sw.js`, `/icons/*` | 허용 | 허용 | 없음 |

### 2.3 인증과 관리자 판정 (3중 방어)

**로그인 방식은 이메일 + 비밀번호.**
- Supabase에서 "Allow new users to sign up"을 끄고, 관리자 계정은 대시보드에서 직접 만든다.
- 매직 링크를 쓰지 않는 이유: iOS 홈 화면 앱(PWA)은 Safari와 쿠키 저장소가 따로라서, 메일 링크가 Safari에서 열리면 PWA는 로그인 상태가 되지 않는다.

**1층, proxy(`src/proxy.ts`, Next 15 이하라면 `middleware.ts`)는 편의용.** `@supabase/ssr`로 세션 쿠키를 갱신하고, 보호 경로에 세션이 없으면 `/login`으로 보낸다. 이 층은 보안 경계로 보지 않는다. CVE-2025-29927처럼 미들웨어를 우회한 사례가 있었다.

**2층, `requireAdmin()`이 실제 경계.**
- 위치는 `src/lib/auth/guard.ts`. `getLiveRepository()` 안에서 호출하므로 **실데이터 조회는 반드시 이 검사를 거친다.** 레이아웃에만 두지 않는 이유는 클라이언트 내비게이션 때 레이아웃이 다시 실행되지 않을 수 있어서다.
- 모든 실데이터 Server Action도 첫 줄에서 호출한다.
- 판정:
  - `supabase.auth.getClaims()`로 서명을 검증한다. 쿠키를 그대로 믿는 `getSession()`은 서버에서 쓰지 않는다.
  - 통과 조건은 `claims.app_metadata.app_role === 'admin'` **그리고** `claims.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()`.
  - 실패하면 `signOut()` 후 `/login?e=forbidden`. 오류 문구는 "로그인할 수 없습니다" 하나로 통일.
- `ADMIN_EMAIL`은 Vercel env에만 둔다. 레포에는 이메일이 남지 않는다.

**3층, DB RLS가 최후 방어선.**
- `private.is_admin()`은 JWT의 `app_metadata.app_role`을 확인한다. `app_metadata`는 서비스 키로만 바꿀 수 있다. 사용자가 바꿀 수 있는 `user_metadata`는 쓰지 않는다.
- `is_anonymous`이면 거부한다.
- 1·2층이 모두 뚫려도 관리자 claim이 없는 세션은 0행을 받는다.
- claim은 SQL 편집기에서 손으로 한 번만 넣고, 그 SQL은 레포에 두지 않는다(§7.2).

(선택, Phase 5) Supabase TOTP MFA를 켜고 `is_admin()`에 `auth.jwt()->>'aal' = 'aal2'`를 더한다.

### 2.4 RLS 정책 요약 (SQL 전문은 §3.4)

- 6개 테이블 모두 `enable row level security`.
- `anon`: 테이블·뷰·시퀀스·함수 권한을 모두 회수. 정책도 만들지 않는다(정책 없음 = 거부).
- `authenticated`: 먼저 모두 회수한 뒤 필요한 것만 다시 준다.
  - `episodes`: select/insert/update/delete. 정책은 `using/with check ((select private.is_admin()))`.
  - `ig_media`, `yt_videos`: select와 `is_tracked` 열 update만.
  - `ig_snapshots`, `yt_snapshots`, `sync_runs`: select만. 쓰기는 수집기(service role)만.
  - 뷰 3개는 `security_invoker = true`. 이게 없으면 뷰가 소유자 권한으로 돌아 RLS를 우회한다.
  - RPC: `channel_totals`, `merge_episode`, `unpair_episode`는 authenticated에, `start_sync_run`은 service_role에만 실행 권한.
- `(select private.is_admin())`처럼 감싸 쓰면 쿼리당 한 번만 평가된다(Supabase 권장 패턴).

### 2.5 게스트 데모 분리 (실제 DB 쿼리 0건)

1. **라우트 트리를 나눈다.** 데모는 `/demo/**`에만 있고 `DemoRepository`만 쓴다. 화면 컴포넌트(`src/features/**`)는 props만 받으므로 두 모드가 같은 UI를 쓴다.
2. **import 경계를 린트로 막는다.** `src/app/demo/**`, `src/lib/data/demo/**`, `src/lib/actions/demo.ts`에서 다음 import를 금지하고, 위반하면 CI가 실패한다.
   - `@/lib/supabase/*`, `@/lib/data/live`, `@/lib/collector/**`, `@/server/**`, `@/lib/auth/**`, `next/headers`
   - 규칙: ESLint `no-restricted-imports`, `files` 단위 override
3. **요청 경로를 없앤다.** 데모 페이지는 쿠키를 읽지 않는다. 데이터는 시간 단위로 고정한 기준 시각과 시드로 만들고 `revalidate = 3600`으로 정적 생성한다.
4. **e2e로 확인한다.** Playwright가 데모 전 화면을 돌며 `*.supabase.co`로 가는 요청이 0건인지, 데모 배너가 늘 보이는지 단언한다.
5. **UX**
   - `/login`의 첫 번째(가장 큰) 버튼이 "게스트 데모 체험하기 →"이고 `/demo`로 간다.
   - README에서도 `/demo`로 바로 연결한다.
   - 위쪽에 고정 배너: "데모 모드 · 가상 데이터 · 바꾼 내용은 저장되지 않습니다 [관리자 로그인]".
   - `/demo` 첫 방문 때 닫을 수 있는 안내 카드: 2단계 관문 설명과 "비교 화면에서 편을 바꿔 보세요"("다시 보지 않기"는 localStorage).
6. **Supabase 익명 로그인을 쓰지 않는 이유:** 익명 사용자도 `authenticated` 역할로 들어온다. `to authenticated` 정책 하나만 잘못 써도 실데이터가 열린다. 데모는 DB를 아예 건드리지 않는 쪽이 안전하다.

### 2.6 비밀값 보관

| 이름 | 용도 | Vercel Production | Vercel Preview/Dev | GitHub Secrets | 로컬 `.env.local` |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 공개 | O | O | O(주간 RLS 점검) | O |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 키(RLS 전제). 레거시 프로젝트라면 anon key | O | O | O | O |
| `SUPABASE_SECRET_KEY` | 수집 쓰기·시드(레거시라면 service_role) | O(Sensitive) | X | X | O |
| `ADMIN_EMAIL` | 관리자 판정 | O(Sensitive) | X | X | O |
| `CRON_SECRET` | cron Bearer(`openssl rand -hex 32`) | O(Sensitive) | X | O | O |
| `META_ACCESS_TOKEN` | 시스템 사용자 영구 토큰 | O(Sensitive) | X | X | O |
| `META_IG_USER_ID` | 선택. 있으면 계정 조회 호출을 생략 | O | X | X | O |
| `META_GRAPH_VERSION` | 선택. 비우면 버전 없는 경로(검증된 방식) | | | | |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | YouTube | O(Sensitive) | X | X | O |
| `YT_UPLOADS_PLAYLIST_ID` | 선택. channels 호출 생략 | O | X | X | O |
| `SYNC_URL` | `https://<도메인>/api/cron/sync` | - | - | O | - |

- Preview 배포에는 실데이터 비밀값이 없다. 실데이터 경로에 들어가면 "이 배포에는 실데이터 연결이 없습니다"를 보여 주고, 데모는 정상 동작한다.
- `src/lib/env.ts`: 모든 env를 호출할 때 지연 검증한다. 비밀값 없이도 `next build`가 통과해야 한다.
- 비밀값을 터미널에 찍지 않는다. 키체인에서 바로 파이프로 넘긴다(§7.3).

### 2.7 Sync Now와 크론 인증

- **Sync Now**: Server Action `syncNow()`가 `requireAdmin()`을 부른 뒤 `runSync({ trigger: 'manual', force: true, minGapSeconds: 120 })`를 실행한다. CSRF는 Server Action의 Origin 검사가 막는다.
- **크론**: `POST /api/cron/sync`
  - `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `maxDuration = 60`, `preferredRegion = 'icn1'`.
  - `Authorization: Bearer` 값과 `CRON_SECRET`을 각각 SHA-256으로 해시한 뒤 `timingSafeEqual`로 비교.
  - env가 없으면 503, 틀리면 401, GET은 405.
  - `X-Sync-Force: 1` 헤더가 있으면 force로 실행.
  - 실행은 `runSync({ trigger: 'cron', minGapSeconds: 60 })`. 시크릿이 새도 남용 속도가 묶이도록 최소 간격을 둔다.
- **응답 본문**: `{ runId, status, ig: { captured }, yt: { captured }, durationMs }`만. 오류 상세는 관리자 화면에서만 본다. 공개 레포의 Actions 로그는 누구나 볼 수 있다.
- **잠금·간격**: DB 함수 `start_sync_run`이 원자적으로 처리(§3.2). 실행 중이면 `BUSY`(409), 간격 미달이면 `COOLDOWN`(429, `Retry-After` 포함).

### 2.8 공개 레포 위생과 HTTP 헤더

- `.gitignore`: `.env*`(`.env.example`은 예외), `seed/*.local.json`, `test-results/`, `playwright-report/`.
- `scripts/scan-secrets.sh`
  - 추적 파일과 `.next/static`에서 `EAA[A-Za-z0-9]{20,}`(Meta 토큰), `GOCSPX-`, `sb_secret_`, `1//0`(Google refresh token), `@gmail.com`, `/Users/`를 찾아 하나라도 나오면 실패.
  - CI와 커밋 전에 실행.
- `next.config.ts`의 headers
  - CSP: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`
  - `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-Content-Type-Options: nosniff`
  - 모든 경로에 `X-Robots-Tag: noindex, nofollow`
  - 실데이터 경로에 `Cache-Control: private, no-store`
- `app/robots.ts`는 전체를 disallow.

---

## 3. Supabase DB 스키마와 인덱스

**테이블을 2개 더하는 이유:** `ig_media`, `yt_videos`는 플랫폼 게시물 목록이다. 게시 시각, 예약 공개 상태, 미지원 지표 학습, 추적 여부를 편과 따로 가지고 있어야 한다.
- 스냅샷은 **플랫폼 ID**(media_id, video_id)에 붙는다. 편을 다시 연결하거나 초안을 합쳐도 스냅샷을 옮길 필요가 없다.
- 편과 게시물은 `episodes.ig_shortcode`, `episodes.yt_video_id` 값으로 이어진다. 외래키는 걸지 않는다(시드가 게시물 발견보다 먼저 들어가므로). 대신 유니크 제약으로 1:1을 보장한다.

```
episodes ──(ig_shortcode = shortcode)──► ig_media ──< ig_snapshots >──┐
    └──────(yt_video_id = video_id)───► yt_videos ──< yt_snapshots >──┴── sync_runs(run_id)
```

마이그레이션 파일 순서: `…01_tables.sql`, `…02_functions.sql`, `…03_views.sql`, `…04_security.sql`. 전문은 `supabase/migrations/`에 있다.

### 3.1 테이블 요약

- `episodes`: 편 메타데이터(번호, 제목, 상태, 계열, 훅, 가설, 72시간 복기, 메모, 기준편 여부)와 플랫폼 연결 키(`ig_shortcode`, `yt_video_id`), `auto_paired`.
- `ig_media`: 릴스 목록. `posted_at`, `unsupported_metrics`, `metrics_probed_at`, `last_snapshot_at`, `consecutive_failures`, `is_tracked`.
- `yt_videos`: 영상 목록. `privacy_status`, `published_at`(public이 된 뒤에만), `scheduled_at`, `duration_sec`, `is_short`, `analytics_checked_at`, `analytics_ready_at`.
- `ig_snapshots`: `views, reach, saved, shares, comments, likes, avg_watch_ms, skip_rate`, `source`(api|import). `unique (media_id, captured_at)`.
- `yt_snapshots`: Data API(`views, likes, comments`)와 Analytics(`a_*`, nullable). `unique (video_id, captured_at)`.
- `sync_runs`: 실행 로그. `unique ((true)) where status='running'`로 동시 실행 잠금.

### 3.2 함수

- `start_sync_run(p_trigger, p_min_gap_seconds)`: 5분 넘은 running을 abandoned로 정리 → 간격 검사(`TR429`, detail에 남은 초) → insert(유니크 위반이면 `TR409`) → 180일 지난 로그 삭제.
- `merge_episode(p_source, p_target, p_auto)`: 초안의 플랫폼 키를 대상 편으로 옮기고 초안 삭제.
- `unpair_episode(p_id, p_platform)`: 한쪽 키를 떼어 새 초안을 만들고 그 id를 돌려준다.
- `channel_totals(p_at)`: 시점까지의 편별 최신 스냅샷 합계.

오류 코드(`TR409`, `TR429`, `TR404`, `TR400`)는 PostgREST를 거쳐 `error.code`로 오고, TS에서 `BUSY`, `COOLDOWN`, `NOT_FOUND`, `VALIDATION`으로 바꾼다.

### 3.3 뷰와 `hours_since_post`

- `v_ig_series`, `v_yt_series`: 스냅샷 + 게시 시각 + `hours_since_post`(+ 저장률·공유율).
- `v_episode_overview`: 편마다 최신 IG 스냅샷, 최신 YT 스냅샷, 최신 Analytics 값(lateral join), `posted_at = least(ig, yt)`.

**`hours_since_post`는 저장하지 않고 뷰에서 계산한다.** 기준 시각은 인스타 `ig_media.posted_at`, 유튜브 `yt_videos.published_at`. 다른 테이블 값을 참조하는 generated column은 만들 수 없고, 예약 공개 영상은 public이 되면서 `publishedAt`이 바뀐다. 데이터가 작아 `(media_id, captured_at)` 인덱스로 충분하다.

### 3.4 권한과 RLS

`04_security.sql`: `private.is_admin()`(JWT `app_metadata.app_role = 'admin'`이고 익명 아님) → anon·authenticated 권한 전부 회수 → authenticated에 필요한 것만 grant → 6개 테이블 RLS → 관리자 정책만 생성(anon 정책 없음).

### 3.5 인덱스

| 인덱스 | 쓰임 |
|---|---|
| `ig_snapshots (media_id, captured_at)` 유니크 | 같은 회차 중복 방지, 편별 시계열, 최신 1행 |
| `yt_snapshots (video_id, captured_at)` 유니크 | 위와 같음 |
| `yt_snapshots (video_id, captured_at desc) where a_views is not null` | 최신 Analytics 값 |
| `sync_runs ((true)) where status='running'` 유니크 | 동시 실행 잠금 |
| `sync_runs (started_at desc)` | 최근 로그, 간격 검사, 180일 정리 |
| `episodes (ep_no)`, `(ig_shortcode)`, `(yt_video_id)`, `(slug)` 유니크 | 라우팅, 매칭 |
| `ig_media (posted_at desc)`, `yt_videos (published_at desc)` | 최신 편, 발견 목록 |

### 3.6 용량 추정

- 편 하나가 30일 동안 플랫폼마다 약 168행. 그 뒤는 하루 1행.
- 2.5일에 한 편이면 1년에 약 146편, 스냅샷 약 9만 3천 행(약 17MB). 무료 한도 500MB의 4% 이하.
- `sync_runs`는 하루 96행을 180일 보관해 약 1만 7천 행.
- **압축·다운샘플링은 만들지 않는다.** 월 1회 DB 크기를 보고 300MB를 넘으면 그때 30일 지난 행을 하루 1행으로 줄인다.

---

## 4. 24/7 자동 수집 파이프라인

### 4.1 실행 경로 3개 (모두 같은 `runSync()`)

| 경로 | 호출 | 옵션 |
|---|---|---|
| 크론 | GitHub Actions → `POST /api/cron/sync` | `trigger:'cron'`, `minGapSeconds:60`, `force`는 수동 dispatch 입력값 |
| Sync Now | 관리자 화면 Server Action | `trigger:'manual'`, `force:true`, `minGapSeconds:120` |
| CLI | `npm run sync -- [--force] [--dry-run] [--discover-all]` | `trigger:'cli'`, `.env.local` 사용 |

### 4.2 GitHub Actions

**`sync.yml`**
- `schedule: */15 * * * *`(UTC, 지연·누락 가능), `workflow_dispatch`(입력 `force`).
- `permissions: contents: read`, `concurrency: sync`, `timeout-minutes: 3`. curl 한 단계만.
- 000·5xx면 20초 뒤 한 번 재시도.
- 종료 코드: 200+success → 0, 200+partial → 0 + `::warning::`, 409·429 → 0 + `::notice::`, 401 → 1, 5xx·시간 초과 → 1.
- 로그에는 상태와 건수만 찍는다(공개 로그).

**`keepalive.yml`**: 매월 1일 `gh api -X PUT repos/$GITHUB_REPOSITORY/actions/workflows/sync.yml/enable`(`actions: write`). 공개 레포의 60일 무활동 비활성화 대비.

**`ci.yml`**: push·PR 때 `npm ci` → typecheck → lint → test → build(비밀값 없이) → scan → Playwright(데모·접근 차단). 주 1회 `verify-rls --anon-only`.

### 4.3 모듈 구조

```
src/lib/collector/
  index.ts            runSync(opts, deps) — 오케스트레이터
  types.ts            RunSyncOptions, SyncSummary, SyncError, SyncStore …
  env.ts              collectorEnvFromProcess()
  http.ts             fetchJson — 15초 타임아웃, 재시도, redact
  redact.ts           토큰·시크릿 가리기
  limit.ts            mapLimit
  schedule.ts         dataIntervalMinutes, isDataDue, isAnalyticsDue
  matching.ts         shortcodeFromPermalink, captionHead, normalizeTitle, matchIgMedia, matchYtVideo, findAutoPairs
  instagram/{client,parse,sync}.ts
  youtube/{auth,client,parse,sync}.ts
  store/{supabase,memory,dry-run}.ts
src/server/collector.ts  import 'server-only' 래퍼
```

### 4.4 실행 순서

```
runSync(opts)
 1. runId ← store.startRun(trigger, minGap)        BUSY/COOLDOWN이면 수집하지 않고 바로 반환
 2. state ← store.loadState()
 3. 발견 단계 (IG ∥ YT, allSettled)                 신규 등록 → 편 매칭 → 못 찾으면 초안 생성
 4. findAutoPairs() → 합치기                         발견이 끝난 뒤라 경쟁 상태가 없다
 5. 수집 단계 (IG ∥ YT, allSettled)                 간격 판정 → 지표 조회 → 스냅샷 일괄 insert
 6. store.finishRun(...)
```

- 시간 예산 45초(Vercel `maxDuration` 60초 안). 넘으면 남은 편을 건너뛰고 `partial` + `note='time budget'`.
- 한 회차 안에서 플랫폼마다 하나의 `captured_at`을 써서 중복 행을 막는다.

### 4.5 수집 간격

| 게시 후 경과 | 데이터 스냅샷 간격 |
|---|---|
| 0~6h | 15분 |
| 6~72h | 60분 |
| 72h~7d | 180분 |
| 7~30d | 720분 |
| 30d 이후 | 1440분 |

- 수집 대상: `last_snapshot_at`이 null이거나 `now - last_snapshot_at >= 간격 - 5분`.
- `force`: 30일 이내 편은 간격과 상관없이 수집.
- Analytics: 게시 20시간 전에는 조회 안 함. 미집계면 180분마다, 집계 후 30일까지 360분, 180일까지 1440분, 그 뒤 7일. Analytics 조회 대상이면 그 회차에 데이터 스냅샷도 남긴다.

### 4.6 인스타그램 세부

- 기본 주소는 버전 없는 `graph.facebook.com/`(선택 `META_GRAPH_VERSION`).
- 계정: `META_IG_USER_ID`가 없으면 `me/assigned_instagram_accounts`.
- 발견: 첫 페이지(`limit=25`). `--discover-all`·첫 실행·shortcode는 있는데 media가 없는 편이 있으면 `paging.next`로 최대 10페이지. REELS만.
- 지표: 전체 8개 − `unsupported_metrics`(7일마다 전체로 재확인). 묶음 실패 → 지표별. 단건 실패가 HTTP 400 + code 100이면 미지원으로 학습(단, 모든 지표가 실패하면 게시물 삭제로 보고 학습하지 않음). 일시 오류는 학습하지 않는다.
- 한도 코드(4, 17, 32, 613, 80001, 80002)면 이번 회차 인스타 수집 중단.
- `X-App-Usage`·`X-Business-Use-Case-Usage` 최댓값 ≥ 80이면 72시간 지난 편은 건너뜀.
- `+0000` → `+00:00`으로 바꿔 파싱.
- code 100 subcode 33(삭제·보관)이 3회 이어지면 `is_tracked=false`.
- 모든 오류 메시지는 `redact()`를 거친다.

### 4.7 유튜브 세부와 Analytics 백필

- 매 회차 access token 갱신.
- 업로드 재생목록 → `playlistItems?maxResults=25` → (그 ID ∪ 추적 중인 ID)로 `videos?part=snippet,statistics,contentDetails,status` 50개씩.
- private·unlisted: 등록만(`scheduled_at = status.publishAt`, `published_at = null`, 스냅샷 없음, 초안은 만든다). public: `published_at = snippet.publishedAt` 갱신 + 스냅샷.
- 응답에서 사라진 추적 ID는 3회 뒤 추적 해제.
- Analytics: `ids=channel==MINE`, `startDate=2025-01-01`, `endDate=오늘(KST)`, 지표 6개, `dimensions=video`, `filters=video==…`, `maxResults=50`.
- 집계 판정: 행이 있고, Data API 조회수 ≥ 50인데 `a_views=0`이면 미집계.
- **백필의 뜻:** 지난 행은 고치지 않는다. 화면은 가장 최근에 채워진 Analytics 값과 그 수집 시각을 따로 보여 준다. 신규 편은 실시간 조회수만 먼저 보이다가 24~48시간 뒤 Analytics 칸이 채워진다.
- `invalid_grant` → `code:'AUTH'`, 403 `quotaExceeded`는 재시도 안 함.

### 4.8 신규 편 감지, 초안, 자동 짝짓기

| 단계 | 인스타 새 릴스 | 유튜브 새 영상 |
|---|---|---|
| 1 | `episodes.ig_shortcode == shortcode`면 연결 | `episodes.yt_video_id == id`면 연결 |
| 2 | 캡션 첫 줄(🦖 제거) 정규화가 제목과 같고 그 편에 IG가 없으면 연결 | 정규화 제목이 같거나(둘 다 6자 이상일 때) 포함 관계면 연결 |
| 3 | 못 찾으면 초안 생성 | 초안 생성 |

- 자동 짝짓기: 한 플랫폼만 연결된 초안과, 반대 플랫폼만 연결된 편이 **±12시간 안**이고 양쪽 후보가 정확히 하나일 때만 합친다(`auto_paired=true`).
- 관리자 큐: 초안, `auto_paired=true`, 추적이 꺼진 게시물. 동작: 확정(번호·제목·계열·훅), 다른 편에 합치기, 짝 해제, 추적 끄기.

### 4.9 부분 실패, 재시도, 상태 판정

| 상황 | ig_status | yt_status | 실행 상태 |
|---|---|---|---|
| 모두 정상(0건이어도) | ok | ok | success |
| 인스타 토큰 오류 | error | ok | partial |
| 일부 릴스만 실패 | ok(errors 기록) | ok | partial |
| Analytics만 실패 | ok | ok, analytics=error | partial |
| 시간 예산 초과 | ok | ok | partial |
| 두 플랫폼 모두 실패 | error | error | failed |
| 시작·종료 DB 쓰기 실패 | - | - | failed |

- 재시도: 네트워크·5xx·429는 최대 2회(0.5초, 1.5초 + 지터), `Retry-After` 5초 이하면 따름. 그 밖의 4xx는 재시도 안 함.
- `SyncError { platform, stage, target?, code, message }`, message는 redact 후 300자.

### 4.10 보존과 정체 감시

- `sync_runs` 180일 뒤 삭제, 스냅샷은 모두 보관.
- 상단 수집 상태 점: 30분 안 초록, 2시간 안 노랑, 그 이상 빨강. 관리자 화면에 플랫폼별 마지막 성공 시각. GitHub 실패 메일.
- Supabase 무료 프로젝트는 7일 무요청이면 멈춘다. 크론이 돌면 멈추지 않는다.

---

## 5. 화면 UX/UI, PWA, 차트

### 5.1 라우트 맵

| 경로 | 화면 | 주 데이터 |
|---|---|---|
| `/login` | 포트폴리오 첫 화면 겸 로그인 | 없음 |
| `/`, `/demo` | 홈 대시보드 | KPI, 최신 편 카드, 사분면, 최근 편 |
| `/compare`, `/demo/compare` | T+ 성장 곡선 비교 | 선택한 편의 시계열 |
| `/episodes`, `/demo/episodes` | 편 목록 | `v_episode_overview` |
| `/episodes/[key]`, `/demo/episodes/[key]` | 편 상세·회고. `key`는 번호(`5`) 또는 초안(`d-12`) | 편 1개, 시계열 |
| `/admin`, `/demo/admin` | 관리자 제어 | sync_runs, 초안 큐, 편 관리 |
| `/offline` | PWA 오프라인 안내 | 없음 |

### 5.2 공통 셸

| 요소 | 모바일 (<768px, 기준 390) | 데스크톱 (≥1280px) |
|---|---|---|
| 내비게이션 | 하단 탭 4개(홈·비교·편·관리), 64px + safe-area | 왼쪽 사이드바 232px |
| 상단 | 52px: 로고, 화면 제목, 수집 상태 점, 새로고침 | 사이드바에 통합 |
| 본문 | 좌우 16px, 1열, 표는 카드 목록 | 최대 폭 1240px, 12열 그리드 |
| 선택 UI | 바텀시트 | 오른쪽 패널·팝오버 |

iOS 홈 화면 앱에는 당겨서 새로고침이 없으므로 상단 새로고침 버튼을 두고, 앱이 다시 보이면 60초 넘게 지났을 때 자동 새로고침한다.

### 5.3 디자인 토큰 (다크 전용, 테크라노 블록 톤)

| 토큰 | 값 | 쓰임 |
|---|---|---|
| `--bg` | `#0b1220` | 배경 |
| `--surface`, `--surface-2` | `#111a2e`, `#17223a` | 카드, 입력 |
| `--border` | `#23304a` | 테두리 |
| `--text`, `--muted` | `#e6edf3`, `#94a3b8` | 본문, 보조 |
| `--rano` | `#4ade80` | 주 색상, 최신 편, 통과 |
| `--rano-deep` | `#5fbf3f` | 버튼 눌림, 로고 |
| `--sky` | `#7ee0ff` | 인스타 선 |
| `--amber` | `#ffd166` | 유튜브 선(점선), 주의 |
| `--danger` | `#f87171` | 미달(항상 아이콘·글자와 함께) |
| `--pending` | `#94a3b8` | 판정 대기 |

- 비교 팔레트(최대 5개): 최신 편 `#4ade80`(3px), 나머지 `#7ee0ff`, `#ffd166`, `#c4b5fd`, `#fb923c`(2px).
- 블록 느낌: 모서리 10px, 단색 면, 선명한 오프셋 그림자 `0 2px 0 rgba(0,0,0,.55)`.
- 글꼴: Pretendard Variable, 숫자는 `tabular-nums`, ID·코드는 JetBrains Mono.

### 5.4 화면별 명세

**홈**: KPI 2×2(인스타·유튜브 총 조회 +7일, 최근 5편 건너뛰기·저장+공유율 중앙값) → 최신 편 카드(T+, 조회 델타 `+300 / 1시간`, 건너뛰기 `42.0% → 41.5%`, 관문 배지, 같은 시점 기준편, 스파크라인, 유튜브 줄) → 사분면 → 최근 5편. 데스크톱은 KPI 4칸 / 최신 편(5열)+사분면(7열) / 최근 편 표.

**비교**: 플랫폼·지표·창(24h/72h/7d)·축(로그/선형) 컨트롤, 편 칩 + 바텀시트 선택(최대 5, 프리셋), 고정 값 패널 + 차트, 체크포인트 표(T+1h·3h·6h·24h·72h). URL `?eps=11,10,7,5&p=ig&m=views&w=72h&s=log`. 기본은 최신 편 + 기준편 + 직전 편.

**편 목록**: 모바일 카드, 데스크톱 정렬 표. 필터(계열, 관문, 초안).

**편 상세**: 머리(번호·제목·배지·게시 시각·링크) → 관문 블록 → 인스타 지표 → 유튜브 지표(Analytics 기준 시각 또는 "집계 대기") → 차트 3종(조회, 건너뛰기, 저장·공유) → 회고 패널(관리자 편집, 72시간 복기 알림).

**관리자**: 상태 카드 → Sync Now(쿨다운 카운트다운) → 초안 큐 → 수집 로그 → 편 관리. 데모에서는 같은 화면이 저장 없이 동작(쿨다운 30초).

**로그인**: [게스트 데모 체험하기 →]가 주 버튼, 그 아래 관리자 폼. 데스크톱은 왼쪽 프로젝트 소개.

### 5.5 차트 명세

**사분면**: X 건너뛰기(reversed, 오른쪽이 좋음), Y 저장+공유율, 기준선 x=45·y=1.5, 사분면 4칸 색과 라벨(터짐/훅 부족/저장동기 부족/전면개선), 버블 크기 `sqrt(views)`, 편 번호 라벨, 최신 편 강조, △ 표시, 제외 목록.

**T+ 성장 곡선**: 리샘플링(24h 0.25h·72h 1h·7d 3h 격자, 선형 보간, 간격이 maxGap을 넘으면 끊김, 누적 지표는 h=0을 0으로), 로그 축 기본, 비율 지표 기준선, 고정 값 패널.

### 5.6 지표 정의 문구

- **건너뛰기 비율**: 릴스 조회 중 첫 3초 안에 넘긴 비율(게시 후 누적). 낮을수록 좋다. 1차 관문 기준 45% 이하.
- **저장률·공유율**: 저장(공유) 수 ÷ 도달 계정 수. 2차 관문 기준 저장 1.0% 이상이면서 공유 0.5% 이상.
- **조회/도달**: 한 계정이 평균 몇 번 봤는지. 1보다 크면 다시 보기가 있다.
- **판정 대기**: 도달이 적으면 비율이 크게 흔들려 판정하지 않는다(1차 200 미만, 2차 500 미만).
- **유튜브 조회수**: Data API 실시간 조회수. 2025년 3월부터 Shorts 조회수는 재생과 반복 재생을 모두 센다.
- **참여 조회율**: Analytics 참여 조회수 ÷ 같은 집계의 조회수. YouTube Studio의 '계속 시청함/이탈함'과는 다른 지표다(그 값은 공개 API가 주지 않는다). 집계는 24~48시간 늦다.

### 5.7 숫자와 시간 표기

- 개수: 10,000 미만 `8,640`, 이상 `3.2만`. 건너뛰기 소수 1자리, 저장률·공유율 소수 2자리.
- 시간은 항상 `Asia/Seoul`로 표시. 절대 `11/21(금) 06:15`, 상대 `12분 전`, 경과 `45분`/`18시간`/`3일 6시간`.
- 델타는 40분~3시간 창 안에서 1시간 전에 가장 가까운 스냅샷과 비교하고 실제 간격을 쓴다.

### 5.8 데모 데이터

- `mulberry32`, 시드 `"techrano-demo"`, 기준 시각은 요청 시각을 1시간 단위로 내림.
- 가상 제목 12편(D01~D12), 약 60시간 간격. D12는 20시간 전 게시(진행 중).
- 유형: 터짐 D03·D05·D09, 저장동기 부족 D04·D07·D10(△)·D11, 훅 부족 D02·D06, 전면개선 D01·D08, 진행 중 D12.
- 조회 곡선: 1단계 `V1·(1−e^(−t/τ1))` + (터짐) 2단계 로지스틱. 스냅샷 시각은 실서비스 간격 + ±4분 지터.
- 수집 로그 20개(partial·failed 각 1), 자동 짝 초안 1건.

### 5.9 PWA

- `app/manifest.ts`(standalone, `#0b1220`, 아이콘 192·512·maskable, 바로가기).
- `public/sw.js`: `/offline`과 아이콘만 미리 캐시, 페이지는 네트워크만(실데이터 HTML 캐시 안 함), `/_next/static/*`는 캐시 우선.
- iOS는 홈 화면 앱 안에서 한 번 로그인.

### 5.10 접근성과 성능 목표

- 배지는 색 + 아이콘 + 글자, 터치 영역 44px, `prefers-reduced-motion` 존중, 차트 `aria-label`.
- Lighthouse 모바일 `/demo`: 성능 85+, 접근성 95+. 390px에서 가로 스크롤 없음.

---

## 6. 단계별 로드맵

### Phase 1: 골격, DB, 권한, 시드
- 만들 것: Next 앱, env, Supabase 클라이언트, 마이그레이션 4개, PGlite 마이그레이션 테스트, `seed-episodes.ts`, `verify-rls.ts`, `scan-secrets.sh`, ESLint 경계 규칙 틀, `ci.yml`.
- 완료 기준: 비밀값 없이 typecheck·lint·test·build 통과. `verify-rls` 통과(anon 거부, 비관리자 0행, 관리자 10행). 시드 미리보기 10행이 README와 같고 `--apply` 후 published 10, 기준편 05·07.

### Phase 2: 수집기와 크론 (11편 게시 전 목표)
- 만들 것: `src/lib/collector/**`, `src/server/collector.ts`, `/api/cron/sync`, `scripts/{sync,probe}.ts`, 수집 단위 테스트, `sync.yml`, `keepalive.yml`.
- 완료 기준: probe 성공, dry-run에서 10편 매칭·초안 0, 실제 실행 success, COOLDOWN·BUSY 확인, 토큰 오류 시 partial·redact, 배포 후 401/200, 예약 실행 누적.

### Phase 3: 도메인, 데모, 화면
- 3-0: 디자인 토큰 + 셸 + 데모 홈 가편 → 390·1440 스크린샷 → 사용자 승인 후 나머지 화면.
- 완료 기준: 데모 5개 화면, 사분면 4칸·△, 비교 URL 상태·체크포인트 표, 상세 차트·집계 대기, 관리자 시뮬레이션, supabase 요청 0건 e2e, 경계 린트, 단위 경계값, Lighthouse.

### Phase 4: 실데이터, 인증, 관리자
- 완료 기준: 비로그인 차단(proxy를 꺼도 차단), 비관리자 거부, 관리자 실데이터, Sync Now 쿨다운, 메모 저장, 초안 처리, 응답 헤더.

### Phase 5: PWA, 하드닝, 포트폴리오
- 완료 기준: 설치 가능, iOS 로그인 유지, 오프라인 안내, 보안 헤더 A, README, scan 통과, 수동 기록 import.

### 작업 규칙
1. 계획과 다르게 가야 할 때는 구현 전에 사용자에게 묻는다.
2. Phase가 끝날 때마다 검증 결과와 스크린샷을 보여 주고 커밋한다.
3. 커밋 메시지는 한국어(제목 한 줄 + 이유를 담은 본문), 트레일러 유지.
4. 공개 레포: 커밋 전 diff에서 메일, `/Users/` 경로, 기기 이름, 실제 수치·메모 확인 + `npm run scan`. `.env.local`, `*.local.json`은 커밋하지 않는다.
5. 첫 `git push`, 첫 Vercel 배포, GitHub Secrets·Vercel env 등록은 사용자 확인 후.
6. 비밀값을 터미널에 출력하지 않는다.
7. Techrano 레포는 읽기만 한다.

---

## 7. 배포와 운영 체크리스트

### 7.1 계정 준비
- GitHub 공개 레포 `techrano-analytics`(첫 push 때, 사용자 확인 후), Vercel Hobby, Supabase.

### 7.2 Supabase
1. 프로젝트 생성(Northeast Asia, Seoul).
2. Authentication: Email만, **Allow new users to sign up 끄기**, Anonymous sign-ins 끄기.
3. Users → Add user(관리자, Auto Confirm).
4. SQL Editor에서 레포에 남기지 않는 쿼리: `update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"app_role":"admin"}' where email = '<관리자 이메일>';`
5. 마이그레이션 적용(`npx supabase db push --db-url …` 또는 `link` 후 `db push`), 타입 생성.
6. API Keys: publishable, secret.
7. URL Configuration: Site URL을 프로덕션 주소로.
8. `npm run verify-rls`.

### 7.3 자격 증명 옮기기 (화면에 출력하지 않음)

```
printf 'META_ACCESS_TOKEN=%s\n' "$(security find-generic-password -a techrano -s techrano-instagram -w)" >> .env.local
printf 'GOOGLE_REFRESH_TOKEN=%s\n' "$(security find-generic-password -a techrano -s techrano-youtube-token -w)" >> .env.local
security find-generic-password -a techrano -s techrano-youtube-client -w \
  | python3 -c 'import json,sys;c=json.load(sys.stdin);print("GOOGLE_CLIENT_ID="+c["client_id"]);print("GOOGLE_CLIENT_SECRET="+c["client_secret"])' >> .env.local
```

Vercel은 `security … -w | npx vercel env add NAME production`. `CRON_SECRET`은 `S=$(openssl rand -hex 32); printf %s "$S" | gh secret set CRON_SECRET; printf %s "$S" | npx vercel env add CRON_SECRET production; unset S`.

### 7.4 Google Cloud OAuth 앱 게시
1. Google Auth Platform → Audience → Testing이면 **Publish app**(확인 없이 게시, "확인되지 않은 앱" 경고는 정상).
2. YouTube Data API v3, YouTube Analytics API 사용 설정 확인.
3. **게시 후 refresh token 재발급**: `cd ~/Desktop/Techrano && python3 scripts/yt-stats.py login` → `.env.local`과 Vercel 갱신.
4. `python3 scripts/yt-stats.py`와 `npm run probe` 확인.

### 7.5 Meta
- 시스템 사용자에게 `@tech.rano` 자산 할당 확인. 토큰이 취소되면 `insta-stats.py login` → env 갱신.

### 7.6 Vercel
1. GitHub 레포 Import(Node 24). 2. Functions Region **icn1**. 3. env(비밀값은 Production만). 4. 배포 후 Supabase Site URL 반영. 5. env 변경 후 재배포.

### 7.7 GitHub
1. Secrets: `SYNC_URL`, `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. `sync` 수동 실행 → 15~30분 뒤 예약 실행 확인.

### 7.8 초기 시드 투입 순서
1. 마이그레이션 → `verify-rls`
2. 관리자 계정 + claim
3. `.env.local` → `npm run probe`
4. `npm run seed -- --readme ~/Desktop/Techrano/업로드/README.md` 미리보기 → `--apply`
5. `npm run sync -- --force --discover-all` → 10편 모두 연결, 초안 0 확인
6. (선택) `npm run import-points -- --file seed/manual-points.local.json`
7. Vercel 배포 → 관리자 로그인 확인
8. GitHub Secrets → `sync` 수동 실행 → 예약 실행 확인
9. 11편 게시 후 15~30분 안에 초안 생성 → 관리자 화면에서 확정

### 7.9 운영 루틴과 장애 대응

| 증상 | 원인 | 조치 |
|---|---|---|
| 상단 점 빨강, 2시간 넘게 수집 없음 | 예약 워크플로 비활성(60일) 또는 실패 | Actions에서 Enable, 로그 확인 |
| 인스타 `AUTH` | 토큰 취소 | `insta-stats.py login` → env → 재배포 |
| 유튜브 `invalid_grant` | 테스트 모드 7일 만료 | 앱 게시 확인 → `yt-stats.py login` → env → 재배포 |
| 48시간 지나도 Analytics 비어 있음 | 집계 지연, 비공개 | 72시간까지 대기, errors 확인 |
| 대시보드 전체 오류 | Supabase 일시 정지 | Restore, 크론 확인 |
| Sync Now 쿨다운 | 2분 간격(정상) | 표시된 시간 뒤 다시 |

### 7.10 남은 위험
- GitHub 예약 실행 지연·누락 → 실제 시각 기준 계산과 리샘플링, 정체 감시.
- Meta 지표 이름 변경 → 미지원 지표 학습, `META_GRAPH_VERSION` 고정.
- 1~10편 초기 곡선 없음 → UI에 "초기 기록 없음".
- 이번 범위 밖: 팔로워 추이, 일별 Analytics 테이블, 관문 통과 푸시 알림, `성과.md` 자동 기록.
