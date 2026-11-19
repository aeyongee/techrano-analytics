-- 테이블과 인덱스. 권한·RLS는 20261120000004_security.sql에서 잠근다.

create schema if not exists private;

create table public.episodes (
  id             bigint generated always as identity primary key,
  ep_no          smallint unique check (ep_no > 0),          -- 초안이면 null
  slug           text unique,
  title          text not null,
  status         text not null default 'draft'
                 check (status in ('draft', 'published', 'archived')),
  series         text,                                        -- 계열: 보안 개념 | 개념 | 공감 …
  topic          text,                                        -- 세부 소재
  is_true_story  boolean not null default false,
  length_sec     numeric(6, 2),
  hook_desc      text,                                        -- 첫 컷 0~2초에 보이는 것과 첫 대사
  hypothesis     text,
  retro_72h      text,
  notes          text,
  is_benchmark   boolean not null default false,              -- 비교 화면 기본 세트
  ig_shortcode   text unique check (ig_shortcode ~ '^[A-Za-z0-9_-]+$'),
  yt_video_id    text unique check (yt_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  auto_paired    boolean not null default false,              -- 수집기가 시각 근접으로 묶음(확인 전)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint published_has_no check (status <> 'published' or ep_no is not null)
);

create table public.ig_media (
  media_id             text primary key,
  shortcode            text not null unique,
  permalink            text not null,
  caption_head         text,                                  -- 캡션 첫 줄(🦖 제거, 최대 200자)
  posted_at            timestamptz not null,
  discovered_at        timestamptz not null default now(),
  is_tracked           boolean not null default true,
  unsupported_metrics  text[] not null default '{}',
  metrics_probed_at    timestamptz,
  last_snapshot_at     timestamptz,
  consecutive_failures smallint not null default 0
);
create index ig_media_posted_at on public.ig_media (posted_at desc);

create table public.yt_videos (
  video_id             text primary key check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title                text not null,
  privacy_status       text not null check (privacy_status in ('public', 'unlisted', 'private')),
  published_at         timestamptz,       -- public이 된 뒤의 snippet.publishedAt. 그 전엔 null
  scheduled_at         timestamptz,       -- status.publishAt(예약 공개 시각)
  duration_sec         integer,
  is_short             boolean generated always as (duration_sec is not null and duration_sec <= 180) stored,
  discovered_at        timestamptz not null default now(),
  is_tracked           boolean not null default true,
  last_snapshot_at     timestamptz,
  analytics_checked_at timestamptz,
  analytics_ready_at   timestamptz,       -- Analytics에 처음 행이 나온 시각
  consecutive_failures smallint not null default 0
);
create index yt_videos_published_at on public.yt_videos (published_at desc);

create table public.sync_runs (
  id                  bigint generated always as identity primary key,
  trigger             text not null check (trigger in ('cron', 'manual', 'cli')),
  status              text not null default 'running'
                      check (status in ('running', 'success', 'partial', 'failed', 'abandoned')),
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  duration_ms         integer,
  ig_status           text check (ig_status in ('ok', 'error', 'skipped')),
  yt_status           text check (yt_status in ('ok', 'error', 'skipped')),
  yt_analytics_status text check (yt_analytics_status in ('ok', 'error', 'skipped', 'not_due')),
  ig_captured         integer not null default 0,
  yt_captured         integer not null default 0,
  new_media           integer not null default 0,
  api_calls           jsonb not null default '{}'::jsonb,
  errors              jsonb not null default '[]'::jsonb,    -- 토큰을 가린 뒤 저장한다
  note                text
);
create unique index sync_runs_single_running on public.sync_runs ((true)) where status = 'running';
create index sync_runs_started_at on public.sync_runs (started_at desc);

create table public.ig_snapshots (
  id            bigint generated always as identity primary key,
  media_id      text not null references public.ig_media (media_id) on delete cascade,
  run_id        bigint references public.sync_runs (id) on delete set null,
  captured_at   timestamptz not null,
  source        text not null default 'api' check (source in ('api', 'import')),
  views         bigint,
  reach         bigint,
  saved         integer,
  shares        integer,
  comments      integer,
  likes         integer,
  avg_watch_ms  integer,                                     -- ig_reels_avg_watch_time
  skip_rate     numeric(5, 2) check (skip_rate between 0 and 100),  -- reels_skip_rate(누적)
  constraint ig_snapshots_media_time unique (media_id, captured_at)
);

create table public.yt_snapshots (
  id                     bigint generated always as identity primary key,
  video_id               text not null references public.yt_videos (video_id) on delete cascade,
  run_id                 bigint references public.sync_runs (id) on delete set null,
  captured_at            timestamptz not null,
  -- Data API v3 (실시간)
  views                  bigint,
  likes                  integer,
  comments               integer,
  -- Analytics API v2 (24~48시간 지연. 이번 회차에 조회했고 행이 있을 때만 채운다)
  a_views                bigint,
  a_engaged_views        bigint,
  a_avg_view_duration_s  numeric(8, 2),
  a_avg_view_pct         numeric(6, 2),
  a_shares               integer,
  a_subscribers_gained   integer,
  constraint yt_snapshots_video_time unique (video_id, captured_at)
);
create index yt_snapshots_analytics_latest
  on public.yt_snapshots (video_id, captured_at desc) where a_views is not null;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger episodes_touch before update on public.episodes
  for each row execute function private.touch_updated_at();
