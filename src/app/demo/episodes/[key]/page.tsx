import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EpisodeDetailScreen } from "@/features/episodes/EpisodeDetailScreen";
import { getDemoRepository } from "@/lib/data/demo/repository";
import { loadEpisodeDetail } from "@/lib/data/screens";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  const e = await getDemoRepository().getEpisode(key);
  return { title: e ? `데모 · ${e.title}` : "데모 · 편" };
}

export default async function DemoEpisodePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const data = await loadEpisodeDetail(getDemoRepository(), decodeURIComponent(key));
  if (!data) notFound();
  return <EpisodeDetailScreen data={data} basePath="/demo" />;
}
