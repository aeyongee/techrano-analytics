-- RPC 함수. 오류 코드는 TR409(BUSY), TR429(COOLDOWN, detail = 남은 초), TR404, TR400.

-- 수집 시작: 오래된 running 정리 → 간격 검사 → 잠금 획득(단일 running 유니크 인덱스)
create or replace function public.start_sync_run(p_trigger text, p_min_gap_seconds integer default 0)
returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  v_id bigint;
  v_last timestamptz;
begin
  update public.sync_runs
     set status = 'abandoned', finished_at = now(), note = 'timeout'
   where status = 'running' and started_at < now() - interval '5 minutes';

  if p_min_gap_seconds > 0 then
    select max(started_at) into v_last
      from public.sync_runs
     where status in ('running', 'success', 'partial');
    if v_last is not null and v_last > now() - make_interval(secs => p_min_gap_seconds) then
      raise exception 'cooldown' using
        errcode = 'TR429',
        detail = ceil(extract(epoch from (v_last + make_interval(secs => p_min_gap_seconds) - now())))::text;
    end if;
  end if;

  insert into public.sync_runs (trigger) values (p_trigger) returning id into v_id;
  delete from public.sync_runs where started_at < now() - interval '180 days';
  return v_id;
exception
  when unique_violation then
    raise exception 'busy' using errcode = 'TR409';
end $$;

-- 초안 합치기: source(초안)의 플랫폼 키를 target으로 옮기고 source를 지운다.
create or replace function public.merge_episode(p_source bigint, p_target bigint, p_auto boolean default false)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  s public.episodes;
  t public.episodes;
begin
  if p_source = p_target then
    raise exception 'same episode' using errcode = 'TR400';
  end if;
  select * into s from public.episodes where id = p_source for update;
  select * into t from public.episodes where id = p_target for update;
  if s.id is null or t.id is null then
    raise exception 'not found' using errcode = 'TR404';
  end if;
  if s.status <> 'draft' then
    raise exception 'source must be draft' using errcode = 'TR400';
  end if;
  if (s.ig_shortcode is not null and t.ig_shortcode is not null)
     or (s.yt_video_id is not null and t.yt_video_id is not null) then
    raise exception 'platform conflict' using errcode = 'TR409';
  end if;

  delete from public.episodes where id = p_source;            -- 유니크 키를 먼저 비운다
  update public.episodes
     set ig_shortcode = coalesce(t.ig_shortcode, s.ig_shortcode),
         yt_video_id  = coalesce(t.yt_video_id, s.yt_video_id),
         auto_paired  = p_auto
   where id = p_target;
end $$;

-- 짝 해제: p_platform('ig' | 'yt') 쪽 키를 떼어 새 초안으로 만들고 그 id를 돌려준다.
create or replace function public.unpair_episode(p_id bigint, p_platform text)
returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  e public.episodes;
  v_title text;
  v_new bigint;
begin
  select * into e from public.episodes where id = p_id for update;
  if e.id is null then
    raise exception 'not found' using errcode = 'TR404';
  end if;
  if e.ig_shortcode is null or e.yt_video_id is null then
    raise exception 'episode has a single platform' using errcode = 'TR400';
  end if;

  if p_platform = 'yt' then
    select title into v_title from public.yt_videos where video_id = e.yt_video_id;
    update public.episodes set yt_video_id = null, auto_paired = false where id = p_id;
    insert into public.episodes (title, status, yt_video_id)
    values (coalesce(v_title, e.title), 'draft', e.yt_video_id)
    returning id into v_new;
  elsif p_platform = 'ig' then
    select caption_head into v_title from public.ig_media where shortcode = e.ig_shortcode;
    update public.episodes set ig_shortcode = null, auto_paired = false where id = p_id;
    insert into public.episodes (title, status, ig_shortcode)
    values (coalesce(v_title, e.title), 'draft', e.ig_shortcode)
    returning id into v_new;
  else
    raise exception 'platform must be ig or yt' using errcode = 'TR400';
  end if;
  return v_new;
end $$;

-- KPI: 시점 p_at까지 편마다 가장 최근 스냅샷을 더한다(보관한 편은 뺀다).
create or replace function public.channel_totals(p_at timestamptz default now())
returns table (ig_views bigint, ig_reach bigint, ig_saved bigint, ig_shares bigint, yt_views bigint)
language sql stable security invoker set search_path = '' as $$
  with ig as (
    select distinct on (s.media_id) s.views, s.reach, s.saved, s.shares
      from public.ig_snapshots s
      join public.ig_media m on m.media_id = s.media_id
      join public.episodes e on e.ig_shortcode = m.shortcode and e.status <> 'archived'
     where s.captured_at <= p_at
     order by s.media_id, s.captured_at desc
  ),
  yt as (
    select distinct on (s.video_id) s.views
      from public.yt_snapshots s
      join public.episodes e on e.yt_video_id = s.video_id and e.status <> 'archived'
     where s.captured_at <= p_at
     order by s.video_id, s.captured_at desc
  )
  select (select sum(views) from ig)::bigint,
         (select sum(reach) from ig)::bigint,
         (select sum(saved) from ig)::bigint,
         (select sum(shares) from ig)::bigint,
         (select sum(views) from yt)::bigint
$$;
