-- 편 표지. 수집기가 인스타 릴스 표지(없으면 유튜브 쇼츠 세로 썸네일)를 받아 비공개 저장소에 둔다.
-- 인스타 표지 주소는 시간이 지나면 만료되므로 주소가 아니라 파일을 보관한다.

alter table public.ig_media add column if not exists cover_path text;
alter table public.yt_videos add column if not exists cover_path text;

-- 기존 열 순서를 지키고 끝에 표지 경로만 더한다(create or replace view 규칙).
create or replace view public.v_episode_overview with (security_invoker = true) as
select e.id, e.ep_no, e.slug, e.title, e.status, e.series, e.topic, e.is_true_story, e.length_sec,
       e.hook_desc, e.hypothesis, e.retro_72h, e.notes, e.is_benchmark, e.auto_paired,
       e.ig_shortcode, e.yt_video_id, e.created_at, e.updated_at,
       m.media_id, m.permalink, m.posted_at as ig_posted_at, m.is_tracked as ig_tracked,
       ig.captured_at as ig_captured_at, ig.views as ig_views, ig.reach as ig_reach,
       ig.saved as ig_saved, ig.shares as ig_shares, ig.comments as ig_comments,
       ig.likes as ig_likes, ig.avg_watch_ms as ig_avg_watch_ms, ig.skip_rate as ig_skip_rate,
       ig.source as ig_source,
       v.title as yt_title, v.privacy_status as yt_privacy, v.published_at as yt_published_at,
       v.scheduled_at as yt_scheduled_at, v.duration_sec as yt_duration_sec, v.is_tracked as yt_tracked,
       yt.captured_at as yt_captured_at, yt.views as yt_views, yt.likes as yt_likes, yt.comments as yt_comments,
       ya.captured_at as yt_analytics_at, ya.a_views, ya.a_engaged_views, ya.a_avg_view_duration_s,
       ya.a_avg_view_pct, ya.a_shares, ya.a_subscribers_gained,
       least(m.posted_at, v.published_at) as posted_at,
       m.cover_path as ig_cover_path,
       v.cover_path as yt_cover_path
  from public.episodes e
  left join public.ig_media m on m.shortcode = e.ig_shortcode
  left join lateral (
    select s.captured_at, s.views, s.reach, s.saved, s.shares, s.comments, s.likes,
           s.avg_watch_ms, s.skip_rate, s.source
      from public.ig_snapshots s
     where s.media_id = m.media_id
     order by s.captured_at desc
     limit 1
  ) ig on true
  left join public.yt_videos v on v.video_id = e.yt_video_id
  left join lateral (
    select s.captured_at, s.views, s.likes, s.comments
      from public.yt_snapshots s
     where s.video_id = v.video_id
     order by s.captured_at desc
     limit 1
  ) yt on true
  left join lateral (
    select s.captured_at, s.a_views, s.a_engaged_views, s.a_avg_view_duration_s,
           s.a_avg_view_pct, s.a_shares, s.a_subscribers_gained
      from public.yt_snapshots s
     where s.video_id = v.video_id and s.a_views is not null
     order by s.captured_at desc
     limit 1
  ) ya on true;

revoke all on public.v_episode_overview from anon;
grant select on public.v_episode_overview to authenticated;

-- 비공개 버킷: 관리자 세션만 서명된 주소로 읽고, 쓰기는 수집기(service_role)만 한다.
insert into storage.buckets (id, name, public)
values ('covers', 'covers', false)
on conflict (id) do nothing;

drop policy if exists covers_admin_read on storage.objects;
create policy covers_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'covers' and (select private.is_admin()));
