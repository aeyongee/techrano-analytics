-- 권한과 RLS. anon은 아무것도 못 하고, authenticated는 관리자 claim이 있을 때만 행을 본다.
-- 관리자 claim(app_metadata.app_role = 'admin')은 SQL 편집기에서 손으로 넣는다. 그 SQL은 레포에 두지 않는다.

-- 1) 관리자 판정: 서비스 키로만 바뀌는 app_metadata를 본다. 사용자가 바꿀 수 있는 user_metadata는 쓰지 않는다.
create or replace function private.is_admin()
returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'app_role', '') = 'admin'
     and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
$$;
revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

-- 2) 기본 권한 정리: anon 0, authenticated는 필요한 것만
revoke all on all tables in schema public from anon, authenticated;   -- 뷰 포함
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

grant select, insert, update, delete on public.episodes to authenticated;
grant select on public.ig_media, public.yt_videos, public.ig_snapshots,
                public.yt_snapshots, public.sync_runs to authenticated;
grant update (is_tracked) on public.ig_media, public.yt_videos to authenticated;
grant usage on all sequences in schema public to authenticated;           -- episodes identity(초안 RPC)
grant select on public.v_ig_series, public.v_yt_series, public.v_episode_overview to authenticated;
grant execute on function public.channel_totals(timestamptz) to authenticated;
grant execute on function public.merge_episode(bigint, bigint, boolean) to authenticated;
grant execute on function public.unpair_episode(bigint, text) to authenticated;

-- 수집기·시드(service_role)는 명시적으로 전부 허용한다(RLS는 bypassrls로 넘는다).
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- 3) RLS
alter table public.episodes     enable row level security;
alter table public.ig_media     enable row level security;
alter table public.yt_videos    enable row level security;
alter table public.ig_snapshots enable row level security;
alter table public.yt_snapshots enable row level security;
alter table public.sync_runs    enable row level security;

create policy episodes_admin_all on public.episodes for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy ig_media_admin_read on public.ig_media for select to authenticated
  using ((select private.is_admin()));
create policy ig_media_admin_track on public.ig_media for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy yt_videos_admin_read on public.yt_videos for select to authenticated
  using ((select private.is_admin()));
create policy yt_videos_admin_track on public.yt_videos for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy ig_snapshots_admin_read on public.ig_snapshots for select to authenticated
  using ((select private.is_admin()));
create policy yt_snapshots_admin_read on public.yt_snapshots for select to authenticated
  using ((select private.is_admin()));
create policy sync_runs_admin_read on public.sync_runs for select to authenticated
  using ((select private.is_admin()));

-- anon 정책은 만들지 않는다(정책 없음 = 거부).
