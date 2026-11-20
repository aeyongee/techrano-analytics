-- 채널 팔로워(인스타)·구독자(유튜브) 수. 수집할 때마다 한 줄씩 쌓는다.
-- 유튜브는 Analytics 일별 증감으로 지난 기록을 채울 수 있다(source = 'backfill').
create table if not exists public.audience_snapshots (
  platform    text        not null check (platform in ('ig', 'yt')),
  captured_at timestamptz not null,
  count       integer     not null check (count >= 0),
  source      text        not null default 'api' check (source in ('api', 'backfill')),
  run_id      bigint      references public.sync_runs (id) on delete set null,
  primary key (platform, captured_at)
);

revoke all on public.audience_snapshots from anon, authenticated;
grant select on public.audience_snapshots to authenticated;
grant all on public.audience_snapshots to service_role;

alter table public.audience_snapshots enable row level security;
drop policy if exists audience_snapshots_admin_read on public.audience_snapshots;
create policy audience_snapshots_admin_read on public.audience_snapshots for select to authenticated
  using ((select private.is_admin()));

-- 화면용: 날짜(한국 시각)마다 마지막 값 하나. 15분마다 쌓인 행을 그대로 읽지 않게 한다.
create or replace view public.v_audience_daily with (security_invoker = true) as
select distinct on (platform, (captured_at at time zone 'Asia/Seoul')::date)
  platform,
  (captured_at at time zone 'Asia/Seoul')::date as day,
  captured_at,
  count
from public.audience_snapshots
order by platform, (captured_at at time zone 'Asia/Seoul')::date, captured_at desc;

revoke all on public.v_audience_daily from anon;
grant select on public.v_audience_daily to authenticated;
