import type { Metadata } from "next";
import { DashboardPage } from "@/components/dashboard/dashboard-page";

export const metadata: Metadata = {
  title: "Resumen",
};

export default function DashboardRoute() {
  return <DashboardPage />;
}
