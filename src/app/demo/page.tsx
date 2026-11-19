import type { Metadata } from "next";
import { DashboardScreen } from "@/features/dashboard/DashboardScreen";
import { loadDashboard } from "@/lib/data/builders";
import { getDemoRepository } from "@/lib/data/demo/repository";

export const revalidate = 3600;
export const metadata: Metadata = { title: "데모 · 홈" };

export default async function DemoHomePage() {
  const data = await loadDashboard(getDemoRepository());
  return <DashboardScreen data={data} basePath="/demo" />;
}
