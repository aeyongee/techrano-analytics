import type { Metadata } from "next";
import { EpisodeListScreen } from "@/features/episodes/EpisodeListScreen";
import { getLiveRepository } from "@/lib/data/live";
import { loadEpisodeList } from "@/lib/data/screens";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "편" };

export default async function EpisodesPage() {
  return <EpisodeListScreen data={await loadEpisodeList(await getLiveRepository())} />;
}
