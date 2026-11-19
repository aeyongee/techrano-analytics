-- 뷰는 모두 security_invoker. 이게 없으면 뷰 소유자 권한으로 돌아 RLS를 우회한다.
-- hours_since_post는 저장하지 않고 여기서 계산한다(예약 공개 영상은 public이 되며 게시 시각이 바뀐다).

create view public.v_ig_series with (security_invoker = true) as
select s.media_id,
       e.id as episode_id,
       e.ep_no,
       s.captured_at,
       s.source,
       extract(epoch from (s.captured_at - m.posted_at)) / 3600.0 as hours_since_post,
       s.views, s.reach, s.saved, s.shares, s.comments, s.likes, s.avg_watch_ms, s.skip_rate,
       round(100.0 * s.saved / nullif(s.reach, 0), 3) as save_rate,
       round(100.0 * s.shares / nullif(s.reach, 0), 3) as share_rate
  from public.ig_snapshots s
  join public.ig_media m on m.media_id = s.media_id
  left join public.episodes e on e.ig_shortcode = m.shortcode;

create view public.v_yt_series with (security_invoker = true) as
select s.video_id,
       e.id as episode_id,
       e.ep_no,
       s.captured_at,
       extract(epoch from (s.captured_at - v.published_at)) / 3600.0 as hours_since_post,
       s.views, s.likes, s.comments,
       s.a_views, s.a_engaged_views, s.a_avg_view_duration_s, s.a_avg_view_pct,
       s.a_shares, s.a_subscribers_gained
  from public.yt_snapshots s
  join public.yt_videos v on v.video_id = s.video_id
  left join public.episodes e on e.yt_video_id = s.video_id;

create view public.v_episode_overview with (security_invoker = true) as
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
       least(m.posted_at, v.published_at) as posted_at
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
