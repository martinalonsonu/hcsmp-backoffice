import type { Metadata } from "next";
import { Suspense } from "react";
import { DashboardPage } from "@/components/dashboard/dashboard-page";

export const metadata: Metadata = {
  title: "Resumen",
};

export default function DashboardRoute() {
  return (
    <Suspense fallback={<p className="p-8">Cargando portal…</p>}>
      <DashboardPage />
    </Suspense>
  );
}
