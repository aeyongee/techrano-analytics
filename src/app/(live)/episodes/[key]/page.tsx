import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EpisodeDetailScreen } from "@/features/episodes/EpisodeDetailScreen";
import { getLiveRepository } from "@/lib/data/live";
import { loadEpisodeDetail } from "@/lib/data/screens";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "편 상세" };

export default async function EpisodePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const data = await loadEpisodeDetail(await getLiveRepository(), decodeURIComponent(key));
  if (!data) notFound();
  return <EpisodeDetailScreen data={data} basePath="" />;
}
