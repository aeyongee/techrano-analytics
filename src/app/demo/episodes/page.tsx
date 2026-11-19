import type { Metadata } from "next";
import { EpisodeListScreen } from "@/features/episodes/EpisodeListScreen";
import { getDemoRepository } from "@/lib/data/demo/repository";
import { loadEpisodeList } from "@/lib/data/screens";

export const revalidate = 3600;
export const metadata: Metadata = { title: "데모 · 편" };

export default async function DemoEpisodesPage() {
  return <EpisodeListScreen data={await loadEpisodeList(getDemoRepository())} />;
}
