// supabase/migrations와 같은 모양으로 손으로 쓴 타입이다.
// 프로젝트를 연결한 뒤 `npm run db:types`로 생성한 파일로 바꿔도 이름과 모양이 같아야 한다.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type EpisodeRow = {
  id: number;
  ep_no: number | null;
  slug: string | null;
  title: string;
  status: string;
  series: string | null;
  topic: string | null;
  is_true_story: boolean;
  length_sec: number | null;
  hook_desc: string | null;
  hypothesis: string | null;
  retro_72h: string | null;
  notes: string | null;
  is_benchmark: boolean;
  ig_shortcode: string | null;
  yt_video_id: string | null;
  auto_paired: boolean;
  created_at: string;
  updated_at: string;
};

type IgMediaRow = {
  media_id: string;
  shortcode: string;
  permalink: string;
  caption_head: string | null;
  posted_at: string;
  discovered_at: string;
  is_tracked: boolean;
  unsupported_metrics: string[];
  metrics_probed_at: string | null;
  last_snapshot_at: string | null;
  consecutive_failures: number;
  cover_path: string | null;
};

type YtVideoRow = {
  video_id: string;
  title: string;
  privacy_status: string;
  published_at: string | null;
  scheduled_at: string | null;
  duration_sec: number | null;
  is_short: boolean | null;
  discovered_at: string;
  is_tracked: boolean;
  last_snapshot_at: string | null;
  analytics_checked_at: string | null;
  analytics_ready_at: string | null;
  consecutive_failures: number;
  cover_path: string | null;
};

type SyncRunRow = {
  id: number;
  trigger: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  ig_status: string | null;
  yt_status: string | null;
  yt_analytics_status: string | null;
  ig_captured: number;
  yt_captured: number;
  new_media: number;
  api_calls: Json;
  errors: Json;
  note: string | null;
};

type IgSnapshotRow = {
  id: number;
  media_id: string;
  run_id: number | null;
  captured_at: string;
  source: string;
  views: number | null;
  reach: number | null;
  saved: number | null;
  shares: number | null;
  comments: number | null;
  likes: number | null;
  avg_watch_ms: number | null;
  skip_rate: number | null;
};

type YtSnapshotRow = {
  id: number;
  video_id: string;
  run_id: number | null;
  captured_at: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  a_views: number | null;
  a_engaged_views: number | null;
  a_avg_view_duration_s: number | null;
  a_avg_view_pct: number | null;
  a_shares: number | null;
  a_subscribers_gained: number | null;
};

/** Row에서 생성 열을 빼고, 기본값이 있는 열을 선택으로 만든 Insert 타입 */
type InsertOf<Row, RequiredKeys extends keyof Row, Generated extends keyof Row = never> = Pick<Row, RequiredKeys> &
  Partial<Omit<Row, RequiredKeys | Generated>>;

type Nullable<T> = { [K in keyof T]: T[K] | null };

export type Database = {
  public: {
    Tables: {
      episodes: {
        Row: EpisodeRow;
        Insert: InsertOf<EpisodeRow, "title", "id">;
        Update: Partial<Omit<EpisodeRow, "id">>;
        Relationships: [];
      };
      ig_media: {
        Row: IgMediaRow;
        Insert: InsertOf<IgMediaRow, "media_id" | "shortcode" | "permalink" | "posted_at">;
        Update: Partial<IgMediaRow>;
        Relationships: [];
      };
      yt_videos: {
        Row: YtVideoRow;
        Insert: InsertOf<YtVideoRow, "video_id" | "title" | "privacy_status", "is_short">;
        Update: Partial<Omit<YtVideoRow, "is_short">>;
        Relationships: [];
      };
      sync_runs: {
        Row: SyncRunRow;
        Insert: InsertOf<SyncRunRow, "trigger", "id">;
        Update: Partial<Omit<SyncRunRow, "id">>;
        Relationships: [];
      };
      ig_snapshots: {
        Row: IgSnapshotRow;
        Insert: InsertOf<IgSnapshotRow, "media_id" | "captured_at", "id">;
        Update: Partial<Omit<IgSnapshotRow, "id">>;
        Relationships: [];
      };
      yt_snapshots: {
        Row: YtSnapshotRow;
        Insert: InsertOf<YtSnapshotRow, "video_id" | "captured_at", "id">;
        Update: Partial<Omit<YtSnapshotRow, "id">>;
        Relationships: [];
      };
    };
    Views: {
      v_ig_series: {
        Row: Nullable<{
          media_id: string;
          episode_id: number;
          ep_no: number;
          captured_at: string;
          source: string;
          hours_since_post: number;
          views: number;
          reach: number;
          saved: number;
          shares: number;
          comments: number;
          likes: number;
          avg_watch_ms: number;
          skip_rate: number;
          save_rate: number;
          share_rate: number;
        }>;
        Relationships: [];
      };
      v_yt_series: {
        Row: Nullable<{
          video_id: string;
          episode_id: number;
          ep_no: number;
          captured_at: string;
          hours_since_post: number;
          views: number;
          likes: number;
          comments: number;
          a_views: number;
          a_engaged_views: number;
          a_avg_view_duration_s: number;
          a_avg_view_pct: number;
          a_shares: number;
          a_subscribers_gained: number;
        }>;
        Relationships: [];
      };
      v_episode_overview: {
        Row: Nullable<
          EpisodeRow & {
            media_id: string;
            permalink: string;
            ig_posted_at: string;
            ig_tracked: boolean;
            ig_captured_at: string;
            ig_views: number;
            ig_reach: number;
            ig_saved: number;
            ig_shares: number;
            ig_comments: number;
            ig_likes: number;
            ig_avg_watch_ms: number;
            ig_skip_rate: number;
            ig_source: string;
            yt_title: string;
            yt_privacy: string;
            yt_published_at: string;
            yt_scheduled_at: string;
            yt_duration_sec: number;
            yt_tracked: boolean;
            yt_captured_at: string;
            yt_views: number;
            yt_likes: number;
            yt_comments: number;
            yt_analytics_at: string;
            a_views: number;
            a_engaged_views: number;
            a_avg_view_duration_s: number;
            a_avg_view_pct: number;
            a_shares: number;
            a_subscribers_gained: number;
            posted_at: string;
            ig_cover_path: string;
            yt_cover_path: string;
          }
        >;
        Relationships: [];
      };
    };
    Functions: {
      start_sync_run: { Args: { p_trigger: string; p_min_gap_seconds?: number }; Returns: number };
      merge_episode: { Args: { p_source: number; p_target: number; p_auto?: boolean }; Returns: undefined };
      unpair_episode: { Args: { p_id: number; p_platform: string }; Returns: number };
      channel_totals: {
        Args: { p_at?: string };
        Returns: {
          ig_views: number | null;
          ig_reach: number | null;
          ig_saved: number | null;
          ig_shares: number | null;
          yt_views: number | null;
        }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type TableRow<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TableInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type ViewRow<T extends keyof Database["public"]["Views"]> = Database["public"]["Views"][T]["Row"];
