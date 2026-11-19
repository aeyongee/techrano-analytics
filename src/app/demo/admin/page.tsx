import type { Metadata } from "next";
import { AdminScreen } from "@/features/admin/AdminScreen";
import { getDemoRepository } from "@/lib/data/demo/repository";
import { loadAdmin } from "@/lib/data/screens";

export const revalidate = 3600;
export const metadata: Metadata = { title: "데모 · 관리" };

export default async function DemoAdminPage() {
  return <AdminScreen data={await loadAdmin(getDemoRepository())} />;
}
