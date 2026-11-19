"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminSession } from "@/lib/auth/guard";
import type { ActionResult, ConfirmDraftInput, EpisodeMetaPatch, SyncNowResult } from "@/lib/actions/types";
import { mapRunRow } from "@/lib/data/live-mapping";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runServerSync, SyncBusyError, SyncCooldownError } from "@/server/collector";

// 모든 동작이 첫 줄에서 관리자를 다시 확인한다(proxy·레이아웃만 믿지 않는다).
// 쓰기는 관리자 세션 클라이언트로 해서 RLS도 한 번 더 막는다.

const FORBIDDEN = { ok: false, code: "FORBIDDEN", message: "관리자 로그인이 필요합니다." } as const;

type DbError = { code?: string; message: string } | null;

function fromDbError(error: DbError, conflictMessage = "다른 편과 겹칩니다."): ActionResult<never> {
  switch (error?.code) {
    case "23505":
    case "TR409":
      return { ok: false, code: "CONFLICT", message: conflictMessage };
    case "TR404":
      return { ok: false, code: "NOT_FOUND", message: "편을 찾지 못했습니다." };
    case "TR400":
      return { ok: false, code: "VALIDATION", message: "이 편에는 할 수 없는 동작입니다." };
    default:
      return { ok: false, code: "UPSTREAM", message: "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요." };
  }
}

async function adminDb() {
  return (await getAdminSession()) ? createSupabaseServerClient() : null;
}

const done = (): ActionResult => {
  revalidatePath("/", "layout");
  return { ok: true, data: null };
};

export async function syncNowAction(): Promise<ActionResult<SyncNowResult>> {
  if (!(await getAdminSession())) return FORBIDDEN;
  try {
    const s = await runServerSync({ trigger: "manual", force: true, minGapSeconds: 120 });
    const db = await createSupabaseServerClient();
    const { data } = s.runId !== null ? await db.from("sync_runs").select("*").eq("id", s.runId).maybeSingle() : { data: null };
    revalidatePath("/", "layout");
    if (!data) return { ok: false, code: "UPSTREAM", message: "수집은 끝났지만 기록을 읽지 못했습니다." };
    return { ok: true, data: { run: mapRunRow(data) } };
  } catch (e) {
    if (e instanceof SyncBusyError) return { ok: false, code: "BUSY", message: e.message };
    if (e instanceof SyncCooldownError) return { ok: false, code: "COOLDOWN", message: e.message, retryAfterSec: e.retryAfterSec };
    return { ok: false, code: "UPSTREAM", message: "수집을 시작하지 못했습니다. 수집 로그를 확인해 주세요." };
  }
}

const text = z.string().trim().max(4000).nullable().optional();
const metaSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  series: z.string().trim().max(60).nullable().optional(),
  topic: z.string().trim().max(120).nullable().optional(),
  isTrueStory: z.boolean().optional(),
  hookDesc: text,
  hypothesis: text,
  retro72h: text,
  notes: text,
});

export async function updateEpisodeMetaAction(id: number, patch: EpisodeMetaPatch): Promise<ActionResult> {
  const db = await adminDb();
  if (!db) return FORBIDDEN;
  const p = metaSchema.safeParse(patch);
  if (!p.success || !Number.isInteger(id)) return { ok: false, code: "VALIDATION", message: "입력을 확인해 주세요." };
  const v = p.data;
  const { error } = await db
    .from("episodes")
    .update({
      ...(v.title !== undefined && { title: v.title }),
      ...(v.series !== undefined && { series: v.series }),
      ...(v.topic !== undefined && { topic: v.topic }),
      ...(v.isTrueStory !== undefined && { is_true_story: v.isTrueStory }),
      ...(v.hookDesc !== undefined && { hook_desc: v.hookDesc }),
      ...(v.hypothesis !== undefined && { hypothesis: v.hypothesis }),
      ...(v.retro72h !== undefined && { retro_72h: v.retro72h }),
      ...(v.notes !== undefined && { notes: v.notes }),
    })
    .eq("id", id);
  return error ? fromDbError(error) : done();
}

const confirmSchema = z.object({
  epNo: z.number().int().positive().max(9999),
  title: z.string().trim().min(1).max(200),
  series: z.string().trim().max(60).nullable().optional(),
  hookDesc: z.string().trim().max(4000).nullable().optional(),
});

export async function confirmDraftAction(id: number, input: ConfirmDraftInput): Promise<ActionResult> {
  const db = await adminDb();
  if (!db) return FORBIDDEN;
  const p = confirmSchema.safeParse(input);
  if (!p.success) return { ok: false, code: "VALIDATION", message: "편 번호와 제목을 확인해 주세요." };
  const { error } = await db
    .from("episodes")
    .update({
      ep_no: p.data.epNo,
      title: p.data.title,
      series: p.data.series ?? null,
      hook_desc: p.data.hookDesc ?? null,
      status: "published",
      auto_paired: false,
    })
    .eq("id", id);
  return error ? fromDbError(error, `${p.data.epNo}편은 이미 있습니다.`) : done();
}

export async function mergeEpisodesAction(sourceId: number, targetId: number): Promise<ActionResult> {
  const db = await adminDb();
  if (!db) return FORBIDDEN;
  const { error } = await db.rpc("merge_episode", { p_source: sourceId, p_target: targetId, p_auto: false });
  return error ? fromDbError(error, "두 편이 같은 플랫폼을 이미 갖고 있습니다.") : done();
}

export async function unpairAction(id: number, platform: "ig" | "yt"): Promise<ActionResult<{ newDraftId: number }>> {
  const db = await adminDb();
  if (!db) return FORBIDDEN;
  const { data, error } = await db.rpc("unpair_episode", { p_id: id, p_platform: platform });
  if (error || data === null) return fromDbError(error);
  revalidatePath("/", "layout");
  return { ok: true, data: { newDraftId: Number(data) } };
}

export async function setTrackedAction(platform: "ig" | "yt", platformId: string, tracked: boolean): Promise<ActionResult> {
  const db = await adminDb();
  if (!db) return FORBIDDEN;
  const { error } =
    platform === "ig"
      ? await db.from("ig_media").update({ is_tracked: tracked }).eq("media_id", platformId)
      : await db.from("yt_videos").update({ is_tracked: tracked }).eq("video_id", platformId);
  return error ? fromDbError(error) : done();
}

export async function setBenchmarkAction(id: number, on: boolean): Promise<ActionResult> {
  const db = await adminDb();
  if (!db) return FORBIDDEN;
  const { error } = await db.from("episodes").update({ is_benchmark: on }).eq("id", id);
  return error ? fromDbError(error) : done();
}
